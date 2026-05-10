import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useAdminPriceOverride } from '../components/AdminPriceOverrideProvider';
import QuantityInput from '../components/QuantityInput';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import { validatePrice } from '../utils/priceValidation';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default function CartPage() {
  const { t } = useAppTranslation(['common', 'cart', 'products', 'errors']);
  const { formatCurrency } = useLocaleFormat();
  const { items, customerId, updateQuantity, updateUnitPrice, resetToOriginalPrice, removeItem, setCustomer, clear } = useCartStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const [localUnitPrices, setLocalUnitPrices] = useState<Record<string, string>>({});
  const [itemToRemove, setItemToRemove] = useState<{ productId: string; productName: string } | null>(null);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { confirmPriceOverride } = useAdminPriceOverride();

  // Debounce customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Close customer list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
      }
    };

    if (showCustomerList) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomerList]);

  // Sepet değiştikçe lokal birim fiyat state'ini senkronize et
  useEffect(() => {
    setLocalUnitPrices((prev) => {
      const next: Record<string, string> = {};
      for (const item of items) {
        const key = item.productId;
        if (prev[key] !== undefined) {
          next[key] = prev[key];
        } else {
          next[key] = (item.customUnitPrice ?? item.unitPrice).toFixed(2);
        }
      }
      return next;
    });
  }, [items]);

  // Fiyat hatası olan ürün var mı?
  const hasPriceErrors = useMemo(() => {
    return items.some((item) => {
      if (item.isChildItem) return false;
      const display = localUnitPrices[item.productId] ?? (item.customUnitPrice ?? item.unitPrice).toFixed(2);
      const raw = display.replace(',', '.').trim();
      if (raw === '') return true;
      const val = parseFloat(raw);
      if (Number.isNaN(val)) return true;
      const validation = validatePrice({
        price: val,
        basePrice: item.basePrice || item.unitPrice,
        purchasePrice: item.inkoopprijs,
      });
      return !validation.isValid && !(isAdmin && item.adminPriceOverrideConfirmed);
    });
  }, [items, localUnitPrices, isAdmin]);

  const { data: customersResponse, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customers', debouncedCustomerSearch],
    queryFn: async () => {
      const params: any = {
        page: '1',
        limit: '50',
      };
      if (debouncedCustomerSearch) {
        params.search = debouncedCustomerSearch;
      }
      const response = await api.get('/customers', { params });
      return response.data;
    },
  });

  const customers = customersResponse?.data || [];
  
  // Fetch selected customer separately if not in current list
  const { data: selectedCustomerData } = useQuery({
    queryKey: ['customer', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null;
      try {
        const response = await api.get(`/customers/${selectedCustomerId}`);
        return response.data;
      } catch (error) {
        return null;
      }
    },
    enabled: !!selectedCustomerId && !customers.find((c: any) => c.id === selectedCustomerId),
  });
  
  // Find selected customer for display - first check in current list, then fetched data
  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId) || selectedCustomerData;

  const { data: cartCalculation } = useQuery({
    queryKey: ['cart-calculation', items, selectedCustomerId],
    queryFn: async () => {
      const response = await api.post('/cart/calculate', {
        items: items
          .filter((item) => !item.isChildItem)
          .map((item) => ({ productId: item.productId, quantity: item.quantity })),
        customerId: selectedCustomerId || undefined,
      });
      return response.data;
    },
    enabled: items.some((item) => !item.isChildItem),
  });

  // Toplamları hesapla - sistem fiyatları KDV hariç tuttuğu için KDV ayrıca gösterilir
  const cartTotals = useMemo(() => {
    const breakdown = new Map<number, { vatRate: number; subtotalExclVat: number; vatAmount: number; totalInclVat: number }>();
    const subtotalExclVat = money(items.reduce((sum, item) => {
      const unitPrice = item.customUnitPrice ?? item.unitPrice;
      return sum + unitPrice * item.quantity;
    }, 0));

    for (const item of items) {
      const unitPrice = item.customUnitPrice ?? item.unitPrice;
      const lineSubtotalExclVat = money(unitPrice * item.quantity);
      const vatRate = Number(item.vatRate ?? item.vatPercentage ?? 0) || 0;
      const lineVatAmount = money((lineSubtotalExclVat * vatRate) / 100);
      const lineTotalInclVat = money(lineSubtotalExclVat + lineVatAmount);
      const current = breakdown.get(vatRate) || { vatRate, subtotalExclVat: 0, vatAmount: 0, totalInclVat: 0 };
      current.subtotalExclVat = money(current.subtotalExclVat + lineSubtotalExclVat);
      current.vatAmount = money(current.vatAmount + lineVatAmount);
      current.totalInclVat = money(current.totalInclVat + lineTotalInclVat);
      breakdown.set(vatRate, current);
    }

    const vatAmount = money(Array.from(breakdown.values()).reduce((sum, line) => sum + line.vatAmount, 0));
    const totalInclVat = money(subtotalExclVat + vatAmount);

    return {
      subtotal: subtotalExclVat,
      total: totalInclVat,
      subtotalExclVat,
      vatAmount,
      totalInclVat,
      vatBreakdown: Array.from(breakdown.values())
        .filter((line) => line.vatAmount > 0)
        .sort((a, b) => a.vatRate - b.vatRate),
    };
  }, [items]);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomerId) {
        throw new Error(t('cart:messages.selectCustomer'));
      }

      // Eğer customUnitPrice varsa, onu kullan; yoksa cartCalculation'dan gelen fiyatı kullan
      const orderItems = items.filter((item) => !item.isChildItem).map((item) => {
        const unitPrice = item.customUnitPrice ?? item.unitPrice;
        const totalPrice = unitPrice * item.quantity;
        return {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku || item.productId || 'N/A', // Fallback: sku yoksa productId veya 'N/A'
          quantity: item.quantity,
          unitPrice: unitPrice,
          basePrice: item.basePrice || item.unitPrice,
          totalPrice: totalPrice,
          vatPercentage: item.vatPercentage || 0,
          vatType: item.vatType ?? null,
          vatRate: item.vatRate ?? item.vatPercentage ?? 0,
          vatGroupId: item.vatGroupId,
          vatGroupName: item.vatGroupName,
          customUnitPrice: item.customUnitPrice,
          adminOverride: item.adminOverride,
          adminPriceOverrideConfirmed: item.adminPriceOverrideConfirmed,
          adminOverrideReason: item.adminOverrideReason,
          lineType: item.lineType,
          parentProductId: item.parentProductId,
        };
      });

      const response = await api.post('/orders', {
        idempotencyKey: generateUUID(),
        customerId: selectedCustomerId,
        items: orderItems,
      });
      return response.data;
    },
    onSuccess: () => {
      clear();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast(t('cart:messages.orderCreated'), 'success');
      navigate('/orders');
    },
    onError: (error: any) => {
      const apiMessage = error?.response?.data?.message;
      const message =
        apiMessage === 'PRICE_BELOW_MINIMUM'
          ? t('errors:priceBelowMinimumNoValue')
          : apiMessage === 'ADMIN_PRICE_OVERRIDE_REQUIRED'
            ? t('errors:adminPriceOverrideRequired')
            : error?.message || t('cart:messages.orderCreateError');
      showToast(message, 'error', 4000);
    },
  });

  if (items.length === 0) {
    return (
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ textAlign: 'center', padding: '4rem 2rem' }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: '5rem', marginBottom: '1rem' }}
          >
            🛒
          </motion.div>
          <h2 style={{ marginBottom: '1rem', fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700 }}>
            {t('cart:emptyTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {t('cart:emptyDescription')}
          </p>
          <motion.button
            onClick={() => navigate('/')}
            className="btn-primary"
            style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}
            whileTap={{ scale: 0.95 }}
          >
            🛍️ {t('actions.add')}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: 'clamp(1rem, 3vw, 2rem)',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1.5rem, 6vw, 2.5rem)',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: '1.2',
          }}
        >
          {t('cart:title')}
        </h2>
        {items.length > 0 && (
          <motion.button
            type="button"
            onClick={() => {
              clear();
              showToast(t('cart:messages.cartCleared'), 'success');
            }}
            className="btn-secondary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🗑️ {t('cart:clearCart')}
          </motion.button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ 
          marginBottom: '1.5rem', 
          position: 'relative', 
          zIndex: 100, 
          overflow: 'visible',
          isolation: 'isolate',
        }}
      >
        <label style={{ display: 'block', marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontWeight: 600, fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>
          👤 {t('cart:selectCustomer')}:
        </label>
        <div ref={customerSearchRef} style={{ position: 'relative', marginTop: '0.5rem', zIndex: 1000 }}>
          <input
            type="text"
            value={selectedCustomer ? selectedCustomer.naam : customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setShowCustomerList(true);
              if (selectedCustomerId && e.target.value !== selectedCustomer?.naam) {
                setSelectedCustomerId('');
                setCustomer(null);
              }
            }}
            onFocus={() => setShowCustomerList(true)}
            placeholder={t('cart:customerSearchPlaceholder')}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
            }}
          />
          {selectedCustomerId && (
            <button
              onClick={() => {
                setSelectedCustomerId('');
                setCustomer(null);
                setCustomerSearch('');
                setShowCustomerList(false);
              }}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0.25rem',
                zIndex: 1001,
              }}
              title={t('actions.clear')}
            >
              ✕
            </button>
          )}
          {showCustomerList && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '0.5rem',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 999999,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                isolation: 'isolate',
              }}
            >
              {isLoadingCustomers ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>{t('states.loading')}</div>
              ) : customers.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  {debouncedCustomerSearch ? t('states.empty') : t('actions.search')}
                </div>
              ) : (
                customers.map((customer: any) => (
                  <motion.div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerId(customer.id);
                      setCustomer(customer.id);
                      setCustomerSearch('');
                      setShowCustomerList(false);
                    }}
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e5e7eb',
                      background: selectedCustomerId === customer.id ? 'rgba(99, 102, 241, 0.1)' : '#ffffff',
                      color: '#1f2937',
                    }}
                    whileHover={{ background: '#f3f4f6' }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', color: '#1f2937' }}>{customer.naam}</div>
                    {customer.adres && (
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                        {customer.adres}
                        {customer.plaats && `, ${customer.plaats}`}
                      </div>
                    )}
                    {customer.relatiecode && (
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        {t('products:fields.code')}: {customer.relatiecode}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
        {selectedCustomer && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>✓ {t('cart:selectedCustomer')}</div>
            <div style={{ fontSize: '0.9rem' }}>{selectedCustomer.naam}</div>
            {selectedCustomer.adres && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {selectedCustomer.adres}
                {selectedCustomer.plaats && `, ${selectedCustomer.plaats}`}
              </div>
            )}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {items.map((item, index) => {
          const isChildItem = item.isChildItem === true;
          const displayPrice = localUnitPrices[item.productId] ?? (item.customUnitPrice ?? item.unitPrice).toFixed(2);
          const rawPrice = displayPrice.replace(',', '.').trim();
          const numericPrice = rawPrice === '' ? NaN : parseFloat(rawPrice);
          const validation = Number.isNaN(numericPrice)
            ? null
            : validatePrice({
                price: numericPrice,
                basePrice: item.basePrice || item.unitPrice,
                purchasePrice: item.inkoopprijs,
              });
          const hasPriceErrorForItem =
            !isChildItem &&
            (rawPrice === '' ||
              Number.isNaN(numericPrice) ||
              (!!validation && !validation.isValid && !(isAdmin && item.adminPriceOverrideConfirmed)));
          const lineUnitPriceExclVat = Number.isNaN(numericPrice) ? (item.customUnitPrice ?? item.unitPrice) : numericPrice;
          const lineSubtotalExclVat = money(lineUnitPriceExclVat * item.quantity);
          const lineVatRate = Number(item.vatRate ?? item.vatPercentage ?? 0) || 0;
          const lineVatAmount = money((lineSubtotalExclVat * lineVatRate) / 100);
          const lineTotalInclVat = money(lineSubtotalExclVat + lineVatAmount);

          return (
          <motion.div
            key={item.productId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.05 }}
            className="card"
            style={{
              marginBottom: '0.75rem',
              marginLeft: isChildItem ? 'clamp(1rem, 5vw, 2rem)' : 0,
              padding: '0.75rem',
              display: 'grid',
              gridTemplateColumns: (item as any).coverImageUrl ? '60px 1fr auto' : '1fr auto',
              gap: '0.75rem',
              position: 'relative',
              zIndex: 1,
              alignItems: 'start',
              borderColor: hasPriceErrorForItem ? 'rgba(239, 68, 68, 0.6)' : undefined,
              boxShadow: hasPriceErrorForItem
                ? '0 0 0 1px rgba(239, 68, 68, 0.4), 0 10px 15px -3px rgba(239, 68, 68, 0.3)'
                : undefined,
              background: hasPriceErrorForItem
                ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.9), rgba(254, 242, 242, 0.9))'
                : isChildItem
                  ? 'rgba(16, 185, 129, 0.06)'
                : undefined,
            }}
          >
            {/* Ürün Resmi - Küçük ve kompakt */}
            {(item as any).coverImageUrl && (
              <motion.div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f0f0f0',
                  flexShrink: 0,
                  position: 'relative',
                }}
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <motion.img
                  src={(item as any).coverImageUrl}
                  alt={item.productName}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </motion.div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ marginBottom: '0.25rem', fontSize: 'clamp(0.9rem, 3vw, 1rem)', fontWeight: 600, lineHeight: '1.3' }}>
                {isChildItem ? `${t('cart:automaticProductPrefix')} ` : ''}{item.isMissingChild ? t('products:missingChildProduct') : item.productName}
              </h4>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                {/* <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.75rem, 2.5vw, 0.8rem)' }}>SKU: {item.sku}</p> */}
                {isChildItem && (
                  <p style={{
                    color: 'var(--success)',
                    fontSize: 'clamp(0.75rem, 2.5vw, 0.8rem)',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.12)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                  }}>
                    {t('cart:linkedToParent')}
                  </p>
                )}
                {item.isMissingChild && (
                  <p style={{
                    color: 'var(--danger)',
                    fontSize: 'clamp(0.75rem, 2.5vw, 0.8rem)',
                    fontWeight: 600,
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                  }}>
                    {t('cart:articleCode')}: {item.childArtikelcode || item.sku}
                  </p>
                )}
                {item.eenheid && (
                  <p style={{ 
                    color: 'var(--primary)', 
                    fontSize: 'clamp(0.75rem, 2.5vw, 0.8rem)', 
                    fontWeight: 600,
                    background: 'rgba(99, 102, 241, 0.1)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                  }}>
                    {t('products:fields.unit')}: {item.eenheid}
                  </p>
                )}
              </div>
              
              {/* Kompakt Fiyat ve Miktar Bölümü */}
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}>
                {/* Birim Fiyat */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={displayPrice}
                      disabled={isChildItem}
                      onChange={async (e) => {
                        if (isChildItem) return;
                        const displayValue = e.target.value;
                        const raw = displayValue.replace(',', '.');
                        // Önce local state'i güncelle ki input gerçekten boş kalabilsin
                        setLocalUnitPrices((prev) => ({
                          ...prev,
                          [item.productId]: displayValue,
                        }));

                        // Kullanıcı silerken hemen 0'a düşmesin, boşsa store'a yazma
                        if (raw.trim() === '') {
                          return;
                        }

                        const newPrice = parseFloat(raw);
                        if (Number.isNaN(newPrice)) {
                          return;
                        }
                        const priceValidation = validatePrice({
                          price: newPrice,
                          basePrice: item.basePrice || item.unitPrice,
                          purchasePrice: item.inkoopprijs,
                        });
                        let adminOverride = false;
                        let adminPriceOverrideConfirmed = item.adminPriceOverrideConfirmed;

                        if (!priceValidation.isValid) {
                          if (!isAdmin) {
                            showToast(
                              `⚠️ ${t('errors:priceBelowMinimum', { minPrice: formatCurrency(priceValidation.minPrice) })}`,
                              'error',
                              4000,
                            );
                            return;
                          }

                          adminOverride = true;
                          if (!adminPriceOverrideConfirmed) {
                            adminPriceOverrideConfirmed = await confirmPriceOverride({
                              minPrice: formatCurrency(priceValidation.minPrice),
                            });
                            if (!adminPriceOverrideConfirmed) {
                              setLocalUnitPrices((prev) => ({
                                ...prev,
                                [item.productId]: (item.customUnitPrice ?? item.unitPrice).toFixed(2),
                              }));
                              return;
                            }
                          }
                        }
                        
                        updateUnitPrice(item.productId, newPrice, {
                          adminOverride,
                          adminPriceOverrideConfirmed,
                          adminOverrideReason: adminPriceOverrideConfirmed
                            ? 'PRICE_BELOW_MINIMUM_CONFIRMED'
                            : undefined,
                        });
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        minHeight: '36px',
                        opacity: isChildItem ? 0.65 : 1,
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>€</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 600 }}>
                    {t('cart:exclVat')}
                  </span>
                </div>

                {/* Miktar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500 }}>
                    {t('products:fields.quantity')}:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <QuantityInput
                      className="quantity-input"
                      value={item.quantity}
                      onCommit={(newQuantity) => {
                        if (!isChildItem) updateQuantity(item.productId, newQuantity);
                      }}
                      max={item.voorraad}
                      ariaLabel={`${item.productName} ${t('products:fields.quantity')}`}
                      disabled={isChildItem}
                      style={{ 
                        width: '60px',
                        padding: '0.5rem',
                        textAlign: 'center',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        minHeight: '36px',
                        opacity: isChildItem ? 0.65 : 1,
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{t('format.unit')}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500 }}>
                    {t('cart:lineTotal')}
                  </label>
                  <div
                    style={{
                      minHeight: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: isChildItem ? 'var(--success)' : 'var(--text-primary)',
                    }}
                  >
                    {formatCurrency(lineSubtotalExclVat)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500 }}>
                    {t('cart:vatRate', { rate: lineVatRate })}
                  </label>
                  <div style={{ minHeight: '36px', display: 'flex', alignItems: 'center', fontSize: '0.9rem', fontWeight: 700 }}>
                    {formatCurrency(lineVatAmount)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 500 }}>
                    {t('cart:inclVat')}
                  </label>
                  <div style={{ minHeight: '36px', display: 'flex', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatCurrency(lineTotalInclVat)}
                  </div>
                </div>
              </div>
              {hasPriceErrorForItem && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 500 }}>
                  {t('errors:generic')}
                </div>
              )}

              {/* İndirim ve Orijinal Fiyat Bilgisi */}
              {item.customUnitPrice !== undefined && item.customUnitPrice !== item.unitPrice && item.unitPrice > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    color: 'var(--text-secondary)',
                    textDecoration: 'line-through',
                    opacity: 0.7
                  }}>
                    {t('cart:restoreOriginalPrice')}: {formatCurrency(item.unitPrice)}
                  </span>
                  {(() => {
                    const discountPercentage = ((item.unitPrice - item.customUnitPrice) / item.unitPrice) * 100;
                    return (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--success)',
                        fontWeight: 600,
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                      }}>
                        %{discountPercentage.toFixed(1)} {t('products:fields.discount')}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Butonlar - Sağ tarafta dikey */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch' }}>
              {item.customUnitPrice !== undefined && item.customUnitPrice !== item.unitPrice && (
                <motion.button
                  onClick={() => {
                    resetToOriginalPrice(item.productId);
                    setLocalUnitPrices((prev) => ({
                      ...prev,
                      [item.productId]: item.unitPrice.toFixed(2),
                    }));
                    showToast(t('cart:messages.priceRestored', { name: item.productName }), 'success', 2500);
                  }}
                  className="btn-secondary"
                  style={{ 
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    minHeight: '36px',
                    minWidth: '80px',
                  }}
                  whileTap={{ scale: 0.98 }}
                  title={t('cart:restoreOriginalPrice')}
                >
                  🔄
                </motion.button>
              )}
              {!isChildItem && (
                <motion.button
                  onClick={() => {
                    setItemToRemove({ productId: item.productId, productName: item.productName });
                  }}
                  className="btn-danger"
                  style={{ 
                    padding: '0.5rem',
                    minHeight: '36px',
                    minWidth: '36px',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  title={t('cart:removeProduct')}
                >
                  🗑️
                </motion.button>
              )}
            </div>
          </motion.div>
        )})}
      </AnimatePresence>

      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '2px solid rgba(99, 102, 241, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              fontSize: 'clamp(1rem, 4vw, 1.1rem)',
              fontWeight: 500,
            }}
          >
            <span>{t('cart:amount')}</span>
            <span>{formatCurrency(cartTotals.subtotalExclVat)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
              fontSize: 'clamp(1rem, 4vw, 1.1rem)',
              fontWeight: 500,
            }}
          >
            <span>{t('cart:vat')}</span>
            <span>{formatCurrency(cartTotals.vatAmount)}</span>
          </div>
          {cartTotals.vatBreakdown.map((line) => (
            <div
              key={line.vatRate}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
              }}
            >
              <span>{t('cart:vatRate', { rate: line.vatRate })}</span>
              <span>{formatCurrency(line.vatAmount)}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'clamp(1.5rem, 6vw, 1.75rem)',
              fontWeight: 700,
              paddingTop: '1rem',
              borderTop: '2px solid rgba(99, 102, 241, 0.2)',
              marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            <span>{t('cart:totalAmount')}</span>
            <span>{formatCurrency(cartTotals.totalInclVat)}</span>
          </div>
          <motion.button
            onClick={() => !hasPriceErrors && createOrderMutation.mutate()}
            className="btn-success"
            style={{ 
              width: '100%', 
              padding: 'clamp(0.875rem, 3vw, 1rem)', 
              fontSize: 'clamp(1rem, 4vw, 1.1rem)', 
              fontWeight: 600,
              minHeight: '52px',
              opacity: hasPriceErrors ? 0.6 : 1,
              cursor: hasPriceErrors ? 'not-allowed' : 'pointer',
            }}
            disabled={!selectedCustomerId || createOrderMutation.isPending || hasPriceErrors}
            whileTap={{ scale: selectedCustomerId && !createOrderMutation.isPending && !hasPriceErrors ? 0.98 : 1 }}
          >
            {createOrderMutation.isPending ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>
                <span className="loading" />
                {t('cart:creatingOrder')}
              </span>
            ) : (
              `✅ ${t('cart:createOrder')}`
            )}
          </motion.button>
          {createOrderMutation.error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                color: 'var(--danger)',
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                fontWeight: 500,
              }}
            >
              {createOrderMutation.error.message}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Silme Onay Modalı */}
      <AnimatePresence>
        {itemToRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setItemToRemove(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="card"
              style={{
                maxWidth: '420px',
                width: '100%',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-xl)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗑️</div>
                <h3
                  style={{
                    fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                  }}
                >
                  {t('cart:removeProduct')}
                </h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                  <strong>{itemToRemove.productName}</strong> {t('cart:confirmRemoveDescription')}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'flex-end',
                }}
              >
                <motion.button
                  onClick={() => setItemToRemove(null)}
                  className="btn-secondary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('actions.cancel')}
                </motion.button>
                <motion.button
                  onClick={() => {
                    removeItem(itemToRemove.productId);
                    showToast(t('cart:messages.removed', { name: itemToRemove.productName }), 'info', 2500);
                    setItemToRemove(null);
                  }}
                  className="btn-danger"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t('actions.remove')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
