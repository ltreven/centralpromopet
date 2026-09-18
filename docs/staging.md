# Central Promo Pet staging (prepared, not provisioned)

This follows Agrisense's Hetzner K3s → Helm → GitHub Actions/GHCR → Argo CD flow.
The repository is `ltreven/centralpromopet`. Namespace, images, JWT issuer/audience,
cookie and secrets are isolated from Agrisense.

## Delivery

Pull requests validate application code and Helm. On main, the staging workflow
builds production API/Web images, publishes commit-SHA tags to GHCR, opens and
merges a promotion PR updating `charts/centralpromopet/values-staging.yaml`.
Argo CD reconciles that file. The workflow stays disabled until the repository
variable `STAGING_ENABLED` equals `true`. No staging deployment has been performed.
Enable Actions' permission to create pull requests and configure branch rules so
the promotion bot can merge its update. Validate these permissions before enabling.

`centralpromopet-stg.sabialabs.de` is the staging hostname. Its DNS A record should
point to the Hetzner ingress IP. Keep `ingress.host` and `api.appOrigins` aligned
with this hostname if it changes. TLS uses the cluster's `letsencrypt-prod` issuer.
Only Web is exposed through Traefik/TLS. It proxies `/api` to the private API
service; cookies are HttpOnly, SameSite=Lax and Secure in production. No secret
is bundled into browser code. `NEXT_PUBLIC_WHATSAPP_URL` is a public build-time
setting (default: the existing Busqy URL).

## Secrets (create in centralpromopet-staging, never commit)

- `ghcr-pull-secret`: credentials to pull the repository's private GHCR images.
- `centralpromopet-db-credentials`: key `postgres-password`.
- `centralpromopet-api-secret`: keys `database-url` and `jwt-secret` (32+ random characters).
  Database URL uses the same DB password and internal host
  `centralpromopet-postgresql:5432`, database/user `centralpromopet`.
- One-time `centralpromopet-bootstrap-admin`: keys `email` and `password`.
  Use 12+ characters and at most 72 UTF-8 bytes for the temporary password.

Production never uses the committed local development credentials. Rotate real
secrets independently from Agrisense. Access to database credentials is equivalent
to full application data access.

## Database and migrations

Plain PostgreSQL 15 replaces Agrisense's PostGIS because this application has no
geospatial domain. Staging uses a 10 GiB local-path PVC. The database and Service
are applied in sync wave -2; the migration Job runs in wave -1 before the apps.
This is a regular Argo sync-wave Job, not a PreSync hook. Seeds never run on deploy.
Migration Jobs are named by image SHA; deploy migrations must be backward compatible.
A successful migration is recorded by Drizzle and can safely run again.

The local PVC is not an external backup. Add external pg_dump backups and validate
restoration before storing important data. Image rollback does not reverse schema
changes: revert both image tags only to a schema-compatible version.

## Provisioning checklist for the next phase

1. Confirm hostname, DNS, GHCR permissions and `hetzner-vps` kube context.
2. Create the namespace and secrets; use the cluster's existing TLS issuer
   `letsencrypt-prod` (do not overwrite Agrisense's cluster-wide issuer).
3. Enable `STAGING_ENABLED=true`, publish the first images and merge their tag update.
4. Apply `argocd-staging.yaml` with `make staging-argo` after reviewing its target.
5. Wait for PostgreSQL, migration Job, API `/ready` and Web `/health` to be healthy.
6. Replace the bootstrap Job image's `bootstrap-pending` tag with the deployed API SHA,
   create the one-time bootstrap secret, and apply `k8s/jobs/bootstrap-admin.yaml`.
7. Remove the bootstrap secret after success. Log in and change the temporary password.
8. Check HTTPS, cookie flags, a promotion read and an authenticated admin request.

The bootstrap command refuses to run once an admin exists. Local seed credentials
are documented in README and are exclusively for local development.

## Current security limits

Login/password-change throttling is conservative and per API process (30 requests
per minute per direct peer; Web traffic shares that budget). Before increasing
replicas or opening public registration, configure ingress rate limits or a shared
store and an explicit trusted-proxy chain. Password changes invalidate older
sessions through a database session version. Logout clears the current browser
cookie; it is not a server-side global logout. Password recovery is not exposed
until a real expiring-token and email delivery flow is implemented.
