import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';

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
  const { t } = useAppTranslation(['common', 'users']);
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [useEmail, setUseEmail] = useState(!!user?.email);

  const { data: connectionStatus } = useQuery({
    queryKey: ['connection-settings'],
    queryFn: async () => {
      const response = await api.get('/connection-settings/status');
      return response.data;
    },
  });

  const { data: companyInfo, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company-info'],
    queryFn: async () => {
      const response = await api.get('/connection-settings/company-info');
      return response.data;
    },
    enabled: user?.role === 'super_admin' && connectionStatus?.isTokenValid === true,
    retry: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      username?: string;
      email?: string | null;
      firstName?: string;
      lastName?: string;
      password?: string;
    }) => {
      const response = await api.put('/users/me', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Auth store'u güncelle
      setUser({
        ...user,
        id: data._id || data.id,
        username: data.username,
        email: data.email || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        role: data.role,
        permissions: data.permissions ?? user?.permissions,
        customerId: data.customerId ?? user?.customerId ?? null,
        isActive: data.isActive ?? user?.isActive,
        preferredLanguage: data.preferredLanguage ?? user?.preferredLanguage ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      showToast(t('users:profile.messages.updated'), 'success');
      setIsEditing(false);
      setPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        t('users:profile.messages.updateError');
      showToast(message, 'error', 5000);
    },
  });

  const handleEditProfile = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !username.trim()) {
      showToast(t('users:profile.validation.usernameRequired'), 'error');
      return;
    }

    const updateData: {
      username?: string;
      email?: string | null;
      firstName?: string;
      lastName?: string;
      password?: string;
    } = {
      username: username.trim(),
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    };

    // Email işleme
    if (useEmail) {
      if (email && email.trim()) {
        updateData.email = email.trim();
      } else {
        updateData.email = null;
      }
    } else {
      updateData.email = null;
    }

    // Şifre kontrolü
    if (password) {
      if (password.length < 6) {
        showToast(t('users:profile.validation.passwordMinLength'), 'error');
        return;
      }
      if (password !== confirmPassword) {
        showToast(t('users:profile.validation.passwordMismatch'), 'error');
        return;
      }
      updateData.password = password;
    }

    updateProfileMutation.mutate(updateData);
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
        {t('users:profile.title')}
      </motion.h2>

      {/* User Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ marginBottom: '2rem' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <h3
            style={{
              fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
              fontWeight: 700,
              margin: 0,
            }}
          >
            👤 {t('users:profile.accountInfo')}
          </h3>
          {!isEditing && (
            <motion.button
              onClick={() => {
                setIsEditing(true);
                setFirstName(user?.firstName || '');
                setLastName(user?.lastName || '');
                setUsername(user?.username || '');
                setEmail(user?.email || '');
                setUseEmail(!!user?.email);
                setPassword('');
                setConfirmPassword('');
              }}
              className="btn-primary"
              style={{
                padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
                whiteSpace: 'nowrap',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              ✏️ {t('users:edit')}
            </motion.button>
          )}
        </div>

        {!isEditing ? (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.75rem, 2vw, 1rem)' }}
          >
            {(user?.firstName || user?.lastName) && (
              <div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {t('users:profile.fullName')}
                </p>
                <p
                  style={{
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                    fontWeight: 600,
                    wordBreak: 'break-word',
                  }}
                >
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ')}
                </p>
              </div>
            )}
            <div>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
                  marginBottom: '0.25rem',
                }}
              >
                {t('common:forms.username')}
              </p>
              <p
                style={{
                  fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                  fontWeight: 600,
                  wordBreak: 'break-word',
                }}
              >
                {user?.username}
              </p>
            </div>
            {user?.email && (
              <div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {t('common:forms.email')}
                </p>
                <p
                  style={{
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                    fontWeight: 600,
                    wordBreak: 'break-word',
                  }}
                >
                  {user.email}
                </p>
              </div>
            )}
            <div>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
                  marginBottom: '0.25rem',
                }}
              >
                {t('common:forms.role')}
              </p>
              <p
                style={{
                  fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                  fontWeight: 600,
                }}
              >
                {user?.role === 'super_admin'
                  ? `🔐 ${t('users:roles.superAdmin')}`
                  : user?.role === 'admin'
                    ? `👑 ${t('users:roles.admin')}`
                    : `👤 ${t('users:roles.salesRep')}`}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEditProfile}>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.75rem, 2vw, 1rem)' }}
            >
              <div style={{ display: 'flex', gap: 'clamp(0.75rem, 2vw, 1rem)', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      fontWeight: 600,
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                    }}
                  >
                    {t('common:forms.firstName')}
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('users:profile.placeholders.firstName')}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      fontWeight: 600,
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                    }}
                  >
                    {t('common:forms.lastName')}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('users:profile.placeholders.lastName')}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                    fontWeight: 600,
                    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                  }}
                >
                  {t('common:forms.username')} *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                    marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useEmail}
                    onChange={(e) => setUseEmail(e.target.checked)}
                    style={{
                      width: 'clamp(18px, 4vw, 20px)',
                      height: 'clamp(18px, 4vw, 20px)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      margin: 0,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                    }}
                  >
                    {t('users:profile.useEmail')}
                  </span>
                </label>
                {useEmail && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('users:profile.placeholders.email')}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      marginTop: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                    fontWeight: 600,
                    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                  }}
                >
                  {t('users:profile.newPasswordHelp')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {password && (
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 'clamp(0.4rem, 1.5vw, 0.5rem)',
                      fontWeight: 600,
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                    }}
                  >
                    {t('users:profile.confirmNewPassword')} *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required={!!password}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 'clamp(0.85rem, 2.5vw, 0.9rem)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {t('common:forms.role')}
                </p>
                <p
                  style={{
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {user?.role === 'super_admin'
                    ? `🔐 ${t('users:roles.superAdmin')}`
                    : user?.role === 'admin'
                      ? `👑 ${t('users:roles.admin')}`
                      : `👤 ${t('users:roles.salesRep')}`}{' '}
                  ({t('users:profile.notEditable')})
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 'clamp(0.75rem, 2vw, 1rem)',
                  marginTop: 'clamp(0.75rem, 2vw, 1rem)',
                  flexWrap: 'wrap',
                }}
              >
                <motion.button
                  type="submit"
                  className="btn-primary"
                  disabled={updateProfileMutation.isPending}
                  style={{
                    flex: '1 1 auto',
                    minWidth: '120px',
                    padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {updateProfileMutation.isPending ? t('common:states.saving') : `💾 ${t('common:actions.save')}`}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setFirstName(user?.firstName || '');
                    setLastName(user?.lastName || '');
                    setUsername(user?.username || '');
                    setEmail(user?.email || '');
                    setUseEmail(!!user?.email);
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="btn-secondary"
                  style={{
                    flex: '1 1 auto',
                    minWidth: '120px',
                    padding: 'clamp(0.6rem, 2vw, 0.75rem)',
                    fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  ❌ {t('common:actions.cancel')}
                </motion.button>
              </div>
            </div>
          </form>
        )}
      </motion.div>

      {/* Company Info Card */}
      {user?.role === 'super_admin' && isTokenValid && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>
            🏢 {t('users:profile.companyInfo')}
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
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('users:profile.companyName')}
                  </p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{companyInfo.naam}</p>
                </div>
              )}
              {companyInfo.kvkNummer && (
                <div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('users:profile.kvkNumber')}
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.kvkNummer}</p>
                </div>
              )}
              {companyInfo.btwNummer && (
                <div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('users:profile.btwNumber')}
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.btwNummer}</p>
                </div>
              )}
              {(companyInfo.adres || companyInfo.postcode || companyInfo.plaats) && (
                <div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('common:forms.address')}
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
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('common:forms.phone')}
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.telefoon}</p>
                </div>
              )}
              {companyInfo.email && (
                <div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('common:forms.email')}
                  </p>
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>{companyInfo.email}</p>
                </div>
              )}
              {companyInfo.website && (
                <div>
                  <p
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.9rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {t('users:profile.website')}
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
              {t('users:profile.companyInfoUnavailable')}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
