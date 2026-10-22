# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts tsconfig*.json nest-cli.json ./
RUN npm ci --include=dev && node node_modules/@prisma/engines/scripts/postinstall.js
COPY prisma ./prisma
COPY src ./src
COPY test ./test
COPY scripts ./scripts
COPY eslint.config.mjs .prettierrc ./
RUN npm run build && mkdir -p /app/coverage && chown node:node /app/coverage
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "scripts/start-hosted.mjs"]
