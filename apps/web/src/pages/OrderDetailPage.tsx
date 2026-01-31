import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const queryClient = useQueryClient();

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
    enabled: !!order?.snelstartOrderId && !!order?.customerId,
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
    onSuccess: () => {
      showToast('Sipariş başarıyla silindi', 'success');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate('/orders');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Sipariş silinirken bir hata oluştu';
      showToast(errorMessage, 'error', 5000);
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
          <motion.button onClick={() => navigate('/orders')} className="btn-primary" whileTap={{ scale: 0.98 }}>
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
        <motion.button onClick={() => navigate('/orders')} className="btn-secondary" style={{ minHeight: '44px' }} whileTap={{ scale: 0.98 }}>
          ← Geri
        </motion.button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canEdit && (
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
          {canDelete && (
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
          {!canEdit && !canDelete && (
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
        style={{ marginBottom: '1.5rem' }}
      >
        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
          Sipariş Detayları
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
              Sipariş ID
            </label>
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {order._id?.slice(-8).toUpperCase() || 'N/A'}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
              Durum
            </label>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: statusConfig.bg,
                border: `2px solid ${statusConfig.color}`,
                fontWeight: 600,
                color: statusConfig.color,
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              }}
            >
              <span>{statusConfig.icon}</span>
              <span>{statusConfig.text}</span>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
              Oluşturulma Tarihi
            </label>
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {orderDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <p style={{ fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)', color: 'var(--text-secondary)' }}>
              {orderDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {order.snelstartOrderId && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                SnelStart Sipariş ID
              </label>
              <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 500, color: 'var(--text-primary)' }}>
                {order.snelstartOrderId}
              </p>
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
              Müşteri ID
            </label>
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.1rem)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {order.customerId}
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
              Toplam Tutar
            </label>
            <p
              style={{
                fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              €{(order.total || order.subtotal || 0).toFixed(2)}
            </p>
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
          {order.items?.map((item: any, index: number) => (
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
                    €{(item.unitPrice || item.customUnitPrice || 0).toFixed(2)}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)' }}>
                    Toplam
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
                    €{(item.totalPrice || (item.unitPrice || item.customUnitPrice || 0) * item.quantity).toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
