FROM node:18-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter ./packages/shared build
RUN pnpm --filter ./apps/web build

# ------------------

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80