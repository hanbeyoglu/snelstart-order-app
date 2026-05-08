FROM node:20-alpine AS builder

WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Packages
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile --prod=false

# Source
COPY . .

# Build
RUN pnpm --filter ./packages/shared build
RUN pnpm --filter ./apps/worker build

# ------------------

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app .

CMD ["node", "/app/apps/worker/dist/index.js"]
