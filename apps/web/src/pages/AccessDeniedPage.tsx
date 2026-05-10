import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';

export default function AccessDeniedPage() {
  const { t } = useAppTranslation('common');

  return (
    <div
      className="container"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          width: 'min(560px, 100%)',
          textAlign: 'center',
          background: 'white',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          borderRadius: '8px',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          {t('accessDenied.title', 'Bu sayfaya erişiminiz yok')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {t('accessDenied.description', 'Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz. Lütfen yöneticinizle görüşün.')}
        </p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block', padding: '0.75rem 1.5rem' }}>
          {t('accessDenied.home', 'Ana sayfaya dön')}
        </Link>
      </motion.div>
    </div>
  );
}
