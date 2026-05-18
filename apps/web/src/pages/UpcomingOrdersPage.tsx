import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import Pagination from '../components/Pagination';

type QuickFilter = '' | 'tomorrow' | 'next3days' | 'next7days' | 'thisweek';

interface UpcomingOrder {
  _id: string;
  orderNumber?: string;
  customerId: string;
  createdByFullName?: string;
  createdByUsername?: string;
  deliveryDate: string;
  deliveryType?: string;
  totalInclVat?: number;
  total?: number;
  status: string;
  daysUntilDelivery: number;
}

function urgencyStyle(days: number) {
  if (days <= 0) {
    return {
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.3)',
      color: '#dc2626',
      label: '🚨',
    };
  }
  if (days === 1) {
    return {
      bg: 'rgba(245,158,11,0.1)',
      border: 'rgba(245,158,11,0.3)',
      color: '#d97706',
      label: '⚠️',
    };
  }
  if (days <= 3) {
    return {
      bg: 'rgba(59,130,246,0.1)',
      border: 'rgba(59,130,246,0.25)',
      color: '#2563eb',
      label: '📅',
    };
  }
  return {
    bg: 'rgba(99,102,241,0.05)',
    border: 'rgba(99,102,241,0.15)',
    color: '#6366f1',
    label: '📋',
  };
}

export default function UpcomingOrdersPage() {
  const { t } = useAppTranslation(['orders', 'common', 'notifications']);
  const { formatCurrency, formatDate } = useLocaleFormat();
  const navigate = useNavigate();

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [deliveryDateFrom, setDeliveryDateFrom] = useState('');
  const [deliveryDateTo, setDeliveryDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [deliveryType, setDeliveryType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  useEffect(() => { setPage(1); }, [quickFilter, deliveryDateFrom, deliveryDateTo, customerId, deliveryType, status, debouncedSearch]);

  const params: Record<string, any> = { page, limit: 20 };
  if (quickFilter) params.quickFilter = quickFilter;
  else {
    if (deliveryDateFrom) params.deliveryDateFrom = deliveryDateFrom;
    if (deliveryDateTo) params.deliveryDateTo = deliveryDateTo;
  }
  if (customerId) params.customerId = customerId;
  if (deliveryType) params.deliveryType = deliveryType;
  if (status) params.status = status;
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-orders', params],
    queryFn: async () => {
      const res = await api.get('/orders/upcoming', { params });
      return res.data as { data: UpcomingOrder[]; pagination: any };
    },
    refetchInterval: 60000,
  });

  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  const quickFilters: { key: QuickFilter; label: string }[] = [
    { key: '', label: t('orders:upcomingFilters.all') },
    { key: 'tomorrow', label: t('orders:upcomingFilters.tomorrow') },
    { key: 'next3days', label: t('orders:upcomingFilters.next3days') },
    { key: 'next7days', label: t('orders:upcomingFilters.next7days') },
    { key: 'thisweek', label: t('orders:upcomingFilters.thisweek') },
  ];

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
                fontWeight: 800,
                margin: '0 0 0.4rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              📅 {t('orders:upcomingTitle')}
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>
              {t('orders:upcomingSubtitle')}
            </p>
          </div>
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary"
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', fontWeight: 600 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {showFilters ? '✕ ' + t('orders:filters.hideFilters') : '⚙️ ' + t('orders:filters.showFilters')}
          </motion.button>
        </div>
      </motion.div>

      {/* Quick Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}
      >
        {quickFilters.map((qf) => (
          <motion.button
            key={qf.key}
            onClick={() => setQuickFilter(qf.key)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '50px',
              border: `1.5px solid ${quickFilter === qf.key ? 'var(--primary)' : 'rgba(99,102,241,0.2)'}`,
              background: quickFilter === qf.key
                ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)'
                : 'white',
              color: quickFilter === qf.key ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: quickFilter === qf.key ? 700 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {qf.label}
          </motion.button>
        ))}
      </motion.div>

      {/* Advanced Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow)',
            border: '1px solid rgba(99,102,241,0.08)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                {t('orders:filters.dateFrom')}
              </label>
              <input
                type="date"
                value={deliveryDateFrom}
                onChange={(e) => { setDeliveryDateFrom(e.target.value); setQuickFilter(''); }}
                className="form-input"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                {t('orders:filters.dateTo')}
              </label>
              <input
                type="date"
                value={deliveryDateTo}
                onChange={(e) => { setDeliveryDateTo(e.target.value); setQuickFilter(''); }}
                className="form-input"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                {t('orders:filters.deliveryType')}
              </label>
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value)}
                className="form-input"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
              >
                <option value="">{t('orders:filters.deliveryTypeAll')}</option>
                <option value="warehouse_pickup">{t('orders:deliveryType.warehouse_pickup')}</option>
                <option value="market_delivery">{t('orders:deliveryType.market_delivery')}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                {t('orders:fields.status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="form-input"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
              >
                <option value="">{t('orders:statusFilter')}</option>
                <option value="PENDING_SYNC">{t('orders:status.pending')}</option>
                <option value="SYNCED">{t('orders:status.synced')}</option>
                <option value="FAILED">{t('orders:status.failed')}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                {t('orders:fields.orderId')}
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('orders:filters.searchPlaceholder')}
                className="form-input"
                style={{ width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <motion.button
              onClick={() => {
                setDeliveryDateFrom(''); setDeliveryDateTo(''); setCustomerId('');
                setDeliveryType(''); setStatus(''); setSearch(''); setDebouncedSearch('');
                setQuickFilter('');
              }}
              className="btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            >
              {t('orders:filters.clearAll')}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: '40px', height: '40px', border: '4px solid rgba(99,102,241,0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }}
          />
          {t('orders:loading')}
        </div>
      )}

      {/* Orders List */}
      {!isLoading && (
        <>
          {orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                background: 'white',
                borderRadius: '20px',
                boxShadow: 'var(--shadow)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                {t('orders:upcomingEmpty')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                {t('orders:upcomingEmptyDesc')}
              </p>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map((order, i) => {
                const urgency = urgencyStyle(order.daysUntilDelivery);
                const total = order.totalInclVat ?? order.total ?? 0;
                return (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/orders/${order._id}`)}
                    style={{
                      background: 'white',
                      borderRadius: '14px',
                      padding: '1rem 1.25rem',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                      border: `1.5px solid ${urgency.border}`,
                      backgroundColor: urgency.bg,
                      cursor: 'pointer',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: '1rem',
                      alignItems: 'center',
                      transition: 'box-shadow 0.15s, transform 0.15s',
                    }}
                    whileHover={{ boxShadow: '0 6px 20px rgba(0,0,0,0.1)', y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {/* Urgency badge */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '64px',
                        background: 'white',
                        border: `1.5px solid ${urgency.border}`,
                        borderRadius: '10px',
                        padding: '0.5rem 0.4rem',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{urgency.label}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: urgency.color, marginTop: '0.2rem' }}>
                        {order.daysUntilDelivery === 0
                          ? t('orders:upcomingDays.today')
                          : order.daysUntilDelivery === 1
                          ? t('orders:upcomingDays.tomorrow')
                          : t('orders:upcomingDays.inDays', { count: order.daysUntilDelivery })}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                          #{order.orderNumber || order._id.slice(-8).toUpperCase()}
                        </span>
                        <span
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '50px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: order.status === 'SYNCED' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                            color: order.status === 'SYNCED' ? '#059669' : '#d97706',
                            border: `1px solid ${order.status === 'SYNCED' ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                          }}
                        >
                          {order.status === 'SYNCED' ? t('orders:status.synced') : order.status === 'PENDING_SYNC' ? t('orders:status.pending') : t('orders:status.failed')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          📦 {order.customerId}
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          🚚 {order.deliveryType === 'warehouse_pickup' ? t('orders:deliveryType.warehouse_pickup') : order.deliveryType === 'market_delivery' ? t('orders:deliveryType.market_delivery') : '—'}
                        </span>
                        {(order.createdByFullName || order.createdByUsername) && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            👤 {order.createdByFullName || order.createdByUsername}
                          </span>
                        )}
                        <span style={{ fontSize: '0.82rem', color: urgency.color, fontWeight: 600 }}>
                          📅 {formatDate(new Date(order.deliveryDate))}
                        </span>
                      </div>
                    </div>

                    {/* Amount + detail */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {formatCurrency(total)}
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                        {t('orders:actions.detail')} →
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
