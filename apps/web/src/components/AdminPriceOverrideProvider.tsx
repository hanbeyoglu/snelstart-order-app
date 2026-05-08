import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';

interface ConfirmOptions {
  minPrice?: string;
}

interface PendingConfirmation {
  options?: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

interface AdminPriceOverrideContextValue {
  confirmPriceOverride: (options?: ConfirmOptions) => Promise<boolean>;
}

const AdminPriceOverrideContext = createContext<AdminPriceOverrideContextValue | null>(null);

export function AdminPriceOverrideProvider({ children }: { children: ReactNode }) {
  const { t } = useAppTranslation(['common', 'cart']);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const confirmPriceOverride = useCallback((options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const close = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  return (
    <AdminPriceOverrideContext.Provider value={{ confirmPriceOverride }}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20000,
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-price-override-title"
              style={{
                maxWidth: '460px',
                width: '100%',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-xl)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '2.75rem', marginBottom: '0.75rem' }}>⚠️</div>
                <h3
                  id="admin-price-override-title"
                  style={{
                    fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                  }}
                >
                  {t('cart:adminPriceOverride.title')}
                </h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {t('cart:adminPriceOverride.description')}
                </p>
                {pending.options?.minPrice && (
                  <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t('cart:adminPriceOverride.minPrice', { minPrice: pending.options.minPrice })}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <motion.button
                  type="button"
                  onClick={() => close(false)}
                  className="btn-secondary"
                  style={{ padding: '0.75rem 1.25rem', fontSize: '0.95rem', fontWeight: 600 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('cart:adminPriceOverride.cancel')}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() => close(true)}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.25rem', fontSize: '0.95rem', fontWeight: 600 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('cart:adminPriceOverride.confirm')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminPriceOverrideContext.Provider>
  );
}

export function useAdminPriceOverride() {
  const context = useContext(AdminPriceOverrideContext);
  if (!context) {
    throw new Error('useAdminPriceOverride must be used within AdminPriceOverrideProvider');
  }
  return context;
}
