import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import { hasPermission } from '../utils/permissions';

/** @see packages/shared/src/i18n/order-notification-email.ts ORDER_NOTIFICATION_EMAIL_LOCALES */
const ORDER_NOTIFICATION_EMAIL_LOCALES = ['tr', 'en', 'nl', 'de', 'ar'] as const;
type OrderNotificationEmailLocale = (typeof ORDER_NOTIFICATION_EMAIL_LOCALES)[number];

/** @see packages/shared/src/i18n/order-notification-email.ts normalizeOrderNotificationLocale */
function normalizeOrderNotificationLocaleUi(raw?: string | null): OrderNotificationEmailLocale {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'en' || v.startsWith('en')) return 'en';
  if (v === 'nl' || v.startsWith('nl')) return 'nl';
  if (v === 'de' || v.startsWith('de')) return 'de';
  if (v === 'ar' || v.startsWith('ar')) return 'ar';
  if (v === 'tr' || v.startsWith('tr')) return 'tr';
  return 'tr';
}

export default function AdminSettingsPage() {
  const { t } = useAppTranslation(['common', 'settings', 'orders']);
  const { formatDateTime } = useLocaleFormat();
  const [subscriptionKey, setSubscriptionKey] = useState('');
  const [integrationKey, setIntegrationKey] = useState('');
  const [testing, setTesting] = useState(false);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);

  // Mail settings permissions
  const canViewMail = hasPermission(user, 'mail.settings.view');
  const canManageMail = hasPermission(user, 'mail.settings.manage');
  const canManageNotifications = hasPermission(user, 'order.notifications.manage');
  const canSendTestMail = hasPermission(user, 'mail.test.send');

  // SMTP form state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');

  // Notification email state (comma-separated)
  const [toEmails, setToEmails] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [orderNotificationLocale, setOrderNotificationLocale] = useState<OrderNotificationEmailLocale>('tr');

  // Test mail state
  const [testMailTo, setTestMailTo] = useState('');
  const [testMailResult, setTestMailResult] = useState<{ success: boolean; error?: string } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['connection-settings'],
    queryFn: async () => {
      const response = await api.get('/connection-settings');
      return response.data;
    },
  });

  const { data: mailSettings } = useQuery({
    queryKey: ['mail-settings'],
    queryFn: async () => {
      const response = await api.get('/mail-settings');
      return response.data;
    },
    enabled: canViewMail,
  });

  useEffect(() => {
    if (!mailSettings) return;
    setSmtpHost(mailSettings.smtpHost || '');
    setSmtpPort(String(mailSettings.smtpPort || 587));
    setSmtpSecure(!!mailSettings.smtpSecure);
    setSmtpUsername(mailSettings.smtpUsername || '');
    setSmtpPassword('');
    setSmtpFromName(mailSettings.smtpFromName || '');
    setSmtpFromEmail(mailSettings.smtpFromEmail || '');
    setToEmails((mailSettings.orderNotificationToEmails || []).join(', '));
    setCcEmails((mailSettings.orderNotificationCcEmails || []).join(', '));
    setOrderNotificationLocale(normalizeOrderNotificationLocaleUi(mailSettings.orderNotificationLocale));
  }, [mailSettings]);

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

  const saveSmtpMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/mail-settings/smtp', {
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpSecure,
        smtpUsername,
        smtpPassword: smtpPassword || undefined,
        smtpFromName,
        smtpFromEmail,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
      setSmtpPassword('');
      showToast(t('settings:mailSmtpSaved'), 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.message || t('settings:mailSaveFailed'), 'error', 5000);
    },
  });

  const saveNotificationsMutation = useMutation({
    mutationFn: async () => {
      const parseEmails = (raw: string) =>
        raw
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
      const response = await api.post('/mail-settings/notifications', {
        orderNotificationToEmails: parseEmails(toEmails),
        orderNotificationCcEmails: parseEmails(ccEmails),
        orderNotificationLocale,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail-settings'] });
      showToast(t('settings:mailNotificationsSaved'), 'success');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.message || t('settings:mailSaveFailed'), 'error', 5000);
    },
  });

  const sendTestMailMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/mail-settings/test', {
        // `to` is optional — backend falls back to smtpUsername
        to: testMailTo.trim() || undefined,
        smtpHost: smtpHost || undefined,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpSecure,
        smtpUsername: smtpUsername || undefined,
        // Never send the password unless it was explicitly re-entered this session
        smtpPassword: smtpPassword || undefined,
        smtpFromName: smtpFromName || undefined,
        smtpFromEmail: smtpFromEmail || undefined,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setTestMailResult(data);
    },
    onError: (error: any) => {
      setTestMailResult({
        success: false,
        error: error?.response?.data?.message || t('settings:mailTestFailed'),
      });
    },
  });

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.875rem',
    borderRadius: '8px',
    border: '1.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text-primary, #f1f5f9)',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const readonlyInputStyle: React.CSSProperties = {
    ...inputStyle,
    opacity: 0.6,
    cursor: 'not-allowed',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary, #94a3b8)',
    marginBottom: '0.35rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  const fieldStyle: React.CSSProperties = { marginBottom: '1rem' };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
  };

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

      {/* ── Mail Settings ─────────────────────────────────── */}
      {canViewMail && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ✉️ {t('settings:mailTitle')}
          </h3>

          {/* SMTP Card */}
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              border: '1.5px solid rgba(99,102,241,0.25)',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.04) 0%, rgba(139,92,246,0.04) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.1rem' }}>⚙️</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('settings:mailSmtpTitle')}</h4>
              {!canManageMail && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                  {t('settings:readOnly')}
                </span>
              )}
            </div>

            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t('settings:mailSmtpHost')}</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  readOnly={!canManageMail}
                  placeholder="smtp.example.com"
                  style={canManageMail ? inputStyle : readonlyInputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>{t('settings:mailSmtpPort')}</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  readOnly={!canManageMail}
                  placeholder="587"
                  min={1}
                  max={65535}
                  style={canManageMail ? inputStyle : readonlyInputStyle}
                />
              </div>
            </div>

            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>{t('settings:mailSmtpSecure')}</label>
              <div
                onClick={() => canManageMail && setSmtpSecure((v) => !v)}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  background: smtpSecure ? '#6366f1' : 'rgba(255,255,255,0.12)',
                  cursor: canManageMail ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                  opacity: canManageMail ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: smtpSecure ? '23px' : '3px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {smtpSecure ? 'TLS/SSL (port 465)' : 'STARTTLS (port 587)'}
              </span>
            </div>

            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t('settings:mailSmtpUsername')}</label>
                <input
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  readOnly={!canManageMail}
                  placeholder="user@example.com"
                  style={canManageMail ? inputStyle : readonlyInputStyle}
                  autoComplete="username"
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>
                  {t('settings:mailSmtpPassword')}
                  {mailSettings?.passwordConfigured && (
                    <span style={{ marginLeft: '0.4rem', color: '#10b981', fontWeight: 400 }}>
                      ({t('settings:mailPasswordSet')})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  readOnly={!canManageMail}
                  placeholder={mailSettings?.passwordConfigured ? t('settings:mailPasswordPlaceholder') : ''}
                  style={canManageMail ? inputStyle : readonlyInputStyle}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>{t('settings:mailFromName')}</label>
                <input
                  type="text"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  readOnly={!canManageMail}
                  placeholder={t('settings:mailFromNamePlaceholder')}
                  style={canManageMail ? inputStyle : readonlyInputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>{t('settings:mailFromEmail')}</label>
                <input
                  type="email"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  readOnly={!canManageMail}
                  placeholder="orders@example.com"
                  style={canManageMail ? inputStyle : readonlyInputStyle}
                />
              </div>
            </div>

            {canManageMail && (
              <motion.button
                onClick={() => saveSmtpMutation.mutate()}
                className="btn-primary"
                disabled={saveSmtpMutation.isPending}
                style={{ marginTop: '0.5rem' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {saveSmtpMutation.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="loading" /> {t('common:saving')}
                  </span>
                ) : (
                  t('settings:mailSaveSmtp')
                )}
              </motion.button>
            )}
          </div>

          {/* Order Notifications Card */}
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              border: '1.5px solid rgba(16,185,129,0.2)',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.04) 0%, rgba(5,150,105,0.04) 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.1rem' }}>📬</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('settings:mailNotificationsTitle')}</h4>
              {!canManageNotifications && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                  {t('settings:readOnly')}
                </span>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('settings:mailNotificationLanguage')}</label>
              <select
                value={orderNotificationLocale}
                onChange={(e) => setOrderNotificationLocale(e.target.value as OrderNotificationEmailLocale)}
                disabled={!canManageNotifications}
                style={{
                  ...(canManageNotifications ? inputStyle : readonlyInputStyle),
                  maxWidth: '280px',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                }}
              >
                {ORDER_NOTIFICATION_EMAIL_LOCALES.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc.toUpperCase()}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>
                {t('settings:mailNotificationLanguageHint')}
              </p>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('settings:mailNotificationTo')}</label>
              <textarea
                value={toEmails}
                onChange={(e) => setToEmails(e.target.value)}
                readOnly={!canManageNotifications}
                placeholder="admin@company.com, manager@company.com"
                rows={3}
                style={{
                  ...( canManageNotifications ? inputStyle : readonlyInputStyle),
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem' }}>
                {t('settings:mailEmailsHint')}
              </p>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>{t('settings:mailNotificationCc')}</label>
              <textarea
                value={ccEmails}
                onChange={(e) => setCcEmails(e.target.value)}
                readOnly={!canManageNotifications}
                placeholder="cc@company.com"
                rows={2}
                style={{
                  ...(canManageNotifications ? inputStyle : readonlyInputStyle),
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {canManageNotifications && (
              <motion.button
                onClick={() => saveNotificationsMutation.mutate()}
                className="btn-primary"
                disabled={saveNotificationsMutation.isPending}
                style={{ marginTop: '0.5rem' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {saveNotificationsMutation.isPending ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="loading" /> {t('common:saving')}
                  </span>
                ) : (
                  t('settings:mailSaveNotifications')
                )}
              </motion.button>
            )}
          </div>

          {/* Test Mail Card */}
          {canSendTestMail && (
            <div
              className="card"
              style={{
                marginBottom: '2rem',
                border: '1.5px solid rgba(245,158,11,0.2)',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.04) 0%, rgba(217,119,6,0.04) 100%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🧪</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('settings:mailTestTitle')}</h4>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={labelStyle}>{t('settings:mailTestRecipient')}</label>
                  <input
                    type="email"
                    value={testMailTo}
                    onChange={(e) => {
                      setTestMailTo(e.target.value);
                      setTestMailResult(null);
                    }}
                    placeholder={smtpUsername ? `${t('settings:mailTestRecipientPlaceholder')} (${smtpUsername})` : 'you@example.com'}
                    style={inputStyle}
                  />
                </div>
                <motion.button
                  onClick={() => {
                    setTestMailResult(null);
                    sendTestMailMutation.mutate();
                  }}
                  className="btn-secondary"
                  disabled={sendTestMailMutation.isPending || (!testMailTo.trim() && !smtpUsername.trim())}
                  style={{ flexShrink: 0, height: '40px', padding: '0 1.25rem' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {sendTestMailMutation.isPending ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="loading" /> {t('settings:mailTestSending')}
                    </span>
                  ) : (
                    t('settings:mailTestSend')
                  )}
                </motion.button>
              </div>

              {testMailResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: testMailResult.success
                      ? 'rgba(16,185,129,0.1)'
                      : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${testMailResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    color: testMailResult.success ? '#10b981' : '#ef4444',
                    fontSize: '0.875rem',
                  }}
                >
                  {testMailResult.success
                    ? `✅ ${t('settings:mailTestSuccess')}`
                    : `❌ ${t('settings:mailTestError')}: ${testMailResult.error}`}
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
