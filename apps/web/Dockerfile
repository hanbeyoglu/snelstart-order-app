# ---------- BUILD STAGE ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
    
    COPY . .
    
    RUN pnpm install --frozen-lockfile --prod=false
    
    RUN pnpm --filter ./packages/shared build
    RUN pnpm --filter ./apps/web build
    
    
    # ---------- NGINX STAGE ----------
    FROM nginx:alpine
    
    COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
    COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
    
    EXPOSE 80