<div align="center">

# DHY Order Platform

### Enterprise-grade B2B ordering platform with SnelStart ERP integration, customer portal, advanced reporting, and resilient sync architecture.

[![CI](https://github.com/hanbeyoglu/snelstart-order-app/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/hanbeyoglu/snelstart-order-app/actions/workflows/deploy.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/backend-NestJS-e0234e.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/frontend-React_18-61dafb.svg)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/database-MongoDB-47A248.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg)](docker-compose.yml)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-f69220.svg)](https://pnpm.io/)
[![Turbo](https://img.shields.io/badge/monorepo-Turborepo-black.svg)](https://turbo.build/)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey.svg)](#license)

</div>

---

# Overview

DHY Order Platform is a modern **B2B wholesale ordering system** built for distributors and internal sales operations.

The platform integrates directly with **SnelStart ERP**, enabling:

- Product synchronization
- Customer-specific pricing
- Order creation
- Operational reporting
- Customer self-service ordering portal
- Role-based administration
- VAT transparency
- Advanced auditability

The application is designed for real operational environments where multiple staff roles, customer accounts, and ERP synchronization workflows must coexist reliably.

---

# Core Features

## B2B Ordering System

- Product catalog synced from SnelStart
- Category management
- Customer-specific pricing context
- Cart & checkout workflows
- ERP-connected order creation
- VAT-aware totals
- Delivery type selection
- Delivery date scheduling
- Order notes & metadata
- Automatic child/sub-product handling
- Customer scoped ordering

---

## Customer Portal

Dedicated portal experience for customers.

Customers can:

- Login securely
- Browse allowed products
- Create orders
- View their own order history
- Manage cart
- See VAT transparency
- Access responsive mobile-friendly ordering flows

Portal users are isolated from internal administration modules.

---

## Staff Backoffice

Internal operational dashboard for:

- Admins
- Sales representatives
- Managers
- Super admins

Includes:

- Customer management
- Product visibility management
- Portal account management
- Reporting
- Analytics
- Audit logs
- Order management
- User & permission management

---

## Advanced Reports & Analytics

Includes operational and financial insights:

- Top-selling products
- Sales trends
- Profit & margin analysis
- VAT reporting
- Best customers
- Order analytics
- Excel export
- Responsive charts & visualizations

---

## Audit Logs

Full operational visibility for sensitive actions:

- User actions
- Order events
- Portal account changes
- Security-sensitive operations
- Authentication events
- Permission changes
- Sync actions

Includes:

- Filtering
- Search
- Timeline-style visualization
- Statistics dashboard

---

## Role & Permission System

### Roles

| Role          | Description                       |
| ------------- | --------------------------------- |
| `super_admin` | Full unrestricted platform access |
| `admin`       | Administrative management access  |
| `sales_rep`   | Sales-focused workflows           |
| `customer`    | Customer portal access only       |

### Capabilities

Permission-based architecture layered on top of roles:

- Product visibility permissions
- Customer visibility restrictions
- Report access
- Portal account management
- Audit access
- User management restrictions

---

# Screenshots

> Replace placeholders inside `docs/screenshots/`

|              Dashboard              |              Products              |
| :---------------------------------: | :--------------------------------: |
| ![](docs/screenshots/dashboard.png) | ![](docs/screenshots/products.png) |

|              Cart              |              Reports              |
| :----------------------------: | :-------------------------------: |
| ![](docs/screenshots/cart.png) | ![](docs/screenshots/reports.png) |

|              Customer Portal              |              Audit Logs              |
| :---------------------------------------: | :----------------------------------: |
| ![](docs/screenshots/customer-portal.png) | ![](docs/screenshots/audit-logs.png) |

|           Mobile Responsive           |
| :-----------------------------------: |
| ![](docs/screenshots/mobile-view.png) |

---

# Tech Stack

## Frontend (`apps/web`)

| Area          | Technology                         |
| ------------- | ---------------------------------- |
| Framework     | React 18                           |
| Language      | TypeScript                         |
| Build Tool    | Vite                               |
| State         | Zustand                            |
| Data Fetching | TanStack Query                     |
| Motion        | Framer Motion                      |
| Charts        | Recharts                           |
| i18n          | react-i18next                      |
| PWA           | vite-plugin-pwa                    |
| Export        | xlsx                               |
| Styling       | Custom responsive CSS architecture |

---

## Backend (`apps/api`)

| Area                  | Technology                 |
| --------------------- | -------------------------- |
| Framework             | NestJS 10                  |
| Database              | MongoDB                    |
| ODM                   | Mongoose 8                 |
| Auth                  | JWT + Passport             |
| Validation            | class-validator            |
| Queue System          | BullMQ                     |
| Cache / Queue Backend | Redis                      |
| Storage               | MinIO / S3 / Cloudflare R2 |
| Monitoring            | Sentry                     |
| API Docs              | Swagger                    |

---

## Worker (`apps/worker`)

Handles asynchronous workloads:

- ERP retry operations
- Queue processing
- Image processing
- Background synchronization jobs
- Heavy async operations

---

## Shared Package (`packages/shared`)

Shared schemas and types:

- Zod schemas
- Shared DTO contracts
- Shared validation utilities
- Shared types between frontend/backend/worker

---

# Architecture

```txt
Browser (React SPA)
        │
        ▼
 NestJS API
        │
 ├──────────────► MongoDB
 │
 ├──────────────► Redis / BullMQ
 │                     │
 │                     ▼
 │                 Worker Service
 │                     │
 │                     ▼
 │               SnelStart API
 │
 └──────────────► Object Storage
                  (MinIO / R2)
```

---

# Monorepo Structure

```txt
snelstart-order-app/
├── apps/
│   ├── api/
│   ├── web/
│   └── worker/
├── packages/
│   └── shared/
├── tests/
│   └── e2e/
├── infra/
├── docker-compose.yml
└── README.md
```

---

# Security

## Authentication

- JWT authentication
- bcrypt password hashing
- Role-based authorization
- Permission guards

---

## Data Protection

- AES-GCM encryption for sensitive integration keys
- Secure environment-based secrets
- DTO validation
- Guard-protected routes

---

## Operational Security

- Audit logging
- Rate limiting
- Permission hierarchy restrictions
- Super admin isolation
- Customer scope enforcement

---

# VAT Transparency

The platform supports transparent VAT calculations.

Per line item:

- VAT percentage
- VAT amount
- Net amount
- Gross amount

Totals:

- Total excluding VAT
- Total VAT
- Grand total including VAT

Designed specifically for B2B operational transparency.

---

# Responsive Design

The platform is designed mobile-first and tablet-friendly.

Optimized for:

- Desktop
- Tablet
- Mobile devices
- Touch-first workflows

Special focus was placed on warehouse, operational, and sales-team usability.

---

# Internationalization

Built-in multilingual architecture.

Current languages:

- English
- Turkish
- Dutch
- German
- Arabic

---

# Installation

## Requirements

| Tool    | Version     |
| ------- | ----------- |
| Node.js | >= 20       |
| pnpm    | 9.x         |
| Docker  | Recommended |

---

## Local Development

```bash
git clone https://github.com/hanbeyoglu/snelstart-order-app.git

cd snelstart-order-app

pnpm install

cp env.example .env
```

---

## Start Infrastructure

```bash
docker compose up -d mongodb redis
```

---

## Start API

```bash
pnpm --filter @snelstart-order-app/api dev
```

---

## Start Worker

```bash
pnpm --filter @snelstart-order-app/worker dev
```

---

## Start Frontend

```bash
pnpm --filter @snelstart-order-app/web dev
```

---

## Full Docker Stack

```bash
docker compose up -d --build
```

---

# API Documentation

Swagger UI:

```txt
http://localhost:3001/api/docs
```

---

# Environment Variables

## Core

| Variable                | Purpose            |
| ----------------------- | ------------------ |
| `PORT`                  | API port           |
| `NODE_ENV`              | Environment        |
| `JWT_SECRET`            | JWT signing secret |
| `ENCRYPTION_MASTER_KEY` | AES encryption key |

---

## Database

| Variable      | Purpose            |
| ------------- | ------------------ |
| `MONGODB_URI` | MongoDB connection |
| `REDIS_HOST`  | Redis host         |
| `REDIS_PORT`  | Redis port         |

---

## SnelStart

| Variable                 | Purpose          |
| ------------------------ | ---------------- |
| `SNELSTART_API_BASE_URL` | SnelStart API    |
| `SNELSTART_API_AUTH_URL` | Auth endpoint    |
| `SNELSTART_CLIENTKEY`    | Client key       |
| `SNELSTART_API_SUB_KEY`  | Subscription key |
| `SNELSTART_MOCK`         | Mock mode        |

---

## Storage

| Variable          | Purpose              |
| ----------------- | -------------------- |
| `MINIO_*`         | MinIO config         |
| `CLOUDFLARE_R2_*` | Cloudflare R2 config |

---

## Monitoring

| Variable               | Purpose              |
| ---------------------- | -------------------- |
| `SENTRY_DSN`           | Error tracking       |
| `UPTIME_KUMA_PUSH_URL` | Heartbeat monitoring |

---

## SMTP

| Variable                    | Purpose                       |
| --------------------------- | ----------------------------- |
| `SMTP_HOST`                 | SMTP server                   |
| `SMTP_PORT`                 | SMTP port                     |
| `SMTP_USER`                 | SMTP username                 |
| `SMTP_PASS`                 | SMTP password                 |
| `SMTP_FROM`                 | Sender address                |
| `ORDER_NOTIFICATION_EMAILS` | Order notification recipients |
| `ORDER_NOTIFICATION_LOCALE`   | Default language for order notification emails (`tr`, `en`, `nl`, `de`, `ar`) when not set in mail settings |

---

# Testing

## Unit Tests

```bash
pnpm --filter @snelstart-order-app/api test
```

---

## Coverage

```bash
pnpm --filter @snelstart-order-app/api test:cov
```

---

## E2E Tests

```bash
pnpm test:e2e
```

---

# CI/CD

GitHub Actions pipeline:

1. Install dependencies
2. Build shared package
3. Build API
4. Run tests
5. Build frontend
6. Run Playwright E2E tests
7. Build worker
8. Deploy via SSH + Docker Compose

Deployment flow:

```bash
git fetch origin main
git reset --hard origin/main

docker compose down --remove-orphans

docker compose up -d --build
```

---

# Health Endpoints

```txt
GET /api/health
GET /api/health/live
GET /api/health/ready
```

---

# Monitoring

| Tool             | Purpose                 |
| ---------------- | ----------------------- |
| Sentry           | Error monitoring        |
| Uptime Kuma      | Uptime monitoring       |
| Health endpoints | Container health checks |

---

# Roadmap

- Payment integrations
- Invoice PDF generation
- Warehouse management
- Multi-tenant support
- Push notifications
- Advanced inventory tracking
- AI-assisted analytics
- Forecasting & purchasing insights

---

# License

This repository is licensed as **Proprietary**.

The source code is publicly visible for portfolio and demonstration purposes, but copying, redistribution, or commercial reuse is prohibited without explicit permission.

---

<div align="center">

### Built for modern B2B wholesale operations.

</div>
