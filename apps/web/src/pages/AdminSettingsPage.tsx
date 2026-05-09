import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';

export default function AdminSettingsPage() {
  const { t } = useAppTranslation(['common', 'settings', 'orders']);
  const { formatDateTime } = useLocaleFormat();
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
      alert(t('settings:saved'));
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
        showToast(t('settings:connectionSuccess'), 'success');
      } else {
        showToast(t('settings:connectionFailed', { error: data.error }), 'error', 5000);
      }
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || t('settings:connectionTestFailed'), 'error', 5000);
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
        showToast(t('settings:tokenRefreshed'), 'success');
      } else {
        showToast(t('settings:tokenRefreshFailedWithError', { error: data.error }), 'error', 5000);
      }
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.error || t('settings:tokenRefreshFailed'), 'error', 5000);
    },
  });

  return (
    <div className="container">
      <h2>{t('settings:title')}</h2>

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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>🔗 {t('settings:connectionStatus')}</h3>
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
              {settings.isTokenValid ? `✅ ${t('settings:tokenActive')}` : `❌ ${t('settings:tokenPassive')}`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <p>
              <strong>{t('settings:status')}:</strong> {settings.isActive ? t('states.active') : t('states.inactive')}
            </p>
            {settings.tokenExpiresAt && (
              <p>
                <strong>{t('settings:tokenValidity')}:</strong>{' '}
                {formatDateTime(settings.tokenExpiresAt)}
              </p>
            )}
            {settings.lastTestedAt && (
              <p>
                <strong>{t('settings:lastTest')}:</strong> {formatDateTime(settings.lastTestedAt)}
              </p>
            )}
            {settings.lastTestStatus && (
              <p>
                <strong>{t('settings:lastTestResult')}:</strong>{' '}
                <span style={{ color: settings.lastTestStatus === 'success' ? '#10b981' : '#ef4444' }}>
                  {settings.lastTestStatus === 'success' ? `✅ ${t('states.success')}` : `❌ ${t('orders:status.failed')}`}
                </span>
              </p>
            )}
            {settings.lastTestError && (
              <p style={{ color: '#ef4444' }}>
                <strong>{t('settings:error')}:</strong> {settings.lastTestError}
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
                  {t('settings:connecting')}
                </span>
              ) : (
                `🔄 ${t('settings:testConnect')}`
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
                  {t('settings:refreshing')}
                </span>
              ) : (
                `🔄 ${t('settings:refreshToken')}`
              )}
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
}
