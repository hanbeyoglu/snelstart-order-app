import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function CustomerDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  const { data: customer, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}`);
      return response.data;
    },
    enabled: !!customerId,
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      const response = await api.get(`/customers/${customerId}/orders`);
      return response.data || [];
    },
    enabled: !!customerId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/customers/${customerId}`);
    },
    onSuccess: () => {
      // Müşteri listesi ve ilgili query'leri invalid et
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders', customerId] });
      showToast('Müşteri başarıyla silindi', 'success');
      navigate('/customers');
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Müşteri silinirken bir hata oluştu';
      showToast(message, 'error');
    },
  });


  if (isLoadingCustomer) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div className="loading" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Müşteri bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <p style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>Müşteri bulunamadı</p>
          <motion.button
            onClick={() => navigate('/customers')}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            whileTap={{ scale: 0.95 }}
          >
            ← Müşterilere Dön
          </motion.button>
        </div>
      </div>
    );
  }


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
        <motion.button
          onClick={() => navigate('/customers')}
          className="btn-secondary"
          style={{ minHeight: '44px' }}
          whileTap={{ scale: 0.98 }}
        >
          ← Geri
        </motion.button>

        <motion.button
          type="button"
          className="btn-primary"
          style={{ minHeight: '44px' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate(`/customers/${customerId}/edit`)}
        >
          Müşteriyi Düzenle
        </motion.button>

        <motion.button
          type="button"
          className="btn-danger"
          style={{ minHeight: '44px' }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (!customerId || deleteMutation.isPending) return;
            setShowDeleteModal(true);
          }}
        >
          {deleteMutation.isPending ? 'Siliniyor...' : 'Müşteriyi Sil'}
        </motion.button>
      </div>

      {/* Silme Onay Modali */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
            onClick={() => !deleteMutation.isPending && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="card"
              style={{
                maxWidth: '420px',
                width: '100%',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-xl)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                  color: 'var(--danger)',
                }}
              >
                Müşteriyi Sil
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                <strong>{customer.naam}</strong> adlı müşteriyi silmek üzeresiniz. Bu işlem geri alınamaz
                ve müşteriye ait yerel kayıtlar da kaldırılacaktır.
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--warning)', marginBottom: '1.25rem' }}>
                SnelStart üzerindeki ilişki de silinir. Emin misiniz?
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
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
                    if (!customerId || deleteMutation.isPending) return;
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

      {/* Müşteri Bilgileri */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ marginBottom: '1.5rem' }}
      >
        <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 700, marginBottom: '1rem' }}>
          {customer.naam}
        </h2>
        
        {/* İlişki Türü */}
        {(customer as any).relatiesoort && (
          <div style={{ marginBottom: '1.5rem' }}>
            <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>
              İlişki Türü:
            </strong>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(Array.isArray((customer as any).relatiesoort)
                ? (customer as any).relatiesoort
                : [(customer as any).relatiesoort]).map((soort: string, index: number) => (
                <span
                  key={index}
                  style={{
                    display: 'inline-block',
                    padding: '0.4rem 0.8rem',
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: 'var(--primary)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {soort}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {customer.relatiecode && (
            <div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Müşteri Kodu:</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>{customer.relatiecode}</p>
            </div>
          )}
          
          {/* Adres Bilgileri */}
          {((customer as any).straat || (customer as any).adres?.straat || customer.adres) && (
            <>
              {(customer as any).straat || (customer as any).adres?.straat ? (
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sokak:</strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>
                    {(customer as any).straat || (customer as any).adres?.straat}
                  </p>
                </div>
              ) : null}
              
              {(customer as any).postcode || (customer as any).adres?.postcode ? (
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Posta Kodu:</strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>
                    {(customer as any).postcode || (customer as any).adres?.postcode}
                  </p>
                </div>
              ) : null}
              
              {(customer as any).plaats || (customer as any).adres?.plaats ? (
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Şehir:</strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>
                    {(customer as any).plaats || (customer as any).adres?.plaats}
                  </p>
                </div>
              ) : null}
              
              {!((customer as any).straat || (customer as any).adres?.straat) && customer.adres && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Adres:</strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>
                    {customer.adres}
                    {customer.postcode && `, ${customer.postcode}`}
                    {customer.plaats && ` ${customer.plaats}`}
                  </p>
                </div>
              )}
            </>
          )}
          
          {customer.telefoon && (
            <div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Telefon:</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>{customer.telefoon}</p>
            </div>
          )}
          
          {customer.email && (
            <div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>E-posta:</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>{customer.email}</p>
            </div>
          )}

          {(customer as any).kvkNummer && (
            <div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>KVK Numara:</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>{(customer as any).kvkNummer}</p>
            </div>
          )}

          {(customer as any).btwNummer && (
            <div>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>BTW Numara:</strong>
              <p style={{ marginTop: '0.25rem', fontSize: '1rem' }}>{(customer as any).btwNummer}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Siparişler */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: 600, marginBottom: '1rem' }}>
          Siparişler ({isLoadingOrders ? '...' : orders?.length || 0})
        </h3>

        {isLoadingOrders ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Siparişler yükleniyor...</p>
          </div>
        ) : !orders || orders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Bu müşteriye ait sipariş bulunamadı.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {orders.map((order: any, index: number) => {
              const isExpanded = expandedOrders.has(order.id);
              const toggleOrder = () => {
                setExpandedOrders((prev) => {
                  const newSet = new Set(prev);
                  if (newSet.has(order.id)) {
                    newSet.delete(order.id);
                  } else {
                    newSet.add(order.id);
                  }
                  return newSet;
                });
              };

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card"
                >
                  {/* Başlık - Tıklanabilir */}
                  <motion.div
                    onClick={toggleOrder}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      margin: '-0.5rem',
                      borderRadius: '8px',
                    }}
                    whileHover={{ background: 'rgba(99, 102, 241, 0.05)' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <motion.span
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ fontSize: '1.2rem', display: 'inline-block' }}
                        >
                          ▶
                        </motion.span>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                          Sipariş #{order.nummer}
                        </h4>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        Tarih: {new Date(order.datum).toLocaleDateString('tr-TR')}
                      </p>
                      {order.modifiedOn && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          Son Güncelleme: {new Date(order.modifiedOn).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        padding: '0.5rem 1rem', 
                        background: order.procesStatus === 'Factuur' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'rgba(99, 102, 241, 0.1)',
                        borderRadius: '8px',
                        display: 'inline-block',
                        marginBottom: '0.5rem',
                      }}>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 600,
                          color: order.procesStatus === 'Factuur' ? 'var(--success)' : 'var(--primary)',
                        }}>
                          {order.procesStatus}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                          Toplam (KDV Hariç):
                        </p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                          €{order.totaalExclusiefBtw?.toFixed(2) || '0.00'}
                        </p>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Toplam (KDV Dahil): €{order.totaalInclusiefBtw?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* İçerik - Açılır Kapanır */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden', marginTop: '1rem' }}
                      >
                        {order.omschrijving && (
                          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            <strong>Açıklama:</strong> {order.omschrijving}
                          </p>
                        )}

                        {/* Sipariş Kalemleri */}
                        {order.regels && order.regels.length > 0 && (
                          <div style={{ marginTop: '1rem' }}>
                            <h5 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Sipariş Kalemleri:</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {order.regels.map((regel: any, regelIndex: number) => (
                                <div
                                  key={regelIndex}
                                  style={{
                                    padding: '0.75rem',
                                    background: 'rgba(99, 102, 241, 0.05)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(99, 102, 241, 0.1)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{regel.omschrijving}</p>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Miktar: {regel.aantal} adet
                                        {regel.kortingsPercentage > 0 && (
                                          <span style={{ marginLeft: '0.5rem', color: 'var(--success)' }}>
                                            (%{regel.kortingsPercentage} indirim)
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Birim Fiyat:</p>
                                      <p style={{ fontWeight: 600 }}>€{regel.stuksprijs?.toFixed(2) || '0.00'}</p>
                                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Toplam:</p>
                                      <p style={{ fontWeight: 700, color: 'var(--primary)' }}>€{regel.totaal?.toFixed(2) || '0.00'}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Adres Bilgileri */}
                        {(order.afleveradres || order.factuuradres) && (
                          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {order.afleveradres && (
                              <div>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Teslimat Adresi:</strong>
                                <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                  {order.afleveradres.straat}
                                  {order.afleveradres.postcode && `, ${order.afleveradres.postcode}`}
                                  {order.afleveradres.plaats && ` ${order.afleveradres.plaats}`}
                                </p>
                              </div>
                            )}
                            {order.factuuradres && (
                              <div>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Fatura Adresi:</strong>
                                <p style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                  {order.factuuradres.straat}
                                  {order.factuuradres.postcode && `, ${order.factuuradres.postcode}`}
                                  {order.factuuradres.plaats && ` ${order.factuuradres.plaats}`}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
