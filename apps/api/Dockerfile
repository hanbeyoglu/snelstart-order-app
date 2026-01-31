FROM node:18-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter ./packages/shared build
RUN pnpm --filter ./apps/api build

# ------------------

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app .

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]