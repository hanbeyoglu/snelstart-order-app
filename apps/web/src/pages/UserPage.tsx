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
              Kullanıcı Adı
            </p>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user?.username}</p>
          </div>
          {user?.email && (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                E-posta
              </p>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.email}</p>
            </div>
          )}
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
