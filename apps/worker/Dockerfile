FROM node:18-alpine AS builder

WORKDIR /app

# pnpm
RUN npm install -g pnpm

# Workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Packages
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN pnpm install --frozen-lockfile

# Source
COPY . .

# Build
RUN pnpm --filter ./packages/shared build
RUN pnpm --filter ./apps/worker build

# ------------------

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app .

CMD ["node", "apps/worker/dist/main.js"]