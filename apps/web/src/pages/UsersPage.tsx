import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'sales_rep';
  createdAt?: string;
  updatedAt?: string;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const { user: currentUser } = useAuthStore();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('Kullanıcı başarıyla silindi', 'success');
      setUserToDelete(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Kullanıcı silinirken bir hata oluştu';
      showToast(message, 'error');
    },
  });

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

  return (
    <div className="container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: 'clamp(1rem, 3vw, 2rem)',
          flexWrap: 'wrap',
        }}
      >
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Kullanıcılar
        </motion.h2>
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate('/users/new')}
          className="btn-primary"
          style={{ minHeight: '44px' }}
          whileTap={{ scale: 0.98 }}
        >
          ➕ Yeni Kullanıcı Ekle
        </motion.button>
      </div>

      {users && users.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {users.map((user: User, index: number) => (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1rem 1.25rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: user.role === 'admin'
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: 'white',
                    flexShrink: 0,
                  }}
                  >
                    {(user.username || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      marginBottom: '0.25rem',
                      wordBreak: 'break-word',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {user.username || user.email || 'Bilinmeyen Kullanıcı'}
                  </h3>
                  {user.email && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                      {user.email}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: user.role === 'admin'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(99, 102, 241, 0.1)',
                        color: user.role === 'admin' ? '#f59e0b' : 'var(--primary)',
                      }}
                    >
                      {user.role === 'admin' ? '👑 Admin' : '👤 Çalışan'}
                    </div>
                    {user.createdAt && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Oluşturulma: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <motion.button
                  onClick={() => navigate(`/users/${user._id}/edit`)}
                  className="btn-secondary"
                  style={{ minHeight: '44px', padding: '0.5rem 1rem' }}
                  whileTap={{ scale: 0.98 }}
                >
                  ✏️ Düzenle
                </motion.button>
                {currentUser?.id !== user._id && (
                  <motion.button
                    onClick={() => setUserToDelete(user)}
                    className="btn-danger"
                    style={{ minHeight: '44px', padding: '0.5rem 1rem' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🗑️ Sil
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ textAlign: 'center', padding: '4rem 2rem' }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👥</div>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
            Henüz kullanıcı yok
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            İlk kullanıcıyı ekleyerek başlayın
          </p>
          <motion.button
            onClick={() => navigate('/users/new')}
            className="btn-primary"
            whileTap={{ scale: 0.95 }}
          >
            ➕ Yeni Kullanıcı Ekle
          </motion.button>
        </motion.div>
      )}

      {/* Silme Onay Modalı */}
      <AnimatePresence>
        {userToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setUserToDelete(null)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="card"
              style={{
                maxWidth: '420px',
                width: '100%',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-xl)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                  fontWeight: 700,
                  marginBottom: '0.75rem',
                  color: 'var(--danger)',
                }}
              >
                Kullanıcıyı Sil
              </h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                <strong>{userToDelete.username}</strong>
                {userToDelete.email && ` (${userToDelete.email})`} adlı kullanıcıyı silmek üzeresiniz. Bu işlem geri alınamaz.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setUserToDelete(null)}
                  disabled={deleteMutation.isPending}
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    if (!userToDelete._id || deleteMutation.isPending) return;
                    deleteMutation.mutate(userToDelete._id);
                  }}
                  disabled={deleteMutation.isPending}
                  style={{ minHeight: '40px', paddingInline: '1rem' }}
                >
                  {deleteMutation.isPending ? 'Siliniyor...' : 'Evet, Sil'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
