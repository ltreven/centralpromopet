# Central Promo Pet

Phase 1 is a working skeleton derived from ../agrisense. Preserve that project's
npm workspaces, Express + Drizzle + PostgreSQL, Next.js, Tilt, Helm and GitOps
conventions. Do not copy its agricultural domain or credentials.

- API: apps/centralpromopet-api; Web: apps/centralpromopet-web; DB: packages/database.
- `make up`: local Tilt (Web 3001, API 4001, PostgreSQL 5433).
- `make check`: lint, builds, unit tests; `make helm-lint`: manifest validation.
- `TEST_DATABASE_URL=... make test-integration`: migrations and real database tests.
- Auth uses an HttpOnly JWT cookie; no browser-stored token or public shared secret.
  Every private API route requires authentication and mandatory password change.
  Admin permission must also be enforced in the API, never only in the UI.
- Use Drizzle migrations; never db:push for staging. Local seeds must not run in production.
- Logo: apps/centralpromopet-web/public/logo.webp. WhatsApp: lib/site.ts.
- Staging is prepared but not provisioned. See docs/staging.md. Do not apply to
  Hetzner or enable STAGING_ENABLED as part of ordinary local development.
- Read installed Next.js docs before changing its APIs; see the Web AGENTS.md.
- Pets, public registration, promotion management UI and AI chat belong to later phases.
