import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function CreateUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'sales_rep'>('sales_rep');
  const [useEmail, setUseEmail] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: { username: string; email?: string; password: string; role: 'admin' | 'sales_rep' }) => {
      const response = await api.post('/users', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Kullanıcı başarıyla oluşturuldu', 'success');
      navigate('/users');
    },
    onError: (error: any) => {
      console.error('Create user error:', error);
      console.error('Error response:', error?.response?.data);
      console.error('Error status:', error?.response?.status);
      
      // Hata mesajını al
      let message = 'Kullanıcı oluşturulurken bir hata oluştu';
      
      if (error?.response?.data) {
        if (error.response.data.message) {
          message = error.response.data.message;
        } else if (error.response.data.error) {
          message = error.response.data.error;
        } else if (typeof error.response.data === 'string') {
          message = error.response.data;
        }
      } else if (error?.message) {
        message = error.message;
      }
      
      console.error('Showing error toast:', message);
      showToast(message, 'error', 7000); // 7 saniye göster
      
      // Hata durumunda navigate yapma - kullanıcı formu düzeltebilsin
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !username.trim() || !password) {
      showToast('Lütfen kullanıcı adı ve şifre alanlarını doldurun', 'error');
      return;
    }

    // Email opsiyonel - zorunluluk kontrolü yok

    if (password.length < 6) {
      showToast('Şifre en az 6 karakter olmalıdır', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Şifreler eşleşmiyor', 'error');
      return;
    }

    const userData: { username: string; password: string; role: 'admin' | 'sales_rep'; email?: string } = { 
      username: username.trim(), 
      password, 
      role 
    };
    
    // useEmail false ise email'i hiç gönderme
    if (useEmail && email && email.trim()) {
      userData.email = email.trim();
    }
    
    console.log('Creating user with data:', { ...userData, password: '***' }); // Password'u gizle
    createMutation.mutate(userData);
  };

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
          Yeni Kullanıcı Ekle
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
                E-posta ekle (İsteğe bağlı)
              </span>
            </label>
            {useEmail && (
              <input
                id="email"
                type="email"
                value={email}
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
              Şifre *
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En az 6 karakter"
              className="input"
              required
              minLength={6}
              autoComplete="new-password"
              style={{ width: '100%', minHeight: '44px' }}
            />
          </div>

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
              Şifre Tekrar *
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Şifreyi tekrar girin"
              className="input"
              required
              minLength={6}
              autoComplete="new-password"
              style={{ width: '100%', minHeight: '44px' }}
            />
          </div>

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
              disabled={createMutation.isPending}
              style={{ flex: 1, minHeight: '44px', opacity: createMutation.isPending ? 0.6 : 1 }}
              whileTap={!createMutation.isPending ? { scale: 0.98 } : {}}
            >
              {createMutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="loading" />
                  Oluşturuluyor...
                </span>
              ) : (
                '✅ Kullanıcı Oluştur'
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
