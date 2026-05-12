import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { useToastStore } from './store/toastStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CategoriesPage from './pages/CategoriesPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import CreateCustomerPage from './pages/CreateCustomerPage';
import EditCustomerPage from './pages/EditCustomerPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminPricingPage from './pages/AdminPricingPage';
import AdminImagesPage from './pages/AdminImagesPage';
import PriceWarningsPage from './pages/PriceWarningsPage';
import ProductVisibilityPage from './pages/ProductVisibilityPage';
import CategoryVisibilityPage from './pages/CategoryVisibilityPage';
import UserPage from './pages/UserPage';
import UsersPage from './pages/UsersPage';
import PortalAccountsPage from './pages/PortalAccountsPage';
import CreateUserPage from './pages/CreateUserPage';
import EditUserPage from './pages/EditUserPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import Layout from './components/Layout';
import CustomerLayout from './components/CustomerLayout';
import ToastContainer from './components/Toast';
import LegacyDomI18n from './components/LegacyDomI18n';
import { AdminPriceOverrideProvider } from './components/AdminPriceOverrideProvider';
import { normalizeLanguage, supportedLanguages } from './i18n/constants';
import { PermissionRoute, canManagePermissions, hasPermission } from './utils/permissions';

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { toasts, removeToast } = useToastStore();
  const setCurrentUser = useCartStore((s) => s.setCurrentUser);
  const { i18n } = useTranslation();
  const page = (permission: string, element: ReactNode) => (
    <PermissionRoute user={user} permission={permission} fallback={<AccessDeniedPage />}>
      {element}
    </PermissionRoute>
  );
  const customerPage = (permission: string, element: ReactNode) => (
    <PermissionRoute user={user} permission={permission} fallback={<Navigate to="/products" replace />}>
      {element}
    </PermissionRoute>
  );
  const guarded = (allowed: boolean, element: ReactNode) => (allowed ? element : <AccessDeniedPage />);
  const defaultPath = user?.role === 'customer' ? '/products' : '/';

  // Oturum devam ediyorsa (sayfa yenileme) kullanıcının sepetini yükle
  useEffect(() => {
    if (user?.id) {
      setCurrentUser(user.id);
    } else {
      setCurrentUser(null);
    }
  }, [user?.id, setCurrentUser]);

  useEffect(() => {
    const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
    const direction = supportedLanguages[language].direction;
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
    document.body.dataset.language = language;
    document.body.dataset.direction = direction;
  }, [i18n.language, i18n.resolvedLanguage]);

  return (
    <>
      <AdminPriceOverrideProvider>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to={defaultPath} />} />
          {isAuthenticated ? (
            user?.role === 'customer' ? (
              <Route element={<CustomerLayout />}>
                <Route path="/" element={<Navigate to="/products" replace />} />
                <Route path="/products" element={customerPage('products.view', <ProductsPage />)} />
                <Route path="/categories" element={customerPage('products.view', <CategoriesPage />)} />
                <Route path="/categories/:categoryId/products" element={customerPage('products.view', <ProductsPage />)} />
                <Route path="/products/:productId" element={customerPage('products.detail', <ProductDetailPage />)} />
                <Route path="/cart" element={customerPage('cart.use', <CartPage />)} />
                <Route path="/my-orders" element={customerPage('orders.my.view', <OrdersPage />)} />
                <Route path="/orders" element={<Navigate to="/my-orders" replace />} />
                <Route path="/orders/:orderId" element={customerPage('orders.my.view', <OrderDetailPage />)} />
                <Route path="/profile" element={<UserPage />} />
                <Route path="/user" element={<Navigate to="/profile" replace />} />
                <Route path="*" element={<Navigate to="/products" replace />} />
              </Route>
            ) : (
            <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={page('dashboard.view', <DashboardPage />)} />
            <Route path="/categories" element={page('products.view', <CategoriesPage />)} />
            <Route path="/products" element={page('products.view', <ProductsPage />)} />
            <Route path="/categories/:categoryId/products" element={page('products.view', <ProductsPage />)} />
            <Route path="/products/:productId" element={page('products.view', <ProductDetailPage />)} />
            <Route path="/cart" element={page('orders.create', <CartPage />)} />
            <Route path="/customers" element={page('customers.view', <CustomersPage />)} />
            <Route path="/customers/new" element={page('customers.manage', <CreateCustomerPage />)} />
            <Route path="/customers/:customerId" element={page('customers.view', <CustomerDetailPage />)} />
            <Route path="/customers/:customerId/edit" element={page('customers.manage', <EditCustomerPage />)} />
            <Route path="/orders" element={page('orders.view', <OrdersPage />)} />
            <Route path="/orders/:orderId" element={page('orders.view', <OrderDetailPage />)} />
            <Route path="/user" element={<UserPage />} />
            <Route path="/reports" element={page('reports.view', <ReportsPage />)} />
            <Route path="/audit" element={guarded(hasPermission(user, 'audit.view'), <AuditLogsPage />)} />
            <Route path="/admin/settings" element={page('snelstart.settings.manage', <AdminSettingsPage />)} />
            <Route path="/admin/pricing" element={page('pricing.manage', <AdminPricingPage />)} />
            <Route path="/admin/price-warnings" element={page('pricing.manage', <PriceWarningsPage />)} />
            <Route path="/admin/images" element={page('products.manage', <AdminImagesPage />)} />
            <Route path="/settings/product-visibility" element={page('products.manage', <ProductVisibilityPage />)} />
            <Route path="/settings/category-visibility" element={page('products.manage', <CategoryVisibilityPage />)} />
            <Route path="/users" element={guarded(canManagePermissions(user), <UsersPage />)} />
            <Route path="/portal-users" element={guarded(canManagePermissions(user), <PortalAccountsPage />)} />
            <Route path="/users/new" element={guarded(canManagePermissions(user), <CreateUserPage />)} />
            <Route path="/users/:userId/edit" element={guarded(canManagePermissions(user), <EditUserPage />)} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />
            </Route>
            )
          ) : (
            <Route path="*" element={<Navigate to="/login" />} />
          )}
        </Routes>
      </AdminPriceOverrideProvider>
      <LegacyDomI18n />
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

export default App;
