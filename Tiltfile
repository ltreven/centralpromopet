# ─────────────────────────────────────────────────────────────────────────────
# Central Promo Pet — Tiltfile (Local Environment)
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Ensure the namespace exists ─────────────────────────────────────
local_resource(
  'ensure-namespace',
  cmd='kubectl create namespace centralpromopet --dry-run=client -o yaml | kubectl apply -f -',
  labels=['setup'],
)

# ── 2. Run DB migrations after PostgreSQL is ready ───────────────────────────
local_resource(
  'db-migrate',
  cmd='npm run build --workspace @centralpromopet/database && npm run migrate --workspace @centralpromopet/database && npm run seed --workspace @centralpromopet/database',
  env={'DATABASE_URL': 'postgres://centralpromopet:centralpromopet@127.0.0.1:5433/centralpromopet'},
  resource_deps=['centralpromopet-postgresql'],
  deps=[
    'packages/database/drizzle',
    'packages/database/scripts/migrate.ts',
    'packages/database/seed/seed.ts',
  ],
  labels=['setup'],
)

# ── 3. Build Central Promo Pet API image ─────────────────────────────────────────────
docker_build(
  'centralpromopet/api',
  context='.',
  dockerfile='apps/centralpromopet-api/Dockerfile',
  target='development',
  ignore=[
    '**/node_modules',
    '**/dist',
    '**/.next',
  ],
)

# ── 4. Build Central Promo Pet Web image ─────────────────────────────────────────────
docker_build(
  'centralpromopet/web',
  context='.',
  dockerfile='apps/centralpromopet-web/Dockerfile',
  target='development',
  ignore=['**/node_modules', '**/.next', '*.md'],
  live_update=[
    fall_back_on(['package.json', 'package-lock.json', 'apps/centralpromopet-web/package.json']),
    sync('apps/centralpromopet-web/app', '/app/apps/centralpromopet-web/app'),
    sync('apps/centralpromopet-web/components', '/app/apps/centralpromopet-web/components'),
    sync('apps/centralpromopet-web/lib', '/app/apps/centralpromopet-web/lib'),
    sync('apps/centralpromopet-web/public', '/app/apps/centralpromopet-web/public'),
  ],
)

# ── 5. Deploy Helm Chart ─────────────────────────────────────────────────────
k8s_yaml(
  helm(
    'charts/centralpromopet',
    name='centralpromopet',
    namespace='centralpromopet',
    values=['charts/centralpromopet/values.yaml', 'charts/centralpromopet/values-local.yaml'],
  )
)

k8s_resource(
  new_name='configuration',
  objects=['centralpromopet-local:secret', 'centralpromopet:ingress'],
  resource_deps=['ensure-namespace'],
  labels=['setup'],
)

# ── 6. Resource Configuration ────────────────────────────────────────────────
k8s_resource(
  'centralpromopet-postgresql',
  resource_deps=['configuration'],
  labels=['database'],
  port_forwards=['5433:5432'],
)

k8s_resource(
  'centralpromopet-api',
  resource_deps=['centralpromopet-postgresql', 'db-migrate', 'ensure-namespace'],
  labels=['app'],
  port_forwards=['4001:4000'],
)

k8s_resource(
  'centralpromopet-web',
  resource_deps=['centralpromopet-api'],
  labels=['app'],
  port_forwards=['3001:3000'],
)
