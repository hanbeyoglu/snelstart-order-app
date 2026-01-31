import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';

type Period = 'daily' | 'weekly' | 'monthly';

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('daily');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => {
      const response = await api.get('/orders/dashboard', { params: { period } });
      return response.data;
    },
  });

  const periodLabels = {
    daily: 'Günlük',
    weekly: 'Haftalık',
    monthly: 'Aylık',
  };

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
            Dashboard yükleniyor...
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 5vw, 3rem)',
              fontWeight: 800,
              marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)' }}>
            {periodLabels[period]} özet ve istatistikler
          </p>
        </div>

        {/* Period Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'white', padding: '0.5rem', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <motion.button
              key={p}
              onClick={() => setPeriod(p)}
              className={period === p ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {periodLabels[p]}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }} className="responsive-grid">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '2px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
          <h3 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            {stats?.totalOrders || 0}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Toplam Sipariş</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💰</div>
          <h3
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: 700,
              marginBottom: '0.25rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            €{stats?.totalRevenue?.toFixed(2) || '0.00'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Toplam Gelir</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.1) 100%)',
            border: '2px solid rgba(236, 72, 153, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
          <h3 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            {stats?.visitedCustomers?.length || 0}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Gidilen Müşteri</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
            border: '2px solid rgba(245, 158, 11, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
          <h3 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
            {stats?.plannedCustomers?.length || 0}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Planlanan Müşteri</p>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="dashboard-customers-grid">
        {/* Gidilen Müşteriler */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h2
            style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
              fontWeight: 700,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>✅</span>
            <span>Gidilen Müşteriler</span>
          </h2>
          {stats?.visitedCustomers && stats.visitedCustomers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
              {stats.visitedCustomers.map((customer: any, index: number) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  style={{
                    padding: '1rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 'clamp(45px, 8vw, 50px)',
                      height: 'clamp(45px, 8vw, 50px)',
                      minWidth: '45px',
                      minHeight: '45px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: 700,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {customer.naam?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                      {customer.naam}
                    </p>
                    {customer.relatiecode && (
                      <p style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>Kod: {customer.relatiecode}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              Bu dönemde gidilen müşteri yok
            </p>
          )}
        </motion.div>

        {/* Gidilmesi Planlanan Müşteriler */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h2
            style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
              fontWeight: 700,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>📅</span>
            <span>Gidilmesi Planlanan Müşteriler</span>
          </h2>
          {stats?.plannedCustomers && stats.plannedCustomers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
              {stats.plannedCustomers.map((customer: any, index: number) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  style={{
                    padding: '1rem',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(217, 119, 6, 0.05) 100%)',
                    borderRadius: '12px',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 'clamp(45px, 8vw, 50px)',
                      height: 'clamp(45px, 8vw, 50px)',
                      minWidth: '45px',
                      minHeight: '45px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: 700,
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {customer.naam?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                      {customer.naam}
                    </p>
                    {customer.relatiecode && (
                      <p style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>Kod: {customer.relatiecode}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              Planlanan müşteri yok
            </p>
          )}
        </motion.div>
      </div>

      {/* Siparişler (Müşteri Bazında) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card"
        style={{ marginTop: '2rem' }}
      >
        <h2
            style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
              fontWeight: 700,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>📊</span>
            <span>Müşteri Bazında Siparişler</span>
          </h2>
        {stats?.ordersByCustomer && stats.ordersByCustomer.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.ordersByCustomer.map((item: any, index: number) => (
              <motion.div
                key={item.customerId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + index * 0.05 }}
                style={{
                  padding: '1.25rem',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                  borderRadius: '16px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                whileHover={{ scale: 1.02, borderColor: 'rgba(99, 102, 241, 0.4)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'white',
                    }}
                  >
                    {item.customerName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {item.customerName}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {item.count} {item.count === 1 ? 'sipariş' : 'sipariş'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    €{item.total.toFixed(2)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            Bu dönemde sipariş yok
          </p>
        )}
      </motion.div>

      {/* En Çok Sipariş Edilen Ürünler */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="card"
        style={{ marginTop: '2rem' }}
      >
        <h2
            style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
              fontWeight: 700,
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>🏆</span>
            <span>En Çok Sipariş Edilen Ürünler</span>
          </h2>
        {stats?.topProducts && stats.topProducts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {stats.topProducts.map((product: any, index: number) => (
              <motion.div
                key={product.productId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + index * 0.05 }}
                style={{
                  padding: '1.25rem',
                  background: index < 3
                    ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)'
                    : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                  borderRadius: '16px',
                  border: index < 3 ? '2px solid rgba(251, 191, 36, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
                whileHover={{ scale: 1.02 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '200px' }}>
                  <div
                    style={{
                      width: 'clamp(40px, 8vw, 50px)',
                      height: 'clamp(40px, 8vw, 50px)',
                      borderRadius: '12px',
                      background: index < 3
                        ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(1rem, 3vw, 1.5rem)',
                      fontWeight: 700,
                      color: 'white',
                    }}
                  >
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 'clamp(1rem, 2.5vw, 1.1rem)', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      {product.productName}
                    </p>
                    <p style={{ fontSize: 'clamp(0.85rem, 2vw, 0.9rem)', color: 'var(--text-secondary)' }}>
                      {product.count} {product.count === 1 ? 'sipariş' : 'sipariş'}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {product.totalQuantity} adet
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            Bu dönemde sipariş edilen ürün yok
          </p>
        )}
      </motion.div>
    </div>
  );
}

