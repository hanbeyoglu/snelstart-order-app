FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/worker/package*.json ./apps/worker/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build shared package first, then worker
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/worker

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/worker/package*.json ./apps/worker/
COPY packages/shared/package*.json ./packages/shared/

# Install production dependencies
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]

