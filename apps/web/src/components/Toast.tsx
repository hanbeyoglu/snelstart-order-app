import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastProps) {
  const { t } = useTranslation('common');
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  const colors = {
    success: { accent: '#059669', iconBg: 'rgba(16, 185, 129, 0.12)' },
    error: { accent: '#dc2626', iconBg: 'rgba(239, 68, 68, 0.1)' },
    info: { accent: '#4f46e5', iconBg: 'rgba(99, 102, 241, 0.12)' },
    warning: { accent: '#d97706', iconBg: 'rgba(245, 158, 11, 0.14)' },
  };

  const color = colors[toast.type];
  const cssVars = { '--toast-accent': color.accent } as CSSProperties;

  return (
    <motion.div
      className="toast-card"
      style={cssVars}
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={() => onClose(toast.id)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.995 }}
    >
      <div className="toast-card-main">
        <div className="toast-card-icon" style={{ background: color.iconBg }} aria-hidden>
          {icons[toast.type]}
        </div>
        <div className="toast-card-body">
          <p className="toast-card-message">{toast.message}</p>
        </div>
      </div>
      <button
        type="button"
        className="toast-card-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose(toast.id);
        }}
        aria-label={t('actions.close')}
      >
        <svg viewBox="0 0 10 10" aria-hidden>
          <path
            d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </motion.div>
  );
}

export default function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  const node = (
    <div className="toast-viewport">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-viewport-item">
            <ToastItem toast={toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(node, document.body);
}
