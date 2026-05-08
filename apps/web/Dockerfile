# ---------- BUILD STAGE ----------
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --prod=false --filter @snelstart-order-app/web...

COPY . .

RUN pnpm --filter ./packages/shared build
RUN pnpm --filter ./apps/web exec node -e "require.resolve('vite-plugin-pwa')"
RUN pnpm --filter ./apps/web build


# ---------- NGINX STAGE ----------
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
