import { useEffect, useId, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import api from '../services/api';

export default function CustomerLayout() {
  const { t } = useAppTranslation('common');
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const navPanelId = useId();
  const cartItemCount = items.reduce((sum, item) => item.isChildItem ? sum : sum + item.quantity, 0);
  const links = [
    { to: '/products', label: t('navigation.products') },
    { to: '/categories', label: t('navigation.categories') },
    { to: '/cart', label: t('navigation.cart') },
    { to: '/my-orders', label: t('navigation.myOrders') },
    { to: '/profile', label: t('navigation.userInfo') },
  ];

  const { data: customer } = useQuery({
    queryKey: ['portal-customer', user?.customerId],
    queryFn: async () => {
      const response = await api.get(`/customers/${user?.customerId}`);
      return response.data;
    },
    enabled: !!user?.customerId,
  });

  const isActive = (path: string) =>
    location.pathname === path ||
    location.pathname.startsWith(`${path}/`) ||
    (path === '/my-orders' && location.pathname.startsWith('/orders/'));

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [navOpen]);

  if (user?.role !== 'customer') {
    return <Navigate to="/dashboard" replace />;
  }

  const closeNav = () => setNavOpen(false);

  return (
    <div className="customer-shell">
      <header className={`customer-topbar${navOpen ? ' customer-topbar--nav-open' : ''}`}>
        <Link to="/products" className="customer-brand" onClick={closeNav}>
          <span className="customer-brand-mark">DHY</span>
          <span className="customer-brand-text">
            <strong>{customer?.naam || t('customerPortal.title')}</strong>
            <small>{user?.username || user?.email}</small>
          </span>
        </Link>

        <button
          type="button"
          className="customer-nav-toggle"
          aria-expanded={navOpen}
          aria-controls={navPanelId}
          onClick={() => setNavOpen((o) => !o)}
        >
          <span className="customer-nav-toggle-icon" aria-hidden>
            <span className="customer-nav-toggle-bar" />
            <span className="customer-nav-toggle-bar" />
            <span className="customer-nav-toggle-bar" />
          </span>
          <span className="customer-nav-toggle-label">{navOpen ? t('navigation.closeMenu') : t('navigation.openMenu')}</span>
        </button>

        <div id={navPanelId} className={`customer-panel${navOpen ? ' customer-panel--open' : ''}`}>
          <nav className="customer-nav" aria-label={t('customerPortal.title')}>
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={isActive(link.to) ? 'active' : ''}
                onClick={closeNav}
              >
                {link.label}
                {link.to === '/cart' && cartItemCount > 0 && <span className="customer-cart-badge">{cartItemCount}</span>}
              </Link>
            ))}
          </nav>

          <div className="customer-account">
            <LanguageSwitcher mobile />
            <div className="customer-account-meta">
              <strong>{customer?.naam || t('customerPortal.companyFallback')}</strong>
              <small>{user?.email || user?.username}</small>
            </div>
            <button
              type="button"
              className="customer-logout-btn"
              onClick={() => {
                closeNav();
                logout();
                navigate('/login');
              }}
            >
              {t('navigation.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}
