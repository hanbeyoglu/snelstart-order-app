# SnelStart Order App

Production-ready monorepo for a mobile/tablet-first B2B wholesale ordering app that integrates with SnelStart B2B API.

## 🏗️ Architecture

- **Frontend**: React.js + TypeScript, PWA, mobile/tablet responsive UI
- **Backend**: NestJS (Node.js + TypeScript)
- **Worker**: BullMQ (Redis-backed job queue)
- **Database**: MongoDB
- **Cache**: Redis
- **Storage**: MinIO (S3-compatible)

## 📁 Project Structure

```
snelstart-order-app/
├── apps/
│   ├── api/          # NestJS backend API
│   ├── web/          # React frontend
│   └── worker/       # BullMQ worker
├── packages/
│   └── shared/       # Shared types and validators
└── infra/
    └── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- MongoDB, Redis, MinIO (or use Docker Compose)

### Local Development

1. **Clone and install dependencies:**

```bash
pnpm install
```

2. **Set up environment variables:**

Copy `env.example` to `.env` in the root directory and configure:

```bash
cp env.example .env
```

3. **Start infrastructure services:**

```bash
docker-compose up -d mongodb redis minio
```

4. **Start development servers:**

```bash
# Terminal 1: API
cd apps/api
pnpm run dev

# Terminal 2: Worker
cd apps/worker
pnpm run dev

# Terminal 3: Web
cd apps/web
pnpm run dev
```

5. **Access the application:**

- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Docs: http://localhost:3001/api/docs
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

### Docker Compose (Production-like)

```bash
docker-compose up -d
```

This starts all services:

- Web (port 3000)
- API (port 3001)
- Worker
- MongoDB (port 27017)
- Redis (port 6379)
- MinIO (ports 9000, 9001)

## 🔧 Configuration

### SnelStart API Integration

1. **Mock Mode (Development):**

Set `SNELSTART_MOCK=true` in `.env` to use mock data without real API keys.

2. **Production Mode:**

1. Get your SnelStart API keys:
   - Subscription Key
   - Integration Key

1. Login as admin and navigate to **Admin > SnelStart Connection Settings**

1. Enter your keys and test the connection

### Environment Variables

See `env.example` for all available environment variables.

**Important:**

- `JWT_SECRET`: Change in production
- `ENCRYPTION_MASTER_KEY`: Change in production (used to encrypt SnelStart keys)
- `SNELSTART_MOCK`: Set to `false` in production

## 📋 Features

### ✅ Implemented

- ✅ Dynamic categories menu from SnelStart product groups
- ✅ Product listing with search (name, SKU, barcode)
- ✅ Product images with MinIO storage
- ✅ Price override engine (multiple rule types)
- ✅ Customer management (list, search, create)
- ✅ Shopping cart
- ✅ Order creation with SnelStart sync
- ✅ Resilient order sync with retry logic
- ✅ Redis caching
- ✅ API rate limiting and concurrency control
- ✅ Admin settings for SnelStart connection
- ✅ Audit logging
- ✅ PWA support

### 🔄 Order Sync Flow

1. User creates order → Stored locally as `PENDING_SYNC`
2. API attempts immediate sync to SnelStart
3. If sync fails → Job enqueued in BullMQ
4. Worker retries with exponential backoff
5. After max retries → Order marked as `FAILED`
6. Admin can manually retry failed orders

## 🧪 Testing

### Unit Tests

```bash
cd apps/api
pnpm test
```

### Integration Tests

See `INTEGRATION_CHECKLIST.md` for SnelStart API integration details.

## 📚 API Documentation

Swagger/OpenAPI docs available at:

- Development: http://localhost:3001/api/docs

## 🔐 Security

- JWT authentication
- Encrypted storage of SnelStart API keys (AES-256-GCM)
- Role-based access control (admin, sales_rep)
- Input validation (Zod/class-validator)

## 📦 Deployment

### Build

```bash
pnpm run build
```

### Docker

```bash
cd infra
docker-compose build
docker-compose up -d
```

## 🐛 Troubleshooting

### MongoDB Connection Issues

Ensure MongoDB is running:

```bash
docker-compose ps mongodb
```

### Redis Connection Issues

Check Redis:

```bash
docker-compose ps redis
redis-cli ping
```

### MinIO Access

- Console: http://localhost:9001
- Credentials: minioadmin/minioadmin (change in production)

## 📝 License

Proprietary

## 👥 Support

For issues and questions, contact the development team.
