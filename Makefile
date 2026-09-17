.DEFAULT_GOAL := help
.PHONY: help up down dev studio helm-lint staging-status staging-argo install check migrate seed seed-demo bootstrap-admin test-integration

up: ## 🚀 Start Tilt
	@tilt up

down: ## ☢ Stop Tilt
	@tilt down

dev: ## 🛠️ Clean Start
	@tilt down
	@tilt up

studio: ## 🗄️ Open Drizzle Studio
	@npm run db:studio

helm-lint: ## Validate local and staging Helm manifests
	@helm lint charts/centralpromopet -f charts/centralpromopet/values-local.yaml
	@helm template centralpromopet charts/centralpromopet -f charts/centralpromopet/values-local.yaml --namespace centralpromopet >/dev/null
	@helm lint charts/centralpromopet -f charts/centralpromopet/values-staging.yaml
	@helm template centralpromopet charts/centralpromopet -f charts/centralpromopet/values-staging.yaml --namespace centralpromopet-staging >/dev/null

staging-status: ## Show staging workloads and Argo CD status
	@kubectl --context hetzner-vps -n centralpromopet-staging get pods,svc,ingress,pvc,certificate
	@kubectl --context hetzner-vps -n argocd get application centralpromopet-staging

staging-argo: ## Apply the Central Promo Pet Argo CD application
	@kubectl --context hetzner-vps apply -f argocd-staging.yaml

help: ## Show this help
	@echo "\n  \033[1mCentral Promo Pet Environment Manager\033[0m"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-24s\033[0m %s\n", $$1, $$2}'

install: ## Install locked workspace dependencies
	@npm ci

check: ## Run lint, application builds and unit tests
	@npm run check

migrate: ## Apply database migrations (local port 5433 by default)
	@npm run migrate --workspace @centralpromopet/database

seed: ## Create the local admin without overwriting an existing password
	@npm run seed --workspace @centralpromopet/database

seed-demo: ## Add one clearly labelled demonstration promotion locally
	@npm run seed:demo --workspace @centralpromopet/database

bootstrap-admin: ## Create the first admin using BOOTSTRAP_ADMIN_EMAIL/PASSWORD
	@npm run build --workspace @centralpromopet/database
	@npm run bootstrap:admin --workspace @centralpromopet/api

test-integration: ## Test against a dedicated database (requires TEST_DATABASE_URL)
	@node -e 'try { if (!new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")) process.exit(1); } catch { process.exit(1); }' || (echo 'TEST_DATABASE_URL must point to a dedicated database ending in _test'; exit 1)
	@npm run build --workspace @centralpromopet/api
	@DATABASE_URL="$$TEST_DATABASE_URL" npm run migrate --workspace @centralpromopet/database
	@npm run test:integration --workspace @centralpromopet/api
