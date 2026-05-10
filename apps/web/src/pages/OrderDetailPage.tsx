import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';

export default function OrderDetailPage() {
  const { t } = useAppTranslation(['cart', 'orders']);
  const { formatCurrency, locale } = useLocaleFormat();
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isCustomer = user?.role === 'customer';

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [canDelete, setCanDelete] = useState(true);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await api.get(`/orders/${orderId}`);
      return response.data;
    },
  });

  // Fetch SnelStart order to check procesStatus
  const { data: snelStartOrder } = useQuery({
    queryKey: ['snelstart-order', order?.snelstartOrderId, order?.customerId],
    queryFn: async () => {
      if (!order?.snelstartOrderId || !order?.customerId) return null;
      try {
        // Fetch orders for this specific customer
        const customerOrdersResponse = await api.get(`/customers/${order.customerId}/orders`);
        const orders = customerOrdersResponse.data || [];
        const foundOrder = orders.find((o: any) => o.id === order.snelstartOrderId);
        return foundOrder || null;
      } catch (error) {
        return null;
      }
    },
    enabled: !isCustomer && !!order?.snelstartOrderId && !!order?.customerId,
  });

  // Check if order can be edited/deleted
  useEffect(() => {
    if (snelStartOrder?.procesStatus === 'Factuur') {
      setCanEdit(false);
      setCanDelete(false);
    } else {
      setCanEdit(true);
      setCanDelete(true);
    }
  }, [snelStartOrder]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/orders/${orderId}`);
      return response.data;
    },
    onMutate: async () => {
      if (!orderId) return undefined;

      await queryClient.cancelQueries({ queryKey: ['orders'] });
      await queryClient.cancelQueries({ queryKey: ['dashboard'] });
      await queryClient.cancelQueries({ queryKey: ['order-stats'] });

      const previousOrders = queryClient.getQueriesData({ queryKey: ['orders'] });
      previousOrders.forEach(([queryKey, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(
          queryKey,
          data.filter((cachedOrder: any) => cachedOrder?._id !== orderId),
        );
      });

      const previousOrder = queryClient.getQueryData(['order', orderId]);
      queryClient.removeQueries({ queryKey: ['order', orderId], exact: true });

      return { previousOrders, previousOrder };
    },
    onSuccess: () => {
      showToast('Sipariş başarıyla silindi', 'success');
      navigate(isCustomer ? '/my-orders' : '/orders', { replace: true });
    },
    onError: (error: any, _variables, context) => {
      context?.previousOrders?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (orderId && context?.previousOrder) {
        queryClient.setQueryData(['order', orderId], context.previousOrder);
      }

      const errorMessage = error?.response?.data?.message || error?.message || 'Sipariş silinirken bir hata oluştu';
      showToast(errorMessage, 'error', 5000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['order-stats'], refetchType: 'all' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await api.put(`/orders/${orderId}`, orderData);
      return response.data;
    },
    onSuccess: () => {
      showToast('Sipariş başarıyla güncellendi', 'success');
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowEditModal(false);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Sipariş güncellenirken bir hata oluştu';
      showToast(errorMessage, 'error', 5000);
    },
  });

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
            Sipariş yükleniyor...
          </motion.p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Sipariş bulunamadı
          </h2>
          <motion.button onClick={() => navigate(isCustomer ? '/my-orders' : '/orders')} className="btn-primary" whileTap={{ scale: 0.98 }}>
            Siparişlere Dön
          </motion.button>
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
          text: 'Senkronize',
        };
      case 'PENDING_SYNC':
        return {
          color: 'var(--warning)',
          bg: 'rgba(245, 158, 11, 0.1)',
          icon: '⏳',
          text: 'Beklemede',
        };
      case 'FAILED':
        return {
          color: 'var(--danger)',
          bg: 'rgba(239, 68, 68, 0.1)',
          icon: '❌',
          text: 'Başarısız',
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

  const statusConfig = getStatusConfig(order.status);
  const orderDate = new Date(order.createdAt || order.updatedAt);
  const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const getOrderLineTotals = (item: any) => {
    const unitPriceExclVat = Number(item.unitPriceExclVat ?? item.unitPrice ?? item.customUnitPrice ?? 0);
    const lineSubtotalExclVat = Number(item.lineSubtotalExclVat ?? item.subtotalExclVat ?? item.totalPrice ?? unitPriceExclVat * Number(item.quantity || 0));
    const vatRate = Number(item.vatRate ?? item.vatPercentage ?? 0) || 0;
    const lineVatAmount = Number(item.lineVatAmount ?? item.vatAmount ?? money((lineSubtotalExclVat * vatRate) / 100));
    const lineTotalInclVat = Number(item.lineTotalInclVat ?? item.totalInclVat ?? money(lineSubtotalExclVat + lineVatAmount));
    return { unitPriceExclVat, lineSubtotalExclVat, vatRate, lineVatAmount, lineTotalInclVat };
  };
  const orderSubtotalExclVat = Number(order.subtotalExclVat ?? order.subtotal ?? 0);
  const orderVatTotal = Number(order.vatTotal ?? order.vatAmount ?? (order.totalInclVat ? order.totalInclVat - orderSubtotalExclVat : 0));
  const orderTotalInclVat = Number(order.totalInclVat ?? order.total ?? orderSubtotalExclVat + orderVatTotal);
  const vatBreakdown = Array.isArray(order.vatBreakdown)
    ? order.vatBreakdown
    : [];
  const createdByName = order.createdByRole === 'customer'
    ? order.createdByCustomerName || order.createdByUsername || '-'
    : order.createdByFullName || order.createdByUsername || '-';
  const orderMemoLines = String(order.memo || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const deliveryDecision = orderMemoLines
    .find((line) => line.toLowerCase().startsWith('teslimat:'))
    ?.replace(/^Teslimat:\s*/i, '') || '-';
  const deliveryTime = orderMemoLines
    .find((line) => line.toLowerCase().startsWith('teslimat zamanı:'))
    ?.replace(/^Teslimat zamanı:\s*/i, '') || '-';
  const orderDetailItems = [
    {
      label: 'Oluşturulma Tarihi',
      value: orderDate.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }),
      helper: orderDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    },
    {
      label: t('orders:fields.createdBy'),
      value: createdByName,
      helper: order.createdByRole || '-',
    },
    ...(order.createdByRole === 'customer'
      ? [
          {
            label: t('orders:fields.createdByCustomer'),
            value: order.createdByCustomerName || order.createdByCustomerId || '-',
            helper: order.createdByCustomerId || undefined,
          },
        ]
      : []),
    ...(order.snelstartOrderId
      ? [
          {
            label: 'SnelStart Sipariş ID',
            value: order.snelstartOrderId,
            helper: 'Senkron referansı',
          },
        ]
      : []),
    {
      label: 'Müşteri ID',
      value: order.customerId,
      helper: 'Relatie',
    },
  ];

  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
          flexWrap: 'wrap',
        }}
      >
        <motion.button onClick={() => navigate(isCustomer ? '/my-orders' : '/orders')} className="btn-secondary" style={{ minHeight: '44px' }} whileTap={{ scale: 0.98 }}>
          ← Geri
        </motion.button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isCustomer && canEdit && (
            <motion.button
              type="button"
              className="btn-primary"
              style={{ minHeight: '44px' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowEditModal(true)}
            >
              Siparişi Düzenle
            </motion.button>
          )}
          {!isCustomer && canDelete && (
            <motion.button
              type="button"
              className="btn-danger"
              style={{ minHeight: '44px' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDeleteModal(true)}
            >
              Siparişi Sil
            </motion.button>
          )}
          {!isCustomer && !canEdit && !canDelete && (
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '2px solid var(--warning)',
                borderRadius: '8px',
                color: 'var(--warning)',
                fontWeight: 600,
                fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
              }}
            >
              ⚠️ Faturalanmış sipariş düzenlenemez/silinemez
            </div>
          )}
        </div>
      </div>

      {/* Düzenleme Modali */}
      <AnimatePresence>
        {showEditModal && order && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !updateMutation.isPending && setShowEditModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                maxWidth: '600px',
                width: '100%',
                padding: 'clamp(1.5rem, 4vw, 2rem)',
                background: 'white',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <h3 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 700, marginBottom: '1rem' }}>
                Siparişi Düzenle
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                ⚠️ Sipariş düzenleme özelliği şu anda sınırlıdır. Sipariş kalemlerini değiştirmek için yeni bir sipariş oluşturmanız önerilir.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={updateMutation.isPending}
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  İptal
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    // For now, just close the modal
                    // In the future, this can be expanded to allow editing order items
                    showToast('Sipariş düzenleme özelliği yakında eklenecek', 'info');
                    setShowEditModal(false);
                  }}
                  disabled={updateMutation.isPending}
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Silme Onay Modali */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !deleteMutation.isPending && setShowDeleteModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                maxWidth: '500px',
                width: '100%',
                padding: 'clamp(1.5rem, 4vw, 2rem)',
                background: 'white',
              }}
            >
              <h3 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.3rem)', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--danger)' }}>
                Siparişi Sil
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Sipariş #{order._id?.slice(-8).toUpperCase()} adlı siparişi silmek üzeresiniz. Bu işlem geri alınamaz.
              </p>
              {order.snelstartOrderId && (
                <p style={{ fontSize: '0.85rem', color: 'var(--warning)', marginBottom: '1.25rem' }}>
                  ⚠️ Bu sipariş SnelStart ile senkronize edilmiş. Sipariş SnelStart üzerinden de silinebilir.
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleteMutation.isPending}
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (!orderId || deleteMutation.isPending) return;
                    deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  {deleteMutation.isPending ? 'Siliniyor...' : 'Evet, Sil'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sipariş Detayları */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{
          marginBottom: '1.5rem',
          padding: 0,
          overflow: 'hidden',
          border: '1px solid rgba(99, 102, 241, 0.16)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div
          style={{
            padding: 'clamp(1.25rem, 4vw, 2rem)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.1) 100%)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.14)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                Sipariş Detayları
              </div>
              <h2 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.35rem)', fontWeight: 900, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                #{order._id?.slice(-8).toUpperCase() || 'N/A'}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.65rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '999px',
                  background: statusConfig.bg,
                  border: `1px solid ${statusConfig.color}`,
                  fontWeight: 800,
                  color: statusConfig.color,
                  fontSize: '0.9rem',
                }}
              >
                <span>{statusConfig.icon}</span>
                <span>{statusConfig.text}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>{t('cart:totalAmount')}</div>
                <div style={{ fontSize: 'clamp(1.45rem, 4vw, 2rem)', fontWeight: 900, color: 'var(--primary)' }}>
                  {formatCurrency(orderTotalInclVat)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.9rem',
              marginBottom: '1rem',
            }}
          >
            <div
              style={{
                padding: '1rem',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                border: '1px solid rgba(16, 185, 129, 0.22)',
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                {t('orders:fields.deliveryDecision')}
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 850 }}>
                {deliveryDecision}
              </div>
            </div>
            <div
              style={{
                padding: '1rem',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(99, 102, 241, 0.04))',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                {t('orders:fields.deliveryTime')}
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 850 }}>
                {deliveryTime}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
            {orderDetailItems.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                style={{
                  padding: '1rem',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.78)',
                  border: '1px solid rgba(148, 163, 184, 0.18)',
                  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)',
                  minWidth: 0,
                }}
              >
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.45rem' }}>
                  {item.label}
                </div>
                <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 750, overflowWrap: 'anywhere' }}>
                  {item.value}
                </div>
                {item.helper && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem', overflowWrap: 'anywhere' }}>
                    {item.helper}
                  </div>
                )}
              </div>
            ))}
          </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            padding: '1rem',
            border: '1px solid rgba(99, 102, 241, 0.14)',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.06))',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('cart:amount')}</div>
            <div style={{ fontWeight: 800 }}>{formatCurrency(orderSubtotalExclVat)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('cart:vat')}</div>
            <div style={{ fontWeight: 800 }}>{formatCurrency(orderVatTotal)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>{t('cart:totalAmount')}</div>
            <div style={{ fontWeight: 900 }}>{formatCurrency(orderTotalInclVat)}</div>
          </div>
          {vatBreakdown.map((line: any) => (
            <div key={line.vatRate}>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                {t('cart:vatRate', { rate: line.vatRate })}
              </div>
              <div style={{ fontWeight: 800 }}>{formatCurrency(line.vatAmount || 0)}</div>
            </div>
          ))}
        </div>
        </div>

        {order.errorMessage && (
          <div
            style={{
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: '1.5rem',
            }}
          >
            <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>
              ❌ Hata: {order.errorMessage}
            </p>
          </div>
        )}
      </motion.div>

      {/* Sipariş Kalemleri */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
          Sipariş Kalemleri ({order.items?.length || 0})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {order.items?.map((item: any, index: number) => {
            const lineTotals = getOrderLineTotals(item);
            return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.1)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    Ürün Adı
                  </label>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.productName || 'Bilinmeyen Ürün'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    SKU
                  </label>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.sku || item.productId || 'N/A'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    Miktar
                  </label>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.quantity}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    Birim Fiyat
                  </label>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {formatCurrency(lineTotals.unitPriceExclVat)} {t('cart:exclVat')}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    {t('cart:lineTotal')}
                  </label>
                  <p
                    style={{
                      fontSize: 'clamp(1.1rem, 3vw, 1.25rem)',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {formatCurrency(lineTotals.lineSubtotalExclVat)}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    {t('cart:vatRate', { rate: lineTotals.vatRate })}
                  </label>
                  <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatCurrency(lineTotals.lineVatAmount)}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    {t('cart:inclVat')}
                  </label>
                  <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.25rem)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatCurrency(lineTotals.lineTotalInclVat)}
                  </p>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
