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

  if (user?.role !== 'customer') {
    return <Navigate to="/dashboard" replace />;
  }

  const isActive = (path: string) =>
    location.pathname === path ||
    location.pathname.startsWith(`${path}/`) ||
    (path === '/my-orders' && location.pathname.startsWith('/orders/'));

  return (
    <div className="customer-shell">
      <header className="customer-topbar">
        <Link to="/products" className="customer-brand">
          <span className="customer-brand-mark">DHY</span>
          <span>
            <strong>{customer?.naam || t('customerPortal.title')}</strong>
            <small>{user?.username || user?.email}</small>
          </span>
        </Link>

        <nav className="customer-nav">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className={isActive(link.to) ? 'active' : ''}>
              {link.label}
              {link.to === '/cart' && cartItemCount > 0 && <span className="customer-cart-badge">{cartItemCount}</span>}
            </Link>
          ))}
        </nav>

        <div className="customer-account">
          <LanguageSwitcher />
          <div>
            <strong>{customer?.naam || t('customerPortal.companyFallback')}</strong>
            <small>{user?.email || user?.username}</small>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            {t('navigation.logout')}
          </button>
        </div>
      </header>

      <main className="customer-main">
        <Outlet />
      </main>
    </div>
  );
}
