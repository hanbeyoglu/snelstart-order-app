---
name: async-order-sync-architecture
description: Order creation is fully async — POST /orders returns immediately, SnelStart sync happens in BullMQ worker. Fixed 504 timeouts on large orders.
metadata:
  type: project
---

Order creation is now fully async — `createOrder()` never calls SnelStart synchronously.

**Flow:**
1. POST /orders → saves LocalOrder (status: PENDING_SYNC) → enqueues `order-sync` BullMQ job → returns immediately (<1s)
2. Worker (`apps/worker`) processes the job: calls SnelStart OAuth token exchange then POST /v2/verkooporders
3. On success: order → SYNCED. API's `OrderSyncEventsListener` (QueueEvents) fires email notification
4. On worker exhaustion (5 retries): order → FAILED, can retry via admin UI

**Why:** Large orders (100+ lines) caused 504 timeouts because the previous code awaited SnelStart inline in the HTTP request. Order was created in SnelStart but user saw failure — duplicate risk.

**How to apply:**
- `createOrder()` must never re-add synchronous SnelStart calls
- Job deduplication: `jobId: order-sync-${orderId}` prevents double-enqueue on client retries
- `retryOrder()` uses no jobId (auto-generated) so admin can always re-queue
- Email goes AFTER sync success (via `OrderSyncEventsListener` for worker path, via `notifyOrderSynced()` for API retry path)
- 504/503/ECONNABORTED errors in CartPage are treated as success (redirect to orders page)

**Worker bug fixed:** Worker previously used wrong SnelStart payload format (snake_case vs nested objects) and wrong auth (raw integrationKey as Bearer instead of OAuth token exchange). Both fixed in `apps/worker/src/processors/order-sync.processor.ts`.

**Key files:**
- `apps/api/src/orders/orders.service.ts` — createOrder, syncOrderToSnelStart, notifyOrderSynced
- `apps/api/src/orders/order-sync-events.listener.ts` — NEW: QueueEventsListener for post-sync email
- `apps/api/src/orders/orders.module.ts` — registerQueueEvents added
- `apps/worker/src/processors/order-sync.processor.ts` — fixed payload + OAuth auth
- `apps/web/src/pages/CartPage.tsx` — 504 treated as success, new submittingOrder loading text
