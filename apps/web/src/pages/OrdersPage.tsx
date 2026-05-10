import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import { useAuthStore } from '../store/authStore';

export default function OrdersPage() {
  const { t } = useAppTranslation(['common', 'orders']);
  const { formatCurrency, locale } = useLocaleFormat();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isCustomer = user?.role === 'customer';
  const ordersScope = user ? `${user.role}:${user.id}` : 'anonymous';
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', ordersScope, statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/orders', { params });
      return response.data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 dakika
    gcTime: 10 * 60 * 1000, // 10 dakika
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Get unique customer IDs from orders
  const customerIds = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    const uniqueIds = new Set<string>();
    orders.forEach((order: any) => {
      if (order.customerId) uniqueIds.add(order.customerId);
    });
    return Array.from(uniqueIds);
  }, [orders]);

  // Fetch customer data for all unique customer IDs
  const { data: customersData } = useQuery({
    queryKey: ['customers-for-orders', customerIds.join(',')],
    queryFn: async () => {
      if (customerIds.length === 0) return {};
      const customersMap: Record<string, any> = {};
      // Fetch all customers in parallel
      await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            const response = await api.get(`/customers/${customerId}`);
            customersMap[customerId] = response.data;
          } catch (error) {
            // If customer not found, just skip
            console.warn(`Customer ${customerId} not found`);
          }
        })
      );
      return customersMap;
    },
    enabled: customerIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 dakika
    gcTime: 30 * 60 * 1000, // 30 dakika
  });

  // Create a map for quick lookup
  const customersMap = customersData || {};

  if (isLoading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '1rem' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '60px',
              height: '60px',
              border: '5px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
            }}
          />
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}
          >
            {t('orders:loading')}
          </motion.p>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'SYNCED':
        return {
          color: 'var(--success)',
          bg: 'rgba(16, 185, 129, 0.1)',
          icon: '✅',
          text: t('orders:status.synced'),
        };
      case 'PENDING_SYNC':
        return {
          color: 'var(--warning)',
          bg: 'rgba(245, 158, 11, 0.1)',
          icon: '⏳',
          text: t('orders:status.pending'),
        };
      case 'FAILED':
        return {
          color: 'var(--danger)',
          bg: 'rgba(239, 68, 68, 0.1)',
          icon: '❌',
          text: t('orders:status.failed'),
        };
      default:
        return {
          color: 'var(--text-secondary)',
          bg: 'rgba(107, 114, 128, 0.1)',
          icon: '📝',
          text: status,
        };
    }
  };

  const getCreatedByName = (order: any) => {
    if (order.createdByRole === 'customer') {
      return order.createdByCustomerName || order.createdByUsername || '-';
    }
    return order.createdByFullName || order.createdByUsername || '-';
  };

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 'clamp(1.5rem, 4vw, 2rem)' }}
      >
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
            fontWeight: 800,
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          {isCustomer ? 'My Orders' : t('orders:title')}
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>
            {t('orders:statusFilter')}:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              minWidth: '200px',
              padding: 'clamp(0.75rem, 2vw, 0.875rem) 1rem',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              minHeight: '44px',
              background: 'white',
            }}
          >
            <option value="">{t('states.all')}</option>
            <option value="DRAFT">📝 {t('orders:status.draft')}</option>
            <option value="PENDING_SYNC">⏳ {t('orders:status.pending')}</option>
            <option value="SYNCED">✅ {t('orders:status.synced')}</option>
            <option value="FAILED">❌ {t('orders:status.failed')}</option>
          </select>
        </div>
      </motion.div>

      {orders && orders.length === 0 ? (
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
            {t('orders:emptyTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.95rem, 3vw, 1.1rem)' }}>
            {t('orders:emptyDescription')}
          </p>
        </motion.div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '950px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  borderBottom: '2px solid var(--border-color)',
                }}
              >
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.orderId')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.customer')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.date')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.status')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.createdBy')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.itemCount')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.total')}
                </th>
                <th
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('orders:fields.snelstartId')}
                </th>
              </tr>
            </thead>
            <tbody>
              {orders?.map((order: any, index: number) => {
                const statusConfig = getStatusConfig(order.status);
                const orderDate = new Date(order.createdAt || order.updatedAt);
                const itemCount = order.items?.filter((item: any) => item.isChildItem !== true).length || 0;
                const totalAmount = order.totalInclVat ?? order.total ?? order.subtotal ?? 0;
                const customer = order.customerId ? customersMap[order.customerId] : null;

                return (
                  <motion.tr
                    key={order._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => navigate(`/orders/${order._id}`)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e: any) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      #{order._id?.slice(-8).toUpperCase() || 'N/A'}
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {customer ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isCustomer) navigate(`/customers/${order.customerId}`);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: isCustomer ? 'default' : 'pointer',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e: any) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                          }}
                          onMouseLeave={(e: any) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{customer.naam}</span>
                          {customer.relatiecode && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              ({customer.relatiecode})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          {order.customerId ? t('states.loading') : t('orders:messages.noCustomer')}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span>{orderDate.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', opacity: 0.7 }}>
                          {orderDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          background: statusConfig.bg,
                          border: `1px solid ${statusConfig.color}`,
                          fontWeight: 600,
                          color: statusConfig.color,
                          fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>{statusConfig.icon}</span>
                        <span>{statusConfig.text}</span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 600 }}>{getCreatedByName(order)}</span>
                        <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--text-secondary)' }}>
                          {order.createdByRole || '-'}
                        </span>
                        {order.createdByRole === 'customer' && order.createdByCustomerName && (
                          <span style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: 'var(--text-secondary)' }}>
                            {order.createdByCustomerName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                      }}
                    >
                      {itemCount}
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        textAlign: 'right',
                        fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {formatCurrency(totalAmount)}
                    </td>
                    <td
                      style={{
                        padding: 'clamp(0.75rem, 2vw, 1rem)',
                        fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {order.snelstartOrderId ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            color: 'var(--success)',
                            fontWeight: 500,
                          }}
                        >
                          ✅ {order.snelstartOrderId.slice(0, 8)}...
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>-</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
