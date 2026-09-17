FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/centralpromopet-api/package.json apps/centralpromopet-api/package.json
COPY apps/centralpromopet-web/package.json apps/centralpromopet-web/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci

FROM dependencies AS development
COPY --chown=node:node apps/centralpromopet-web apps/centralpromopet-web
RUN mkdir -p /app/apps/centralpromopet-web/.next && chown node:node /app/apps/centralpromopet-web/.next
ENV NEXT_TELEMETRY_DISABLED=1
USER node
WORKDIR /app/apps/centralpromopet-web
CMD ["npm", "run", "dev"]

FROM dependencies AS builder
COPY apps/centralpromopet-web apps/centralpromopet-web
RUN npm run build --workspace centralpromopet-web

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=builder --chown=node:node /app/apps/centralpromopet-web/public ./apps/centralpromopet-web/public
COPY --from=builder --chown=node:node /app/apps/centralpromopet-web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/centralpromopet-web/.next/static ./apps/centralpromopet-web/.next/static

USER 1000:1000
EXPOSE 3000
CMD ["node", "apps/centralpromopet-web/server.js"]
