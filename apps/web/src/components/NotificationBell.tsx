import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../store/notificationStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import type { AppNotification } from '@snelstart-order-app/shared';

function relativeTime(dateStr: string, t: (key: string, opts?: any) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return t('notifications:time.justNow');
  if (diffMin < 60) return t('notifications:time.minutesAgo', { count: diffMin });
  if (diffHour < 24) return t('notifications:time.hoursAgo', { count: diffHour });
  if (diffDay === 1) return t('notifications:time.yesterday');
  return t('notifications:time.daysAgo', { count: diffDay });
}

function typeIcon(type: AppNotification['type']): string {
  switch (type) {
    case 'new_order': return '🛍️';
    case 'upcoming_reminder': return '⏰';
    case 'order_cancelled': return '❌';
    case 'order_updated': return '✏️';
    case 'system': return '🔔';
    default: return '🔔';
  }
}

function typeColor(type: AppNotification['type']): string {
  switch (type) {
    case 'new_order': return '#6366f1';
    case 'upcoming_reminder': return '#f59e0b';
    case 'order_cancelled': return '#ef4444';
    case 'order_updated': return '#3b82f6';
    case 'system': return '#8b5cf6';
    default: return '#6366f1';
  }
}

export default function NotificationBell() {
  const { t } = useAppTranslation(['notifications', 'common']);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, isOpen, isLoading, setOpen, markAsRead, markAllAsRead, startPolling } =
    useNotificationStore();

  useEffect(() => {
    const stop = startPolling();
    return stop;
  }, [startPolling]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [isOpen, setOpen]);

  const handleRowClick = (n: AppNotification) => {
    if (!n.isRead) void markAsRead(n._id);
    if (n.relatedOrderId) {
      navigate(`/orders/${n.relatedOrderId}`);
      setOpen(false);
    }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell button */}
      <motion.button
        onClick={() => setOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        style={{
          position: 'relative',
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: isOpen
            ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)'
            : 'white',
          border: `1.5px solid ${isOpen ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          overflow: 'visible',
        }}
        aria-label={t('notifications:title')}
      >
        <motion.span
          animate={unreadCount > 0 ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
          transition={{ duration: 0.5, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 4 }}
          style={{ fontSize: '1.3rem', lineHeight: 1 }}
        >
          🔔
        </motion.span>

        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                borderRadius: '50%',
                minWidth: '20px',
                width: unreadCount > 9 ? 'auto' : '20px',
                height: '20px',
                padding: unreadCount > 9 ? '0 5px' : '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '2px solid white',
                lineHeight: 1,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(239,68,68,0.5)',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.18, type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.75rem)',
              right: 0,
              width: '360px',
              maxWidth: 'calc(100vw - 2rem)',
              background: 'white',
              borderRadius: '18px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
              border: '1px solid rgba(99,102,241,0.12)',
              zIndex: 2000,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1rem 1.25rem 0.75rem',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.06) 100%)',
                borderBottom: '1px solid rgba(99,102,241,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('notifications:title')}
                </h3>
                {unreadCount > 0 && (
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {t('notifications:unreadCount', { count: unreadCount })}
                  </p>
                )}
              </div>
              {unreadCount > 0 && (
                <motion.button
                  onClick={() => void markAllAsRead()}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '8px',
                  }}
                >
                  {t('notifications:markAllRead')}
                </motion.button>
              )}
            </div>

            {/* List */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {isLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {t('notifications:loading')}
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔕</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                    {t('notifications:empty')}
                  </p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <motion.div
                    key={n._id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => handleRowClick(n)}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      padding: '0.85rem 1.25rem',
                      cursor: n.relatedOrderId ? 'pointer' : 'default',
                      background: n.isRead ? 'transparent' : 'rgba(99,102,241,0.04)',
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (n.relatedOrderId) e.currentTarget.style.background = 'rgba(99,102,241,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(99,102,241,0.04)';
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: `${typeColor(n.type)}18`,
                        border: `1.5px solid ${typeColor(n.type)}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        flexShrink: 0,
                      }}
                    >
                      {typeIcon(n.type)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            fontWeight: n.isRead ? 500 : 700,
                            color: 'var(--text-primary)',
                            lineHeight: 1.3,
                          }}
                        >
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--primary)',
                              flexShrink: 0,
                              marginTop: '4px',
                            }}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          margin: '0.2rem 0 0',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        } as any}
                      >
                        {n.message}
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                        {relativeTime(n.createdAt, t)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid rgba(99,102,241,0.08)',
                background: 'rgba(99,102,241,0.02)',
              }}
            >
              <motion.button
                onClick={() => { navigate('/notifications'); setOpen(false); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: 'none',
                  border: '1.5px solid rgba(99,102,241,0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  transition: 'all 0.15s',
                }}
              >
                {t('notifications:viewAll')}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
