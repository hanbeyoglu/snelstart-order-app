import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';

export default function NotFoundPage() {
  const { t } = useAppTranslation('common');
  return (
    <div className="container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          {t('notFound.title')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {t('notFound.description')}
        </p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block', padding: '0.75rem 1.5rem' }}>
          {t('notFound.home')}
        </Link>
      </motion.div>
    </div>
  );
}
