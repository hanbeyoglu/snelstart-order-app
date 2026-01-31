FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build shared package first, then api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/apps/api

EXPOSE 3001

# NestJS workspace build creates dist/apps/api/src/main.js, adjust path
CMD ["node", "dist/apps/api/src/main.js"]

