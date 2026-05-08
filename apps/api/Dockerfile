# ========================
# BUILD STAGE
# ========================
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Source code
COPY packages ./packages
COPY apps/api ./apps/api

# Install deps
RUN pnpm install --frozen-lockfile

# Build shared first
RUN pnpm --filter ./packages/shared build

# Build api
RUN pnpm --filter ./apps/api build


# ========================
# RUNTIME STAGE
# ========================
FROM node:20-alpine
WORKDIR /app

# 🔥 En sağlam yöntem: her şeyi olduğu gibi al
COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
