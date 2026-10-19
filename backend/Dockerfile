# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts tsconfig*.json nest-cli.json ./
RUN npm ci && node node_modules/@prisma/engines/scripts/postinstall.js
COPY prisma ./prisma
COPY src ./src
RUN npm run build

# Explicit tooling image for migrations, seed, and isolated database tests.
FROM build AS tooling
COPY test ./test
USER node
CMD ["npm", "run", "prisma:deploy"]

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# The generated client is already compiled into dist; no CLI in the runtime image.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
