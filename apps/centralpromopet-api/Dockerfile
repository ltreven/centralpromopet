FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/centralpromopet-api/package.json apps/centralpromopet-api/package.json
COPY apps/centralpromopet-web/package.json apps/centralpromopet-web/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci

FROM dependencies AS development
COPY --chown=node:node apps/centralpromopet-api apps/centralpromopet-api
COPY --chown=node:node packages/database packages/database
RUN chown -R node:node /app/apps/centralpromopet-api /app/packages/database
USER node
WORKDIR /app/apps/centralpromopet-api
CMD ["npm", "run", "dev"]

FROM dependencies AS builder
COPY apps/centralpromopet-api apps/centralpromopet-api
COPY packages/database packages/database
RUN npm run build --workspace @centralpromopet/api

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/centralpromopet-api/package.json apps/centralpromopet-api/package.json
COPY apps/centralpromopet-web/package.json apps/centralpromopet-web/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/apps/centralpromopet-api/dist apps/centralpromopet-api/dist
COPY --from=builder /app/packages/database/dist packages/database/dist
COPY --from=builder /app/packages/database/drizzle packages/database/drizzle

USER 1000:1000
WORKDIR /app/apps/centralpromopet-api
EXPOSE 4000
CMD ["node", "dist/server.js"]
