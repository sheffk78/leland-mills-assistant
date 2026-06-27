# syntax = docker/dockerfile:1

# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Cache bust to ensure fresh build on every deploy
ARG CACHE_BUST=1
RUN echo "Cache bust: ${CACHE_BUST}"

RUN npx prisma generate
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

# Run Prisma migration then seed admin user, then start Next.js
CMD ["sh", "-c", "npx prisma db push --accept-data-loss 2>&1; npx tsx scripts/seed-admin.ts 2>&1; npm start"]