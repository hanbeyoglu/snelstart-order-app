import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

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
    success: {
      bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
      border: 'rgba(16, 185, 129, 0.3)',
    },
    error: {
      bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.95) 100%)',
      border: 'rgba(239, 68, 68, 0.3)',
    },
    info: {
      bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(79, 70, 229, 0.95) 100%)',
      border: 'rgba(99, 102, 241, 0.3)',
    },
    warning: {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%)',
      border: 'rgba(245, 158, 11, 0.3)',
    },
  };

  const color = colors[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, x: 300, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      style={{
        background: color.bg,
        backdropFilter: 'blur(20px)',
        border: `2px solid ${color.border}`,
        borderRadius: '16px',
        padding: '1rem 1.25rem',
        minWidth: '300px',
        maxWidth: '400px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        cursor: 'pointer',
        marginBottom: '0.75rem',
      }}
      onClick={() => onClose(toast.id)}
      whileHover={{ scale: 1.02, x: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <motion.div
        style={{ fontSize: '1.5rem', flexShrink: 0 }}
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {icons[toast.type]}
      </motion.div>
      <p
        style={{
          color: 'white',
          fontWeight: 500,
          fontSize: '0.95rem',
          lineHeight: 1.5,
          flex: 1,
          margin: 0,
        }}
      >
        {toast.message}
      </p>
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onClose(toast.id);
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '1rem',
          padding: 0,
          flexShrink: 0,
        }}
        whileHover={{ scale: 1.1, background: 'rgba(255, 255, 255, 0.3)' }}
        whileTap={{ scale: 0.9 }}
      >
        ×
      </motion.button>
    </motion.div>
  );
}

export default function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'none',
        gap: '0.5rem',
      }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

