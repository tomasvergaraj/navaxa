FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# ===== Stage 1: deps =====
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# ===== Stage 2: build =====
FROM base AS build
# Las NEXT_PUBLIC_* se hornean en el bundle del cliente EN BUILD, no en runtime.
ARG NEXT_PUBLIC_APP_URL=https://navaxa.cl
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY . .
RUN pnpm --filter @navaxa/db exec prisma generate
RUN pnpm --filter web build

# ===== Stage 3: runtime =====
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: requerido por el motor de Prisma; libc6-compat: red de seguridad para binarios nativos.
RUN apk add --no-cache openssl libc6-compat

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Extras de runtime que NO viven en el bundle standalone (se resuelven vía NODE_PATH):
#  - sharp: módulo nativo; el tracing de standalone no incluye su binario de plataforma,
#    así que lo instalamos aquí (alpine → musl) y borramos cualquier copia incompleta.
#  - prisma (CLI): para correr `migrate deploy` en el arranque.
RUN mkdir -p /deps && cd /deps && npm init -y >/dev/null 2>&1 \
    && npm install --omit=dev sharp@0.34.5 prisma@5.18.0 \
    && chown -R nextjs:nodejs /deps
ENV NODE_PATH=/deps/node_modules
ENV PATH=/deps/node_modules/.bin:$PATH

# Salida standalone de Next
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
# Schema + migraciones para `prisma migrate deploy`
COPY --from=build --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma
# Quitar una copia de sharp posiblemente incompleta (sin binario) para que gane /deps
RUN rm -rf /app/node_modules/sharp /app/node_modules/@img 2>/dev/null || true

COPY --chown=nextjs:nodejs apps/web/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
