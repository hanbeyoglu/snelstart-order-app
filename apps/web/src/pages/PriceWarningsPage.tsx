import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface PriceWarningProduct {
  id: string;
  omschrijving: string;
  artikelnummer?: string;
  verkoopprijs: number;
  inkoopprijs: number;
  minPrice: number;
  marginPct: number;
  warningType: 'zarar' | 'dusuk-marj';
  artikelgroepOmschrijving?: string;
  voorraad?: number;
  coverImageUrl?: string | null;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'EUR',
  }).format(val);
}

const PAGE_SIZES = [25, 50, 100];

export default function PriceWarningsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['price-warnings', page, pageSize],
    queryFn: async () => {
      const response = await api.get('/products/price-warnings', {
        params: { page, limit: pageSize },
      });
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const items: PriceWarningProduct[] = data?.data ?? [];
  const pagination = data?.pagination ?? {};
  const total = pagination.total ?? 0;
  const totalPages = pagination.totalPages ?? 1;
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

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
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const errMsg = (error as any)?.response?.data?.message || (error as Error)?.message || 'Bir hata oluştu.';
    return (
      <div className="container">
        <motion.div
          className="card"
          style={{ padding: '2rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)' }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--danger)' }}>Hata</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{errMsg}</p>
        </motion.div>
      </div>
    );
  }

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
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Fiyat Uyarıları
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Satış fiyatı alış fiyatından düşük veya kar marjı %5 altında olan ürünler
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 600 }}>Sayfa başına:</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h3>Uyarı yok</h3>
          <p>Tüm ürünlerde satış fiyatı alış fiyatının üzerinde ve kar marjı en az %5.</p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(245, 158, 11, 0.1) 100%)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700 }}>Ürün</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Satış</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Alış</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Min. Fiyat</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700 }}>Marj %</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700 }}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <Link
                      to={`/products/${p.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}
                    >
                      {p.coverImageUrl ? (
                        <img
                          src={p.coverImageUrl}
                          alt=""
                          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ) : (
                        <div style={{ width: 40, height: 40, background: 'rgba(99, 102, 241, 0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📦</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.omschrijving}</div>
                        {p.artikelnummer && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{p.artikelnummer}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(p.verkoopprijs)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{formatCurrency(p.inkoopprijs)}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                    {formatCurrency(p.minPrice)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: p.marginPct < 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                    %{p.marginPct.toFixed(1)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: p.warningType === 'zarar' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: p.warningType === 'zarar' ? 'var(--danger)' : 'var(--warning)',
                      }}
                    >
                      {p.warningType === 'zarar' ? 'Zarar' : 'Düşük Marj'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {total > 0 && (
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
                {startItem}-{endItem} / {total} ürün
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => goToPage(1)}
                  disabled={page <= 1}
                  style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
                >««</button>
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}
                >«</button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>Sayfa {page} / {totalPages}</span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
                >»</button>
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={page >= totalPages}
                  style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}
                >»»</button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
