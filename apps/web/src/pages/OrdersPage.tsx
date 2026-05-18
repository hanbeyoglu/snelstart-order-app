import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useOrdersSyncTransitionToasts } from '../hooks/useOrderSyncTransitionToasts';
import {
  buildOrdersListQueryKey,
  isOrderSyncInProgress,
  listResponseHasSyncInProgress,
  logOrdersPollResponse,
  ORDER_LIST_SYNC_POLL_MS,
  type OrdersListQueryParams,
} from '../utils/orderSyncStatus';

type QuickRange = '' | 'today' | 'last7' | 'last30' | 'thisMonth';

interface ReorderResponse {
  sourceOrderId: string;
  sourceOrderNumber?: string;
  customerId: string;
  items: any[];
  skipped: Array<{
    productId?: string;
    productName?: string;
    sku?: string;
    quantity?: number;
    reason: string;
  }>;
  priceUpdates: Array<{
    productId: string;
    productName: string;
    oldUnitPrice: number;
    newUnitPrice: number;
  }>;
  stats: {
    totalSourceItems: number;
    addedCount: number;
    skippedCount: number;
    priceChangedCount: number;
  };
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function OrdersPage() {
  const { t } = useAppTranslation(['common', 'orders']);
  const { formatCurrency, locale } = useLocaleFormat();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isCustomer = user?.role === 'customer';
  const addItemsToCart = useCartStore((state) => state.addItems);
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();

  const ordersScope = user ? `${user.role}:${user.id}` : 'anonymous';

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<string>('');
  const [deliveryTimingFilter, setDeliveryTimingFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [quickRange, setQuickRange] = useState<QuickRange>('');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sort, setSort] = useState<string>('newest');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, deliveryTypeFilter, deliveryTimingFilter, dateFrom, dateTo, debouncedSearch, sort, limit]);

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    const today = new Date();
    if (!range) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    if (range === 'today') {
      const v = toDateInputValue(today);
      setDateFrom(v);
      setDateTo(v);
      return;
    }
    if (range === 'last7') {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      setDateFrom(toDateInputValue(from));
      setDateTo(toDateInputValue(today));
      return;
    }
    if (range === 'last30') {
      const from = new Date(today);
      from.setDate(today.getDate() - 29);
      setDateFrom(toDateInputValue(from));
      setDateTo(toDateInputValue(today));
      return;
    }
    if (range === 'thisMonth') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(toDateInputValue(from));
      setDateTo(toDateInputValue(today));
      return;
    }
  };

  const listQueryParams = useMemo<OrdersListQueryParams>(
    () => ({
      page,
      limit,
      sort,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(deliveryTypeFilter ? { deliveryType: deliveryTypeFilter } : {}),
      ...(deliveryTimingFilter ? { deliveryTiming: deliveryTimingFilter } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [page, limit, sort, statusFilter, deliveryTypeFilter, deliveryTimingFilter, dateFrom, dateTo, debouncedSearch],
  );

  const ordersQueryKey = useMemo(
    () => buildOrdersListQueryKey(ordersScope, listQueryParams),
    [ordersScope, listQueryParams],
  );

  const apiQueryParams = useMemo(
    () => ({
      page: listQueryParams.page,
      limit: listQueryParams.limit,
      sort: listQueryParams.sort,
      ...(listQueryParams.status ? { status: listQueryParams.status } : {}),
      ...(listQueryParams.deliveryType ? { deliveryType: listQueryParams.deliveryType } : {}),
      ...(listQueryParams.deliveryTiming ? { deliveryTiming: listQueryParams.deliveryTiming } : {}),
      ...(listQueryParams.dateFrom ? { dateFrom: listQueryParams.dateFrom } : {}),
      ...(listQueryParams.dateTo ? { dateTo: listQueryParams.dateTo } : {}),
      ...(listQueryParams.search ? { search: listQueryParams.search } : {}),
    }),
    [listQueryParams],
  );

  const { data: ordersResponse, isLoading, isFetching } = useQuery({
    queryKey: ordersQueryKey,
    queryFn: async () => {
      const response = await api.get('/orders', { params: apiQueryParams });
      const data = response.data;
      if (listResponseHasSyncInProgress(data)) {
        logOrdersPollResponse(data);
      }
      return data;
    },
    enabled: !!user,
    staleTime: (query) => (listResponseHasSyncInProgress(query.state.data) ? 0 : 30 * 1000),
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const polling = listResponseHasSyncInProgress(query.state.data);
      if (polling) {
        console.debug('[order-sync-debug] orders polling active');
      }
      return polling ? ORDER_LIST_SYNC_POLL_MS : false;
    },
  });

  const orders: any[] = useMemo(() => {
    if (!ordersResponse) return [];
    if (Array.isArray(ordersResponse)) return ordersResponse;
    return ordersResponse?.data ?? [];
  }, [ordersResponse]);

  const hasSyncInProgressOnPage = useMemo(
    () => orders.some((order) => isOrderSyncInProgress(order.status)),
    [orders],
  );

  useOrdersSyncTransitionToasts(orders, showToast, t);

  const pagination = useMemo(() => {
    if (!ordersResponse || Array.isArray(ordersResponse)) {
      return { total: orders.length, page: 1, limit, totalPages: 1, hasNext: false, hasPrev: false };
    }
    return ordersResponse.pagination || { total: orders.length, page: 1, limit, totalPages: 1, hasNext: false, hasPrev: false };
  }, [ordersResponse, orders.length, limit]);

  const customerIds = useMemo(() => {
    if (isCustomer) return [];
    const ids = new Set<string>();
    orders.forEach((order) => {
      if (order.customerId) ids.add(order.customerId);
    });
    return Array.from(ids);
  }, [orders, isCustomer]);

  const { data: customersData } = useQuery({
    queryKey: ['customers-for-orders', customerIds.join(',')],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const map: Record<string, any> = {};
      await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            const response = await api.get(`/customers/${customerId}`);
            map[customerId] = response.data;
          } catch {
            // ignore
          }
        }),
      );
      return map;
    },
    enabled: customerIds.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const customersMap = customersData || {};

  const reorderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post(`/orders/${orderId}/reorder`);
      return response.data as ReorderResponse;
    },
    onMutate: (orderId: string) => {
      setReorderingId(orderId);
    },
    onSuccess: (result) => {
      const items = (result.items || []).map((item: any) => ({
        ...item,
        totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0),
      }));

      if (items.length === 0) {
        showToast(t('orders:messages.reorderEmpty'), 'warning', 5000);
      } else {
        addItemsToCart(items, { customerId: result.customerId });
        showToast(t('orders:messages.reorderSuccess'), 'success');
        if (result.priceUpdates && result.priceUpdates.length > 0) {
          showToast(t('orders:messages.reorderPricesChanged'), 'info', 5000);
        }
        if (result.skipped && result.skipped.length > 0) {
          showToast(t('orders:messages.reorderSkipped'), 'warning', 5000);
        }
        navigate('/cart');
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error: any) => {
      const apiMessage = error?.response?.data?.message;
      showToast(apiMessage || t('orders:messages.reorderError'), 'error', 5000);
    },
    onSettled: () => {
      setReorderingId(null);
    },
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'SYNCED':
        return { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)', icon: '✅', text: t('orders:status.synced') };
      case 'SYNCING':
      case 'PENDING_SYNC':
        return { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)', icon: '⏳', text: t('orders:status.pending') };
      case 'SYNC_FAILED':
      case 'FAILED':
        return { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)', icon: '❌', text: t('orders:status.syncFailed') };
      default:
        return { color: 'var(--text-secondary)', bg: 'rgba(107, 114, 128, 0.1)', icon: '📝', text: status };
    }
  };

  const getCreatedByName = (order: any) => {
    if (order.createdByRole === 'customer') {
      return order.createdByCustomerName || order.createdByUsername || '-';
    }
    return order.createdByFullName || order.createdByUsername || '-';
  };

  const getOrderNumber = (order: any) => order.orderNumber || `#${order._id?.slice(-8).toUpperCase() || 'N/A'}`;

  const parseMemoDeliveryType = (order: any): string | null => {
    const memo = String(order?.memo || '');
    if (!memo) return null;
    const lower = memo.toLowerCase();
    if (lower.includes('depodan teslim')) {
      return 'warehouse_pickup';
    }
    if (lower.includes('markete teslim')) {
      return 'market_delivery';
    }
    return null;
  };

  const parseMemoDeliveryTiming = (
    order: any,
  ): { timing: 'asap' | 'scheduled' | null; date: string | null } => {
    const memo = String(order?.memo || '');
    if (!memo) return { timing: null, date: null };
    const lower = memo.toLowerCase();
    if (lower.includes('teslimat zamanı: hemen') || lower.includes('teslimat zamani: hemen')) {
      return { timing: 'asap', date: null };
    }
    const match = memo.match(/teslimat zamanı:\s*belirli tarih(?::\s*([0-9]{4}-[0-9]{2}-[0-9]{2}))?/i);
    if (match) {
      return { timing: 'scheduled', date: match[1] || null };
    }
    return { timing: null, date: null };
  };

  const getDeliveryTypeLabel = (order: any) => {
    const type = order?.deliveryType || parseMemoDeliveryType(order);
    if (!type) return '-';
    const key = `orders:deliveryType.${type}` as const;
    return t(key);
  };

  const getDeliveryDateLabel = (order: any) => {
    if (order?.deliveryDate) {
      try {
        const date = new Date(order.deliveryDate);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
        }
      } catch {
        // fallthrough
      }
    }
    const timing = order?.deliveryTiming || parseMemoDeliveryTiming(order).timing;
    const memoDate = parseMemoDeliveryTiming(order).date;
    if (memoDate) {
      try {
        const date = new Date(memoDate);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
        }
      } catch {
        // fallthrough
      }
    }
    if (timing === 'asap') {
      return t('orders:deliveryTiming.asap');
    }
    if (timing === 'scheduled') {
      return t('orders:deliveryTiming.scheduled');
    }
    return '-';
  };

  const clearAllFilters = () => {
    setStatusFilter('');
    setDeliveryTypeFilter('');
    setDeliveryTimingFilter('');
    setDateFrom('');
    setDateTo('');
    setQuickRange('');
    setSearch('');
    setSort('newest');
  };

  const hasActiveFilters =
    !!statusFilter ||
    !!deliveryTypeFilter ||
    !!deliveryTimingFilter ||
    !!dateFrom ||
    !!dateTo ||
    !!debouncedSearch ||
    sort !== 'newest';

  const handleReorder = (orderId: string) => {
    if (reorderMutation.isPending || reorderingId) return;
    reorderMutation.mutate(orderId);
  };

  const showingFrom = orders.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const showingTo = (pagination.page - 1) * pagination.limit + orders.length;

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'clamp(1.5rem, 4vw, 2rem)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                fontWeight: 800,
                margin: 0,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              {isCustomer ? t('orders:myOrdersTitle') : t('orders:title')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: 'clamp(0.9rem, 2.5vw, 1rem)' }}>
              {t('orders:pastOrdersSubtitle')}
            </p>
            {hasSyncInProgressOnPage && isFetching && !isLoading && (
              <p
                style={{
                  marginTop: '0.35rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                aria-live="polite"
              >
                <span
                  style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    borderRadius: '50%',
                    background: 'var(--warning)',
                    opacity: 0.85,
                  }}
                />
                {t('orders:syncStatusRefreshing')}
              </p>
            )}
          </div>
          <motion.button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            whileTap={{ scale: 0.97 }}
            className="btn-secondary"
            style={{ minHeight: '40px', paddingInline: '1rem' }}
          >
            {showFilters ? t('orders:filters.hideFilters') : t('orders:filters.showFilters')}
          </motion.button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card"
            style={{
              padding: 'clamp(1rem, 3vw, 1.5rem)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Search */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {t('orders:filters.searchPlaceholder')}
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('orders:filters.searchPlaceholder')}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  minHeight: '44px',
                  background: 'white',
                }}
              />
            </div>

            {/* Quick filters */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {t('orders:filters.quickFilters')}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {([
                  { value: '', label: t('orders:filters.dateRange') },
                  { value: 'today', label: t('orders:filters.today') },
                  { value: 'last7', label: t('orders:filters.last7Days') },
                  { value: 'last30', label: t('orders:filters.last30Days') },
                  { value: 'thisMonth', label: t('orders:filters.thisMonth') },
                ] as Array<{ value: QuickRange; label: string }>).map((option) => {
                  const active = quickRange === option.value;
                  return (
                    <button
                      key={option.value || 'all'}
                      type="button"
                      onClick={() => applyQuickRange(option.value)}
                      style={{
                        padding: '0.55rem 1rem',
                        borderRadius: '999px',
                        border: active ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: active ? 'rgba(99, 102, 241, 0.12)' : 'white',
                        color: active ? 'var(--primary)' : 'var(--text-primary)',
                        fontWeight: active ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.75rem',
              }}
            >
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:filters.dateFrom')}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setQuickRange(''); }}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:filters.dateTo')}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setQuickRange(''); }}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:fields.status')}
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px', background: 'white' }}
                >
                  <option value="">{t('states.all')}</option>
                  <option value="DRAFT">{t('orders:status.draft')}</option>
                  <option value="PENDING_SYNC">{t('orders:status.pending')}</option>
                  <option value="SYNCED">{t('orders:status.synced')}</option>
                  <option value="SYNC_FAILED">{t('orders:status.syncFailed')}</option>
                  <option value="FAILED">{t('orders:status.failed')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:filters.deliveryType')}
                </label>
                <select
                  value={deliveryTypeFilter}
                  onChange={(e) => setDeliveryTypeFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px', background: 'white' }}
                >
                  <option value="">{t('orders:filters.deliveryTypeAll')}</option>
                  <option value="warehouse_pickup">{t('orders:deliveryType.warehouse_pickup')}</option>
                  <option value="market_delivery">{t('orders:deliveryType.market_delivery')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:filters.deliveryTiming')}
                </label>
                <select
                  value={deliveryTimingFilter}
                  onChange={(e) => setDeliveryTimingFilter(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px', background: 'white' }}
                >
                  <option value="">{t('orders:filters.deliveryTimingAll')}</option>
                  <option value="asap">{t('orders:deliveryTiming.asap')}</option>
                  <option value="scheduled">{t('orders:deliveryTiming.scheduled')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:filters.sortLabel')}
                </label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px', background: 'white' }}
                >
                  <option value="newest">{t('orders:filters.sortNewest')}</option>
                  <option value="oldest">{t('orders:filters.sortOldest')}</option>
                  <option value="total_desc">{t('orders:filters.sortTotalDesc')}</option>
                  <option value="total_asc">{t('orders:filters.sortTotalAsc')}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {t('orders:filters.perPage')}
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 10)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '44px', background: 'white' }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="btn-secondary"
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  {t('orders:filters.clearAll')}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      {isLoading && !ordersResponse ? (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '1rem',
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                background:
                  idx % 2 === 0
                    ? 'linear-gradient(90deg, rgba(99,102,241,0.04), transparent)'
                    : 'transparent',
              }}
            >
              {Array.from({ length: 6 }).map((__, cellIdx) => (
                <div
                  key={cellIdx}
                  style={{
                    flex: 1,
                    height: '20px',
                    borderRadius: '6px',
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.12), rgba(0,0,0,0.06))',
                    backgroundSize: '200% 100%',
                    animation: 'orders-skeleton 1.4s ease-in-out infinite',
                  }}
                />
              ))}
            </div>
          ))}
          <style>
            {`@keyframes orders-skeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}
          </style>
        </div>
      ) : orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{
            textAlign: 'center',
            padding: 'clamp(2rem, 5vw, 4rem) clamp(1rem, 3vw, 2rem)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', marginBottom: '1rem' }}
          >
            📦
          </motion.div>
          <h2 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {isCustomer ? t('orders:emptyTitleCustomer') : t('orders:emptyTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)' }}>
            {hasActiveFilters ? t('orders:emptyFilteredDescription') : t('orders:emptyDescription')}
          </p>
        </motion.div>
      ) : (
        <>
          <div className="card orders-table-card" style={{ padding: 0 }}>
            <table className="orders-table">
              <colgroup>
                <col className="orders-col-order" />
                <col className="orders-col-date" />
                <col className="orders-col-delivery" />
                <col className="orders-col-status" />
                <col className="orders-col-total" />
                {!isCustomer && <col className="orders-col-created-by" />}
                <col className="orders-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>{t('orders:fields.orderNumber')}</th>
                  <th>{t('orders:fields.date')}</th>
                  <th>{t('orders:fields.deliveryDecision')}</th>
                  <th>{t('orders:fields.status')}</th>
                  <th style={{ textAlign: 'right' }}>{t('orders:fields.total')}</th>
                  {!isCustomer && <th>{t('orders:fields.createdBy')}</th>}
                  <th style={{ textAlign: 'right' }} aria-label={t('orders:actions.detail')}>
                    &nbsp;
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const statusConfig = getStatusConfig(order.status);
                  const orderDate = new Date(order.createdAt || order.updatedAt);
                  const itemCount = order.items?.filter((item: any) => item.isChildItem !== true).length || 0;
                  const amount = order.subtotalExclVat ?? order.subtotal ?? 0;
                  const vat = order.vatTotal ?? order.vatAmount ?? 0;
                  const totalAmount = order.totalInclVat ?? order.total ?? amount + vat;
                  const customer = !isCustomer && order.customerId ? customersMap[order.customerId] : null;
                  const deliveryType = getDeliveryTypeLabel(order);
                  const deliveryDate = getDeliveryDateLabel(order);
                  const isReordering = reorderingId === order._id && reorderMutation.isPending;

                  return (
                    <motion.tr
                      key={order._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => navigate(`/orders/${order._id}`)}
                      className="orders-table-row"
                    >
                      <td className="orders-cell-order">
                        <div className="orders-cell-order-number">{getOrderNumber(order)}</div>
                        <div className="orders-cell-order-meta">
                          {itemCount} {t('orders:fields.itemCount').toLocaleLowerCase(locale)}
                          {!isCustomer && customer ? ` • ${customer.naam}` : ''}
                        </div>
                      </td>
                      <td className="orders-cell-date">
                        <div className="orders-cell-date-primary">
                          {orderDate.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="orders-cell-date-secondary">
                          {orderDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="orders-cell-delivery">
                        <div className="orders-cell-delivery-primary">{deliveryType}</div>
                        {deliveryDate !== '-' && (
                          <div className="orders-cell-delivery-secondary">{deliveryDate}</div>
                        )}
                      </td>
                      <td className="orders-cell-status">
                        <span
                          className="orders-status-chip"
                          style={{
                            background: statusConfig.bg,
                            border: `1px solid ${statusConfig.color}`,
                            color: statusConfig.color,
                            transition: 'color 0.25s ease, background 0.25s ease, border-color 0.25s ease',
                          }}
                        >
                          <span aria-hidden="true">{statusConfig.icon}</span>
                          <span>{statusConfig.text}</span>
                        </span>
                      </td>
                      <td className="orders-cell-total">
                        <div className="orders-cell-total-primary">{formatCurrency(totalAmount)}</div>
                        <div className="orders-cell-total-secondary">
                          {formatCurrency(amount)} + {t('orders:fields.vat')} {formatCurrency(vat)}
                        </div>
                      </td>
                      {!isCustomer && (
                        <td className="orders-cell-created-by">
                          <div className="orders-cell-created-by-name">{getCreatedByName(order)}</div>
                          <div className="orders-cell-created-by-role">{order.createdByRole || '-'}</div>
                        </td>
                      )}
                      <td className="orders-cell-actions">
                        <div className="orders-cell-actions-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/orders/${order._id}`);
                            }}
                            className="btn-secondary orders-action-btn"
                          >
                            {t('orders:actions.detail')}
                          </button>
                          {isCustomer && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorder(order._id);
                              }}
                              disabled={isReordering || reorderMutation.isPending}
                              className="btn-primary orders-action-btn"
                              style={{ opacity: isReordering ? 0.7 : 1, cursor: isReordering ? 'wait' : 'pointer' }}
                              aria-label={t('orders:actions.reorder')}
                            >
                              {isReordering ? t('orders:messages.reordering') : t('orders:actions.reorder')}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1rem',
              gap: '1rem',
              flexWrap: 'wrap',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
            }}
          >
            <div>
              {t('orders:pagination.showing', {
                from: showingFrom,
                to: showingTo,
                total: pagination.total,
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={!pagination.hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary"
                style={{ minHeight: '36px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', opacity: pagination.hasPrev ? 1 : 0.5 }}
              >
                ← {t('orders:pagination.previous')}
              </button>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {t('orders:messages.page')} {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary"
                style={{ minHeight: '36px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', opacity: pagination.hasNext ? 1 : 0.5 }}
              >
                {t('orders:pagination.next')} →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
