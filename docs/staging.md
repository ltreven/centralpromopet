# Central Promo Pet staging

Staging runs on the existing Hetzner K3s cluster through Helm, GitHub Actions/GHCR,
and Argo CD. The repository is `ltreven/centralpromopet`. Namespace, images, JWT
issuer/audience, cookie and secrets are isolated from Agrisense.

## Delivery

Pull requests validate application code and Helm. On main, the staging workflow
builds production API/Web images, publishes commit-SHA tags to GHCR, opens and
merges a promotion PR updating `charts/centralpromopet/values-staging.yaml`.
Argo CD reconciles that file. The workflow builds and promotes images only when the
repository variable `STAGING_ENABLED` equals `true`.

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
This is a regular Argo sync-wave Job, not a PreSync hook. A separate, staging-only
seed Job loads the six explicitly supplied demo offers after migrations. It is gated
by `stagingSeed.enabled`, verifies the `centralpromopet-staging` namespace, and uses
fixed IDs with conflict-do-nothing so later deploys preserve admin edits. The chart's
default keeps this seed disabled outside staging. Local development uses
`npm run seed:demo --workspace @centralpromopet/database`; that command refuses to run
when `NODE_ENV=production`. Migration Jobs are named by image SHA; deploy migrations
must be backward compatible. A successful migration is recorded by Drizzle and can
safely run again.

The local PVC is not an external backup. Add external pg_dump backups and validate
restoration before storing important data. Image rollback does not reverse schema
changes: revert both image tags only to a schema-compatible version.

## Demo promotions

The staging values enable a seed Job that adds the six supplied demo promotions
after migrations and app rollout. It checks the Kubernetes namespace and uses fixed
IDs with `ON CONFLICT DO NOTHING`, so later deployments preserve existing records.
The chart default disables the seed outside staging. Local development can load or
refresh the same catalog with `npm run seed:demo --workspace
@centralpromopet/database`; that command refuses to run with `NODE_ENV=production`.

The supplied image filenames are stored as `/promotions/<filename>`. The image
files are not in the repository yet, so public cards show an image placeholder until
matching files are added under `apps/centralpromopet-web/public/promotions/`.

After a staging sync, check PostgreSQL, the migration and seed Jobs, API `/ready`,
Web `/health`, the public HTTPS page, and an authenticated admin request. Bootstrap
uses the one-time secret and Job described above; remove the bootstrap secret after
success and change the temporary password.

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
