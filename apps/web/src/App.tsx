import { useEffect } from 'react';
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
import UserPage from './pages/UserPage';
import UsersPage from './pages/UsersPage';
import CreateUserPage from './pages/CreateUserPage';
import EditUserPage from './pages/EditUserPage';
import Layout from './components/Layout';
import ToastContainer from './components/Toast';

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { toasts, removeToast } = useToastStore();
  const setCurrentUser = useCartStore((s) => s.setCurrentUser);

  // Oturum devam ediyorsa (sayfa yenileme) kullanıcının sepetini yükle
  useEffect(() => {
    if (user?.id) {
      setCurrentUser(user.id);
    } else {
      setCurrentUser(null);
    }
  }, [user?.id, setCurrentUser]);

  return (
    <>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        {isAuthenticated ? (
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories/:categoryId/products" element={<ProductsPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/new" element={<CreateCustomerPage />} />
            <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="/customers/:customerId/edit" element={<EditCustomerPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/user" element={<UserPage />} />
            {/* Bağlantı ayarları hem admin hem de sales_rep için açık */}
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            {user?.role === 'admin' && (
              <>
                <Route path="/admin/pricing" element={<AdminPricingPage />} />
                <Route path="/admin/images" element={<AdminImagesPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/users/new" element={<CreateUserPage />} />
                <Route path="/users/:userId/edit" element={<EditUserPage />} />
              </>
            )}
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}

export default App;

