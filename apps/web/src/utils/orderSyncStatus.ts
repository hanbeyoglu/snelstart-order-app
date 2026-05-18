/** Order is being pushed to SnelStart (worker queue / in-flight). */
export function isOrderSyncInProgress(status?: string | null): boolean {
  return status === 'PENDING_SYNC' || status === 'SYNCING';
}

export function isOrderSyncTerminal(status?: string | null): boolean {
  return status === 'SYNCED' || status === 'SYNC_FAILED' || status === 'FAILED';
}

export const ORDER_LIST_SYNC_POLL_MS = 8_000;
export const ORDER_DETAIL_SYNC_POLL_MS = 4_000;

export type OrdersListQueryParams = {
  page: number;
  limit: number;
  sort: string;
  status?: string;
  deliveryType?: string;
  deliveryTiming?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

/** Stable React Query key — primitives only, no object references. */
export function buildOrdersListQueryKey(scope: string, params: OrdersListQueryParams) {
  return [
    'orders',
    scope,
    params.page,
    params.limit,
    params.sort,
    params.status ?? '',
    params.deliveryType ?? '',
    params.deliveryTiming ?? '',
    params.dateFrom ?? '',
    params.dateTo ?? '',
    params.search ?? '',
  ] as const;
}

export function extractOrdersFromListResponse(response: unknown): Array<{ _id?: string; status?: string }> {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  const data = (response as { data?: unknown }).data;
  return Array.isArray(data) ? data : [];
}

export function listResponseHasSyncInProgress(response: unknown): boolean {
  return extractOrdersFromListResponse(response).some((order) => isOrderSyncInProgress(order.status));
}

/** DEBUG: remove after confirming live sync updates */
export function logOrdersPollResponse(response: unknown) {
  const orders = extractOrdersFromListResponse(response);
  const latest = orders[0];
  console.debug('[order-sync-debug] orders poll response', {
    count: orders.length,
    latestOrderId: latest?._id,
    latestStatus: latest?.status,
  });
}

/** DEBUG: remove after confirming live sync updates */
export function logOrderDetailPollResponse(orderId: string | undefined, status?: string) {
  console.debug('[order-sync-debug] order detail poll response', { orderId, status });
}
