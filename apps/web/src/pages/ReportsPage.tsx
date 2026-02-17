import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';

type ReportMode = 'orders' | 'top-products';
type PurchasePriceFilter = 'all' | 'with-price' | 'without-price';

interface ReportOrder {
  id: string;
  orderNo?: string;
  customerId: string;
  customerName: string;
  date: string;
  total: number;
  procesStatus?: string;
}

interface ReportTopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  salesPrice: number;
  purchasePrice: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'EUR',
  }).format(val);
}

const PAGE_SIZES = [25, 50, 100, 200, 500];

export default function ReportsPage() {
  const [mode, setMode] = useState<ReportMode>('orders');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [purchasePriceFilter, setPurchasePriceFilter] = useState<PurchasePriceFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reports', mode, startDate, endDate, page, pageSize, purchasePriceFilter],
    queryFn: async () => {
      const skip = (page - 1) * pageSize;
      const params: Record<string, string | number> = {
        type: mode,
        skip,
        top: pageSize,
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (mode === 'top-products') params.purchasePriceFilter = purchasePriceFilter;
      const response = await api.get('/reports/orders', { params });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    setPage(1);
  }, [mode, startDate, endDate, purchasePriceFilter, pageSize]);

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
            Raporlar yükleniyor...
          </motion.p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errMsg = (error as any)?.response?.status === 404
      ? 'Bu sayfa bulunamadı.'
      : (error as any)?.response?.data?.message || (error as Error)?.message || 'Bir hata oluştu.';
    return (
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.08) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Hata</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{errMsg}</p>
        </motion.div>
      </div>
    );
  }

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const orders = mode === 'orders' ? (items as ReportOrder[]) : null;
  const topProducts = mode === 'top-products' ? (items as ReportTopProduct[]) : null;

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem' }}
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
          Raporlar
        </h1>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Rapor Türü:
            </label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as ReportMode);
                setPage(1);
              }}
              style={{
                minWidth: '200px',
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.95rem',
                background: 'white',
              }}
            >
              <option value="orders">Siparişler</option>
              <option value="top-products">En Çok Satan Ürünler</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Başlangıç:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.95rem',
              }}
            />
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
              Bitiş:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.95rem',
              }}
            />
          </div>

          {mode === 'top-products' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Alış fiyatı filtresi:
                </label>
                <select
                  value={purchasePriceFilter}
                  onChange={(e) => {
                    setPurchasePriceFilter(e.target.value as PurchasePriceFilter);
                    setPage(1);
                  }}
                  style={{
                    minWidth: '200px',
                    padding: '0.5rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    background: 'white',
                  }}
                >
                  <option value="all">Tümü</option>
                  <option value="with-price">Sadece alış fiyatı olanlar</option>
                  <option value="without-price">Sadece alış fiyatı olmayanlar</option>
                </select>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={purchasePriceFilter === 'without-price'}
                  onChange={(e) => {
                    setPurchasePriceFilter(e.target.checked ? 'without-price' : 'all');
                    setPage(1);
                  }}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                <span>Alış fiyatı olmayan ürünleri göster</span>
              </label>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <label style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Sayfa başına:
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.95rem',
                background: 'white',
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {mode === 'orders' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{ overflowX: 'auto', padding: 0 }}
        >
          {!orders || orders.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Belirtilen tarih aralığında sipariş bulunamadı.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Sipariş No</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Müşteri</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Tarih</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>{o.orderNo || o.id}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{o.customerName}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{formatDate(o.date)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(orders?.length ?? 0) > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {startItem}-{endItem} / {totalCount} sipariş
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => goToPage(1)}
                  disabled={page <= 1}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  ««
                </button>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  «
                </button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
                  Sayfa {page} / {totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  »
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={page >= totalPages}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {mode === 'top-products' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{ overflowX: 'auto', padding: 0 }}
        >
          {!topProducts || topProducts.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Belirtilen tarih aralığında ürün satış verisi bulunamadı.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Ürün Adı</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Toplam Miktar</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Satış Fiyatı</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Alış Fiyatı</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Gelir</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Maliyet</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Kar</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>{p.productName}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{p.totalQuantity}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(p.salesPrice)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(p.purchasePrice)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(p.totalRevenue)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(p.totalCost)}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: p.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {formatCurrency(p.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {(topProducts?.length ?? 0) > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {startItem}-{endItem} / {totalCount} ürün
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => goToPage(1)}
                  disabled={page <= 1}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  ««
                </button>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.5 : 1,
                  }}
                >
                  «
                </button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>
                  Sayfa {page} / {totalPages}
                </span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  »
                </button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={page >= totalPages}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    background: 'white',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages ? 0.5 : 1,
                  }}
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
