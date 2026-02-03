import { Outlet, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import api from '../services/api';
import dhyLogo from '../assets/image/DHY-logo.jpg';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [tokenTooltipOpen, setTokenTooltipOpen] = useState(false);

  // Token durumunu kontrol et
  const { data: connectionStatus } = useQuery({
    queryKey: ['connection-settings'],
    queryFn: async () => {
      try {
        const response = await api.get('/connection-settings');
        return response.data;
      } catch (error) {
        return { isTokenValid: false };
      }
    },
    enabled: !!user, // Sadece kullanıcı giriş yaptıysa
    refetchInterval: 30000, // 30 saniyede bir kontrol et
  });

  // Token otomatik yenileme (sadece kullanıcı login olduğunda ve aktifken)
  useEffect(() => {
    // Sadece kullanıcı login olduğunda ve admin ise çalış
    if (!user || user.role !== 'admin') return;

    const checkAndRefreshToken = async () => {
      // Sayfa aktif değilse token yenileme
      if (document.visibilityState === 'hidden') return;

      // Token durumunu kontrol et
      if (!connectionStatus?.tokenExpiresAt) return;

      const tokenExpiresAt = new Date(connectionStatus.tokenExpiresAt);
      const now = new Date();
      const timeUntilExpiry = tokenExpiresAt.getTime() - now.getTime();
      const fiveMinutes = 5 * 60 * 1000; // 5 dakika

      // Token süresi dolmuş veya 5 dakika içinde dolacaksa otomatik yenile
      if (timeUntilExpiry <= fiveMinutes) {
        try {
          const response = await api.post('/connection-settings/refresh-token');
          if (response.data.success) {
            queryClient.invalidateQueries({ queryKey: ['connection-settings'] });
            queryClient.invalidateQueries({ queryKey: ['company-info'] });
            console.log('Token otomatik olarak yenilendi');
          }
        } catch (error) {
          console.error('Token otomatik yenileme hatası:', error);
        }
      }
    };

    // İlk kontrol
    checkAndRefreshToken();

    // Her 30 saniyede bir kontrol et (sadece sayfa aktifken)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAndRefreshToken();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, connectionStatus?.tokenExpiresAt, connectionStatus?.isTokenValid, queryClient]);

  const isTokenValid = connectionStatus?.isTokenValid === true;
  const tokenExpiresAt = connectionStatus?.tokenExpiresAt
    ? new Date(connectionStatus.tokenExpiresAt)
    : null;

  // Kalan süreyi hesapla
  const getRemainingTime = () => {
    if (!tokenExpiresAt) return null;
    const now = new Date();
    const diff = tokenExpiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Süresi dolmuş';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} gün ${hours % 24} saat`;
    } else if (hours > 0) {
      return `${hours} saat ${minutes % 60} dakika`;
    } else {
      return `${minutes} dakika`;
    }
  };

  const remainingTime = getRemainingTime();

  // Dışarı tıklandığında tooltip'i kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (tokenTooltipOpen && !target.closest('[data-token-icon]')) {
        setTokenTooltipOpen(false);
      }
    };

    if (tokenTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [tokenTooltipOpen]);

  // Dışarı tıklandığında user menu'yu kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (userMenuOpen && !target.closest('[data-user-menu]')) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [userMenuOpen]);

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/products', label: 'Tüm Ürünler', icon: '🛍️' },
    { to: '/categories', label: 'Kategoriler', icon: '📁' },
    { to: '/customers', label: 'Müşteriler', icon: '👥' },
    { to: '/orders', label: 'Siparişler', icon: '📋' },
  ];

  const adminLinks =
    user?.role === 'admin'
      ? [
          // { to: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
          // { to: '/admin/pricing', label: 'Fiyat Kuralları', icon: '💰' },
          { to: '/admin/images', label: 'Resimler', icon: '🖼️' },
        ]
      : [];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.95) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          padding: 'clamp(0.5rem, 2vw, 0.75rem) 0',
          boxShadow: '0 2px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 clamp(0.75rem, 2vw, 1rem)',
            gap: 'clamp(0.5rem, 2vw, 0.75rem)',
          }}
        >
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0',
              flexShrink: 0,
            }}
          >
            <motion.div
              whileHover={{ y: -1 }}
              transition={{ duration: 0.2, type: 'spring', stiffness: 400 }}
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
              <motion.img
                src={dhyLogo}
                alt="DHY Food BV"
                style={{
                  height: 'clamp(40px, 7vw, 48px)',
                  width: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.15))',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(99, 102, 241, 0.08)',
                  padding: '3px',
                  background: 'white',
                }}
                whileHover={{
                  filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.25))',
                  borderColor: 'rgba(99, 102, 241, 0.15)',
                }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>
            {/* <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.h1
                style={{
                  fontSize: 'clamp(1.15rem, 3.5vw, 1.6rem)',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.4rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
                transition={{ duration: 0.2 }}
              >
                <span style={{ fontSize: '1em' }}>DHY</span>
                <span
                  style={{
                    fontSize: '0.65em',
                    fontWeight: 600,
                    opacity: 0.7,
                    letterSpacing: '0.05em',
                  }}
                >
                  ORDER
                </span>
              </motion.h1>
            </motion.div> */}
          </Link>

          {/* Token Durumu İkonu */}
          {user && (
            <motion.div
              data-token-icon
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '0.5rem',
              }}
              onMouseEnter={() => {
                setUserMenuOpen(false); // User menu'yu kapat
                if (isTokenValid && remainingTime) {
                  setTokenTooltipOpen(true);
                }
              }}
              onMouseLeave={() => {
                // Hover ile açıldıysa kapat
                if (tokenTooltipOpen) {
                  setTokenTooltipOpen(false);
                }
              }}
            >
              <motion.div
                animate={{
                  scale: isTokenValid ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: isTokenValid ? Infinity : 0,
                  ease: 'easeInOut',
                }}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: isTokenValid
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
                  border: `2.5px solid ${isTokenValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isTokenValid
                    ? '0 4px 12px rgba(16, 185, 129, 0.25)'
                    : '0 4px 12px rgba(239, 68, 68, 0.25)',
                  cursor: 'pointer',
                }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTokenValid && remainingTime) {
                    setTokenTooltipOpen(!tokenTooltipOpen);
                  } else {
                    navigate('/user');
                  }
                }}
              >
                <motion.div
                  animate={{
                    rotate: isTokenValid ? [0, 360] : 0,
                  }}
                  transition={{
                    duration: 3,
                    repeat: isTokenValid ? Infinity : 0,
                    ease: 'linear',
                  }}
                  style={{
                    fontSize: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                >
                  {isTokenValid ? (
                    <span style={{ fontSize: '1.5rem' }}>🔗</span>
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🔴</span>
                  )}
                </motion.div>
              </motion.div>
              {/* Pulse efekti - sadece aktif olduğunda */}
              {isTokenValid && (
                <motion.div
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.6, 0, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{
                    position: 'absolute',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '2px solid rgba(16, 185, 129, 0.3)',
                    zIndex: -1,
                  }}
                />
              )}

              {/* Tooltip - Kalan Süre */}
              <AnimatePresence>
                {tokenTooltipOpen && isTokenValid && remainingTime && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 16px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      color: 'white',
                      padding: '1rem 1.25rem',
                      borderRadius: '16px',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      minWidth: '220px',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                      zIndex: 10000,
                      pointerEvents: 'auto',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>⏱️</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Bağlantı Durumu</span>
                      </div>
                      <div
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Kalan Süre:</span>
                          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10b981' }}>
                            {remainingTime}
                          </span>
                        </div>
                        {tokenExpiresAt && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              opacity: 0.7,
                              fontWeight: 400,
                              marginTop: '0.25rem',
                            }}
                          >
                            {tokenExpiresAt.toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Tooltip ok */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: '12px',
                        height: '12px',
                        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
                        borderLeft: '1px solid rgba(16, 185, 129, 0.4)',
                        borderTop: '1px solid rgba(16, 185, 129, 0.4)',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Desktop Navigation */}
          <nav
            className="desktop-nav"
            style={{
              display: 'none',
              gap: '0.25rem',
              alignItems: 'center',
              flexWrap: 'wrap',
              flex: 1,
              justifyContent: 'center',
              margin: '0 1rem',
            }}
          >
            {navLinks.map((link) => (
              <motion.div
                key={link.to}
                whileHover={{ y: -1 }}
                whileTap={{ y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Link
                  to={link.to}
                  className="nav-link"
                  style={{
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    padding: '0.6rem 1rem',
                    borderRadius: '10px',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontSize: '0.9rem',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)';
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span style={{ fontSize: '1em' }}>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              </motion.div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <motion.div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                }}
                transition={{ duration: 0.2 }}
              >
                <motion.button
                  onClick={() => navigate('/cart')}
                  className="btn-primary"
                  style={{
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.9rem',
                    minHeight: '42px',
                    minWidth: '42px',
                    overflow: 'visible',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 3px 12px rgba(99, 102, 241, 0.3)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontWeight: 600,
                  }}
                  whileHover={{
                    boxShadow: '0 5px 16px rgba(99, 102, 241, 0.4)',
                    y: -1,
                  }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span style={{ fontSize: '1.1em' }}>🛒</span>
                  <span>Sepet</span>
                </motion.button>
                {cartItemCount > 0 && (
                  <motion.span
                    key={cartItemCount}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                      color: 'white',
                      borderRadius: '50%',
                      minWidth: '30px',
                      width: cartItemCount > 9 ? 'auto' : '30px',
                      height: '30px',
                      padding: cartItemCount > 9 ? '0 10px' : '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      boxShadow: '0 3px 12px rgba(236, 72, 153, 0.5)',
                      border: '2.5px solid white',
                      zIndex: 1000,
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                    whileHover={{
                      scale: 1.15,
                      rotate: [0, -8, 8, -8, 0],
                      transition: { duration: 0.4 },
                    }}
                  >
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </motion.span>
                )}
              </motion.div>

              {/* User Menu */}
              <motion.div
                data-user-menu
                style={{
                  position: 'relative',
                  display: 'inline-block',
                }}
              >
                <motion.button
                  data-user-menu
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="btn-secondary"
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    minHeight: '42px',
                    minWidth: '42px',
                    background: 'white',
                    border: '1.5px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '50%',
                    fontWeight: 600,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'visible',
                  }}
                  whileHover={{
                    background:
                      'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
                    borderColor: 'rgba(99, 102, 241, 0.35)',
                    scale: 1.05,
                    boxShadow: '0 3px 10px rgba(99, 102, 241, 0.15)',
                  }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span
                    style={{
                      fontSize: '1.5rem',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    {user?.email?.charAt(0).toUpperCase() || '👤'}
                  </span>
                </motion.button>

                {/* User Dropdown Menu */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      data-user-menu
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 0.75rem)',
                        right: 0,
                        minWidth: '220px',
                        background: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.1)',
                        padding: '0.75rem',
                        zIndex: 1001,
                        overflow: 'hidden',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* User Info */}
                      <div
                        style={{
                          padding: '0.75rem',
                          background:
                            'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                          borderRadius: '12px',
                          marginBottom: '0.5rem',
                          border: '1px solid rgba(99, 102, 241, 0.1)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '1.1rem',
                              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                            }}
                          >
                            {user?.email?.charAt(0).toUpperCase() || '👤'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <p
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                margin: 0,
                                fontSize: '0.9rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {user?.email || 'Kullanıcı'}
                            </p>
                            {user?.role && (
                              <p
                                style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--text-secondary)',
                                  margin: '0.25rem 0 0 0',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {user.role === 'admin' ? '👑 Admin' : '👤 Kullanıcı'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Admin Menu Items */}
                      {adminLinks.length > 0 && (
                        <>
                          {adminLinks.map((link, index) => (
                            <motion.div
                              key={link.to}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <Link
                                to={link.to}
                                onClick={() => setUserMenuOpen(false)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  textDecoration: 'none',
                                  color: 'var(--text-primary)',
                                  fontWeight: 500,
                                  padding: '0.75rem 1rem',
                                  borderRadius: '10px',
                                  transition: 'all 0.2s',
                                  fontSize: '0.9rem',
                                  marginBottom: '0.25rem',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background =
                                    'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)';
                                  e.currentTarget.style.color = 'var(--primary)';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = 'var(--text-primary)';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                <span style={{ fontSize: '1.2em' }}>{link.icon}</span>
                                <span>{link.label}</span>
                              </Link>
                            </motion.div>
                          ))}
                          <div
                            style={{
                              height: '1px',
                              background: 'rgba(99, 102, 241, 0.1)',
                              margin: '0.5rem 0',
                            }}
                          />
                        </>
                      )}

                      {/* User Info Link */}
                      <Link
                        to="/user"
                        onClick={() => setUserMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          textDecoration: 'none',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          padding: '0.75rem 1rem',
                          borderRadius: '10px',
                          transition: 'all 0.2s',
                          fontSize: '0.9rem',
                          marginBottom: '0.5rem',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)';
                          e.currentTarget.style.color = 'var(--primary)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <span style={{ fontSize: '1.2em' }}>👤</span>
                        <span>Kullanıcı Bilgileri</span>
                      </Link>

                      <div
                        style={{
                          height: '1px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          margin: '0.5rem 0',
                        }}
                      />

                      {/* Logout Button */}
                      <motion.button
                        onClick={() => {
                          logout();
                          setUserMenuOpen(false);
                        }}
                        className="btn-secondary"
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          minHeight: '42px',
                          background: 'white',
                          border: '1.5px solid rgba(239, 68, 68, 0.2)',
                          fontWeight: 600,
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          color: 'var(--danger)',
                        }}
                        whileHover={{
                          background:
                            'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                          borderColor: 'rgba(239, 68, 68, 0.35)',
                          y: -1,
                          boxShadow: '0 3px 10px rgba(239, 68, 68, 0.15)',
                        }}
                        whileTap={{ scale: 0.96 }}
                      >
                        <span style={{ fontSize: '1.1em' }}>🚪</span>
                        <span>Çıkış Yap</span>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <motion.button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              background: 'transparent',
              border: 'none',
              padding: '0.5rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              justifyContent: 'center',
            }}
            whileTap={{ scale: 0.9 }}
          >
            <motion.span
              animate={mobileMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
              style={{
                width: '24px',
                height: '3px',
                background: 'var(--primary)',
                borderRadius: '2px',
                transition: 'all 0.3s',
              }}
            />
            <motion.span
              animate={mobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
              style={{
                width: '24px',
                height: '3px',
                background: 'var(--primary)',
                borderRadius: '2px',
                transition: 'all 0.3s',
              }}
            />
            <motion.span
              animate={mobileMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
              style={{
                width: '24px',
                height: '3px',
                background: 'var(--primary)',
                borderRadius: '2px',
                transition: 'all 0.3s',
              }}
            />
          </motion.button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                overflow: 'hidden',
                background: 'white',
                borderTop: '1px solid rgba(0, 0, 0, 0.05)',
              }}
            >
              <div
                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                {navLinks.map((link) => (
                  <motion.div
                    key={link.to}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: navLinks.indexOf(link) * 0.05 }}
                  >
                    <Link
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        textDecoration: 'none',
                        color: 'var(--text-primary)',
                        fontWeight: 500,
                        padding: '1rem',
                        borderRadius: '12px',
                        transition: 'all 0.3s',
                        fontSize: '1rem',
                        minHeight: '44px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                        e.currentTarget.style.color = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{link.icon}</span>
                      <span>{link.label}</span>
                    </Link>
                  </motion.div>
                ))}
                {adminLinks.map((link) => (
                  <motion.div
                    key={link.to}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: (navLinks.length + adminLinks.indexOf(link)) * 0.05 }}
                  >
                    <Link
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        textDecoration: 'none',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        fontSize: '1rem',
                        minHeight: '48px',
                        background: 'transparent',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)';
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                        e.currentTarget.style.transform = 'translateX(5px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <span style={{ fontSize: '1.35rem', display: 'flex', alignItems: 'center' }}>
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6 }}>
                        🔒
                      </span>
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: (navLinks.length + adminLinks.length) * 0.05 }}
                  style={{
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    style={{
                      marginTop: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '2px solid rgba(99, 102, 241, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {/* User Info in Mobile */}
                    <div
                      style={{
                        padding: '0.75rem',
                        background:
                          'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                        borderRadius: '12px',
                        border: '1px solid rgba(99, 102, 241, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                        }}
                      >
                        {user?.email?.charAt(0).toUpperCase() || '👤'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <p
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0,
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {user?.email || 'Kullanıcı'}
                        </p>
                        {user?.role && (
                          <p
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              margin: '0.25rem 0 0 0',
                              textTransform: 'capitalize',
                            }}
                          >
                            {user.role === 'admin' ? '👑 Admin' : '👤 Kullanıcı'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Admin Links in Mobile */}
                    {adminLinks.length > 0 && (
                      <>
                        {adminLinks.map((link, index) => (
                          <motion.div
                            key={link.to}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: (navLinks.length + index) * 0.05 }}
                          >
                            <Link
                              to={link.to}
                              onClick={() => setMobileMenuOpen(false)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                textDecoration: 'none',
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                padding: '1rem 1.25rem',
                                borderRadius: '12px',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                fontSize: '1rem',
                                minHeight: '48px',
                                background: 'transparent',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                position: 'relative',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)';
                                e.currentTarget.style.color = 'var(--primary)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                                e.currentTarget.style.transform = 'translateX(5px)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.2)';
                                e.currentTarget.style.transform = 'translateX(0)';
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '1.35rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                {link.icon}
                              </span>
                              <span>{link.label}</span>
                              <span
                                style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6 }}
                              >
                                🔒
                              </span>
                            </Link>
                          </motion.div>
                        ))}
                        <div
                          style={{
                            height: '1px',
                            background: 'rgba(99, 102, 241, 0.1)',
                            margin: '0.5rem 0',
                          }}
                        />
                      </>
                    )}

                    <motion.div
                      style={{
                        position: 'relative',
                        width: '100%',
                      }}
                    >
                      <motion.button
                        onClick={() => {
                          navigate('/cart');
                          setMobileMenuOpen(false);
                        }}
                        className="btn-primary"
                        style={{
                          width: '100%',
                          padding: '1rem 1.25rem',
                          fontSize: '1rem',
                          minHeight: '48px',
                          overflow: 'visible',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          fontWeight: 600,
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span style={{ fontSize: '1.2em' }}>🛒</span>
                        <span>Sepet</span>
                      </motion.button>
                      {cartItemCount > 0 && (
                        <motion.span
                          key={cartItemCount}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                          style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '-10px',
                            background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                            color: 'white',
                            borderRadius: '50%',
                            minWidth: '34px',
                            width: cartItemCount > 9 ? 'auto' : '34px',
                            height: '34px',
                            padding: cartItemCount > 9 ? '0 12px' : '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(236, 72, 153, 0.6)',
                            border: '3px solid white',
                            zIndex: 1000,
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cartItemCount > 99 ? '99+' : cartItemCount}
                        </motion.span>
                      )}
                    </motion.div>
                    <motion.button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="btn-secondary"
                      style={{
                        width: '100%',
                        padding: '1rem 1.25rem',
                        fontSize: '1rem',
                        minHeight: '48px',
                        background: 'white',
                        border: '2px solid rgba(239, 68, 68, 0.2)',
                        fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        color: 'var(--danger)',
                      }}
                      whileHover={{
                        background:
                          'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                        borderColor: 'rgba(239, 68, 68, 0.35)',
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span style={{ fontSize: '1.1em' }}>🚪</span>
                      <span>Çıkış Yap</span>
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
