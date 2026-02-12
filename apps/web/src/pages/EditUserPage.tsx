import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function EditUserPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'sales_rep'>('sales_rep');
  const [useEmail, setUseEmail] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setUseEmail(!!user.email);
      setRole(user.role);
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: { username?: string; email?: string; password?: string; role?: 'admin' | 'sales_rep' }) => {
      const response = await api.put(`/users/${userId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      showToast('Kullanıcı başarıyla güncellendi', 'success');
      navigate('/users');
    },
    onError: (error: any) => {
      console.error('Update user error:', error);
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Kullanıcı güncellenirken bir hata oluştu';
      showToast(message, 'error', 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !username.trim()) {
      showToast('Lütfen kullanıcı adını girin', 'error');
      return;
    }

    // Email opsiyonel - zorunluluk kontrolü yok

    const updateData: { username?: string; email?: string | null; password?: string; role?: 'admin' | 'sales_rep' } = {
      username: username.trim(),
      role,
    };

    // Email işleme: useEmail true ise ve email varsa gönder, false ise undefined gönder (kaldır)
    if (useEmail) {
      if (email && email.trim()) {
        updateData.email = email.trim();
      } else {
        // useEmail true ama email boş - bu durumda email'i kaldır
        updateData.email = undefined;
      }
    } else {
      // useEmail false - email'i kaldır
      updateData.email = undefined;
    }

    if (password) {
      if (password.length < 6) {
        showToast('Şifre en az 6 karakter olmalıdır', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Şifreler eşleşmiyor', 'error');
        return;
      }

      updateData.password = password;
    }

    // null değerlerini undefined'a çevir (TypeScript tip uyumu için)
    const finalUpdateData: { username?: string; email?: string; password?: string; role?: 'admin' | 'sales_rep' } = {
      ...updateData,
      email: updateData.email === null ? undefined : updateData.email,
    };

    updateMutation.mutate(finalUpdateData);
  };

  if (isLoading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
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
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <p style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>Kullanıcı bulunamadı</p>
          <motion.button
            onClick={() => navigate('/users')}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            whileTap={{ scale: 0.95 }}
          >
            ← Kullanıcılara Dön
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/users')}
        className="btn-secondary"
        style={{ marginBottom: '1.5rem', minHeight: '44px' }}
        whileTap={{ scale: 0.98 }}
      >
        ← Geri
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ maxWidth: '600px', margin: '0 auto' }}
      >
        <h2
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2rem)',
            fontWeight: 700,
            marginBottom: '2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Kullanıcı Düzenle
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Kullanıcı Adı *
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullaniciadi"
              className="input"
              required
              autoComplete="username"
              style={{ width: '100%', minHeight: '44px' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={useEmail}
                onChange={(e) => setUseEmail(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: 'var(--primary)',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                E-posta ekle (Opsiyonel)
              </span>
            </label>
            {useEmail && (
              <input
                id="email"
                type="email"
                value={email || ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="input"
                style={{ width: '100%', minHeight: '44px', marginTop: '0.5rem' }}
              />
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              className="input"
              minLength={6}
              autoComplete="new-password"
              style={{ width: '100%', minHeight: '44px' }}
            />
          </div>

          {password && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Yeni Şifre Tekrar *
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Şifreyi tekrar girin"
                className="input"
                required={!!password}
                minLength={6}
                autoComplete="new-password"
                style={{ width: '100%', minHeight: '44px' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '2rem' }}>
            <label
              htmlFor="role"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Rol *
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'sales_rep')}
              className="input"
              required
              style={{ width: '100%', minHeight: '44px' }}
            >
              <option value="sales_rep">👤 Çalışan</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <motion.button
              type="button"
              onClick={() => navigate('/users')}
              className="btn-secondary"
              style={{ flex: 1, minHeight: '44px' }}
              whileTap={{ scale: 0.98 }}
            >
              İptal
            </motion.button>
            <motion.button
              type="submit"
              className="btn-primary"
              disabled={updateMutation.isPending}
              style={{ flex: 1, minHeight: '44px', opacity: updateMutation.isPending ? 0.6 : 1 }}
              whileTap={!updateMutation.isPending ? { scale: 0.98 } : {}}
            >
              {updateMutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="loading" />
                  Güncelleniyor...
                </span>
              ) : (
                '✅ Güncelle'
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
