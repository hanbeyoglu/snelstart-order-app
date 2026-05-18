import { useEffect, useRef } from 'react';
import { isOrderSyncInProgress } from '../utils/orderSyncStatus';

type ToastFn = (message: string, type: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type SyncToastOptions = {
  customerFacing?: boolean;
};

function notifySyncTerminalTransition(
  prevStatus: string,
  currentStatus: string,
  showToast: ToastFn,
  t: TranslateFn,
  options?: SyncToastOptions,
) {
  if (!isOrderSyncInProgress(prevStatus)) return;

  if (currentStatus === 'SYNCED') {
    showToast(
      t(options?.customerFacing ? 'orders:messages.syncSuccessCustomer' : 'orders:messages.syncSuccess'),
      'success',
      4000,
    );
    return;
  }

  if (currentStatus === 'SYNC_FAILED' || currentStatus === 'FAILED') {
    showToast(
      t(options?.customerFacing ? 'orders:messages.syncFailedCustomer' : 'orders:messages.syncFailed'),
      'error',
      5000,
    );
  }
}

/** Fire at-most-once toasts when orders in a list leave in-progress sync state. */
export function useOrdersSyncTransitionToasts(
  orders: Array<{ _id?: string; status?: string }>,
  showToast: ToastFn,
  t: TranslateFn,
  options?: SyncToastOptions,
) {
  const prevStatusByIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const order of orders) {
      const id = order._id ? String(order._id) : '';
      if (!id) continue;

      const prevStatus = prevStatusByIdRef.current.get(id);
      const currentStatus = String(order.status || '');

      if (prevStatus !== undefined) {
        notifySyncTerminalTransition(prevStatus, currentStatus, showToast, t, options);
      }

      prevStatusByIdRef.current.set(id, currentStatus);
    }
  }, [orders, showToast, t, options?.customerFacing]);
}

/** Fire at-most-once toasts when a single order detail leaves in-progress sync state. */
export function useOrderDetailSyncTransitionToast(
  orderId: string | undefined,
  status: string | undefined,
  showToast: ToastFn,
  t: TranslateFn,
  options?: SyncToastOptions,
) {
  const prevStatusRef = useRef<string | undefined>();

  useEffect(() => {
    if (!orderId || !status) return;

    const prevStatus = prevStatusRef.current;
    if (prevStatus !== undefined) {
      notifySyncTerminalTransition(prevStatus, status, showToast, t, options);
    }

    prevStatusRef.current = status;
  }, [orderId, status, showToast, t, options?.customerFacing]);
}
