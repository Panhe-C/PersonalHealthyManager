FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY prisma ./prisma
RUN npm ci

FROM dependencies AS builder

COPY . .
RUN npm run build

FROM dependencies AS tools

COPY . .
ENTRYPOINT ["./scripts/docker-owner-setup.sh"]

FROM dependencies AS production-dependencies

RUN npm prune --omit=dev --workspaces=false

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=file:/data/healthy-body.sqlite

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /data \
    && chown nextjs:nodejs /data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=production-dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --chown=nextjs:nodejs scripts/data-backup.mjs scripts/data-storage.mjs ./scripts/

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
