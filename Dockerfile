FROM node:22-alpine AS deps
WORKDIR /app
# Prisma needs *a* DATABASE_URL to generate the client; nothing connects during the build.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S embark && adduser -S embark -G embark
COPY --from=builder /app/public ./public
COPY --from=builder --chown=embark:embark /app/.next/standalone ./
COPY --from=builder --chown=embark:embark /app/.next/static ./.next/static
USER embark
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
