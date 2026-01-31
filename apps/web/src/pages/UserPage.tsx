import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

interface CompanyInfo {
  naam?: string;
  kvkNummer?: string;
  btwNummer?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  telefoon?: string;
  email?: string;
  website?: string;
  [key: string]: any;
}

export default function UserPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: connectionStatus } = useQuery({
    queryKey: ['connection-settings'],
    queryFn: async () => {
      const response = await api.get('/connection-settings');
      return response.data;
    },
  });

  const { data: companyInfo, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company-info'],
    queryFn: async () => {
      const response = await api.get('/connection-settings/company-info');
      return response.data;
    },
    enabled: connectionStatus?.isTokenValid === true,
    retry: false,
  });

  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/connection-settings/refresh-token');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-settings'] });
      queryClient.invalidateQueries({ queryKey: ['company-info'] });
      showToast('Token başarıyla yenilendi', 'success');
      setIsRefreshing(false);
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Token yenilenemedi', 'error');
      setIsRefreshing(false);
    },
  });

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    refreshTokenMutation.mutate();
  };

  const isTokenValid = connectionStatus?.isTokenValid === true;
  const tokenExpiresAt = connectionStatus?.tokenExpiresAt
    ? new Date(connectionStatus.tokenExpiresAt)
    : null;

  return (
    <div className="container">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginBottom: '2rem',
          fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Kullanıcı Bilgileri
      </motion.h2>

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ marginBottom: '2rem' }}
      >
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
          👤 Hesap Bilgileri
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              E-posta
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user?.email}</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              Rol
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {user?.role === 'admin' ? '👑 Admin' : '👤 Satış Temsilcisi'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Connection Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card"
        style={{
          marginBottom: '2rem',
          border: isTokenValid ? '2px solid rgba(16, 185, 129, 0.3)' : '2px solid rgba(239, 68, 68, 0.3)',
          background: isTokenValid
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.05) 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>🔗 SnelStart Bağlantı Durumu</h3>
          <span
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '12px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: isTokenValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: isTokenValid ? '#10b981' : '#ef4444',
            }}
          >
            {isTokenValid ? '✅ Aktif' : '❌ Pasif'}
          </span>
        </div>

        {tokenExpiresAt && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              Token Geçerlilik Süresi
            </p>
            <p style={{ fontSize: '1rem', fontWeight: 500 }}>
              {tokenExpiresAt.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        )}

        {!isTokenValid && (
          <motion.button
            onClick={handleRefreshToken}
            className="btn-primary"
            disabled={isRefreshing}
            style={{ width: '100%', marginTop: '1rem' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isRefreshing ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span className="loading" />
                Bağlanıyor...
              </span>
            ) : (
              '🔄 Bağlantıyı Test Et / Bağlan'
            )}
          </motion.button>
        )}

        {isTokenValid && (
          <motion.button
            onClick={handleRefreshToken}
            className="btn-secondary"
            disabled={isRefreshing}
            style={{ width: '100%', marginTop: '1rem' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isRefreshing ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span className="loading" />
                Yenileniyor...
              </span>
            ) : (
              '🔄 Token\'ı Yenile'
            )}
          </motion.button>
        )}
      </motion.div>

      {/* Company Info Card */}
      {isTokenValid && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
            🏢 Şirket Bilgileri
          </h3>
          {isLoadingCompany ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                }}
              />
            </div>
          ) : companyInfo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {companyInfo.naam && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Şirket Adı
                  </p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{companyInfo.naam}</p>
                </div>
              )}
              {companyInfo.kvkNummer && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    KVK Numarası
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.kvkNummer}</p>
                </div>
              )}
              {companyInfo.btwNummer && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    BTW Numarası
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.btwNummer}</p>
                </div>
              )}
              {(companyInfo.adres || companyInfo.postcode || companyInfo.plaats) && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Adres
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {[companyInfo.adres, companyInfo.postcode, companyInfo.plaats]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}
              {companyInfo.telefoon && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Telefon
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.telefoon}</p>
                </div>
              )}
              {companyInfo.email && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    E-posta
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.email}</p>
                </div>
              )}
              {companyInfo.website && (
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Website
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                    <a
                      href={companyInfo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      {companyInfo.website}
                    </a>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              Şirket bilgileri alınamadı
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
