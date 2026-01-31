import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function AdminSettingsPage() {
  const [subscriptionKey, setSubscriptionKey] = useState('');
  const [integrationKey, setIntegrationKey] = useState('');
  const [testing, setTesting] = useState(false);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  const { data: settings } = useQuery({
    queryKey: ['connection-settings'],
    queryFn: async () => {
      const response = await api.get('/connection-settings');
      return response.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/connection-settings', {
        subscriptionKey,
        integrationKey,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-settings'] });
      alert('Ayarlar kaydedildi');
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/connection-settings/test', {
        subscriptionKey: subscriptionKey || settings?.subscriptionKey,
        integrationKey: integrationKey || settings?.integrationKey,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['connection-settings'] });
      if (data.success) {
        showToast('Bağlantı başarılı! Token alındı.', 'success');
      } else {
        showToast(`Bağlantı başarısız: ${data.error}`, 'error', 5000);
      }
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Bağlantı test edilemedi', 'error', 5000);
    },
  });

  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/connection-settings/refresh-token');
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['connection-settings'] });
      if (data.success) {
        showToast('Token başarıyla yenilendi', 'success');
      } else {
        showToast(`Token yenilenemedi: ${data.error}`, 'error', 5000);
      }
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || 'Token yenilenemedi', 'error', 5000);
    },
  });

  return (
    <div className="container">
      <h2>SnelStart Bağlantı Ayarları</h2>

      {settings?.exists && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{
            marginBottom: '2rem',
            border: settings.isTokenValid
              ? '2px solid rgba(16, 185, 129, 0.3)'
              : '2px solid rgba(239, 68, 68, 0.3)',
            background: settings.isTokenValid
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.05) 100%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🔗 Bağlantı Durumu</h3>
            <span
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                background: settings.isTokenValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: settings.isTokenValid ? '#10b981' : '#ef4444',
              }}
            >
              {settings.isTokenValid ? '✅ Token Aktif' : '❌ Token Pasif'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <p>
              <strong>Durum:</strong> {settings.isActive ? 'Aktif' : 'Pasif'}
            </p>
            {settings.tokenExpiresAt && (
              <p>
                <strong>Token Geçerlilik:</strong>{' '}
                {new Date(settings.tokenExpiresAt).toLocaleString('tr-TR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            {settings.lastTestedAt && (
              <p>
                <strong>Son Test:</strong> {new Date(settings.lastTestedAt).toLocaleString('tr-TR')}
              </p>
            )}
            {settings.lastTestStatus && (
              <p>
                <strong>Son Test Sonucu:</strong>{' '}
                <span style={{ color: settings.lastTestStatus === 'success' ? '#10b981' : '#ef4444' }}>
                  {settings.lastTestStatus === 'success' ? '✅ Başarılı' : '❌ Başarısız'}
                </span>
              </p>
            )}
            {settings.lastTestError && (
              <p style={{ color: '#ef4444' }}>
                <strong>Hata:</strong> {settings.lastTestError}
              </p>
            )}
          </div>

          {!settings.isTokenValid && (
            <motion.button
              onClick={() => refreshTokenMutation.mutate()}
              className="btn-primary"
              disabled={refreshTokenMutation.isPending}
              style={{ width: '100%', marginTop: '1rem' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {refreshTokenMutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="loading" />
                  Bağlanıyor...
                </span>
              ) : (
                '🔄 Bağlantıyı Test Et / Bağlan'
              )}
            </motion.button>
          )}

          {settings.isTokenValid && (
            <motion.button
              onClick={() => refreshTokenMutation.mutate()}
              className="btn-secondary"
              disabled={refreshTokenMutation.isPending}
              style={{ width: '100%', marginTop: '1rem' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {refreshTokenMutation.isPending ? (
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
      )}

      <div className="card">
        <h3>Yeni Ayarlar</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label>Subscription Key *</label>
            <input
              type="password"
              value={subscriptionKey}
              onChange={(e) => setSubscriptionKey(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Integration Key *</label>
            <input
              type="password"
              value={integrationKey}
              onChange={(e) => setIntegrationKey(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTesting(true);
                testMutation.mutate();
                setTimeout(() => setTesting(false), 2000);
              }}
              className="btn-secondary"
              disabled={testing || testMutation.isPending}
            >
              {testMutation.isPending || testing ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

