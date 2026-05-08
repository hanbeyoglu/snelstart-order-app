import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { useAdminPriceOverride } from '../components/AdminPriceOverrideProvider';
import QuantityInput from '../components/QuantityInput';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import { validatePrice } from '../utils/priceValidation';

export default function ProductsPage() {
  const { t } = useAppTranslation(['common', 'products']);
  const { formatCurrency } = useLocaleFormat();
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId');
  const groupIdFromUrl = searchParams.get('groupId') || categoryId || '';
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    groupIdFromUrl ? [groupIdFromUrl] : []
  );
  const groupIds = selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('name_asc');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');

  // Dropdown kapandığında kategori arama metnini temizle
  useEffect(() => {
    if (!categoryDropdownOpen) setCategorySearchTerm('');
  }, [categoryDropdownOpen]);

  // URL'deki kategori değişince seçimi güncelle (örn. kategoriler sayfasından gelince)
  useEffect(() => {
    setSelectedCategoryIds(groupIdFromUrl ? [groupIdFromUrl] : []);
  }, [groupIdFromUrl]);
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const cartItems = useCartStore((state) => state.items);
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const { confirmPriceOverride } = useAdminPriceOverride();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Debounce search input - increased delay for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search change
    }, 600); // 600ms delay - reduced unnecessary API calls

    return () => clearTimeout(timer);
  }, [search]);

  // Filtre veya sıralama değişince sayfayı sıfırla
  useEffect(() => {
    setPage(1);
  }, [sortBy, inStockOnly, selectedCategoryIds]);

  const { data: productsResponse, isLoading } = useQuery({
    queryKey: ['products', groupIds, debouncedSearch, customerId, page, sortBy, inStockOnly],
    queryFn: async () => {
      const params: any = {
        page: page.toString(),
        limit: '20',
      };
      if (groupIds?.length) params.groupIds = groupIds.join(',');
      if (debouncedSearch && debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (customerId) params.customerId = customerId;
      if (sortBy) params.sortBy = sortBy;
      if (inStockOnly) params.inStockOnly = 'true';
      const response = await api.get('/products', { params });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
    enabled: true, // Always enabled
  });

  const products = productsResponse?.data || [];
  const pagination = productsResponse?.pagination;

  // Kategorileri listele (filtre dropdown için)
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!categories.length || selectedCategoryIds.length === 0) return;

    const visibleCategoryIds = new Set(categories.map((category: { id: string }) => category.id));
    setSelectedCategoryIds((prev) => {
      const next = prev.filter((id) => visibleCategoryIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [categories, selectedCategoryIds]);

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/products/sync');
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast(t('products:messages.syncSuccess'), 'success');
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      } else {
        showToast(data.message || t('products:messages.syncFailed'), 'error');
      }
      setIsSyncing(false);
    },
    onError: (error: any) => {
      showToast(
        error.response?.data?.message || t('products:messages.syncError'),
        'error'
      );
      setIsSyncing(false);
    },
  });

  const handleSync = async () => {
    setIsSyncing(true);
    syncMutation.mutate();
  };

  const getStockLimit = (product: any) => {
    const stock = Number(product.voorraad);
    return Number.isFinite(stock) ? Math.max(0, stock) : Infinity;
  };

  const isOutOfStock = (product: any) => {
    const stock = Number(product.voorraad);
    return Number.isFinite(stock) && stock <= 0;
  };

  const getCartItem = (productId: string) =>
    cartItems.find((item) => item.productId === productId);

  const getCartQuantity = (productId: string) => getCartItem(productId)?.quantity || 0;

  const handleAddToCart = async (product: any, event?: any) => {
    event?.stopPropagation();
    const currentQuantity = getCartQuantity(product.id);
    const stockLimit = getStockLimit(product);

    if (isOutOfStock(product)) {
      showToast(t('products:messages.outOfStock'), 'error');
      return;
    }

    if (currentQuantity >= stockLimit) {
      showToast(t('products:messages.stockLimit', { count: stockLimit }), 'error');
      return;
    }

    const unitPrice = product.finalPrice || product.basePrice || 0;
    const basePrice = product.basePrice || unitPrice;
    const existingCartItem = getCartItem(product.id);
    const validation = validatePrice({
      price: unitPrice,
      basePrice,
      purchasePrice: product.inkoopprijs,
    });
    let adminOverride = false;
    let adminPriceOverrideConfirmed = existingCartItem?.adminPriceOverrideConfirmed || false;

    if (!validation.isValid) {
      if (!isAdmin) {
        if (validation.rule === 'base-price') {
          showToast(
            `⚠️ ${t('products:messages.belowBasePrice', { basePrice: formatCurrency(basePrice), minPrice: formatCurrency(validation.minPrice) })}`,
            'error',
            5000,
          );
        } else {
          showToast(
            `⚠️ ${t('products:messages.belowPurchasePrice', { purchasePrice: '', minPrice: formatCurrency(validation.minPrice) })}`,
            'error',
            5000,
          );
        }
        return;
      }

      adminOverride = true;
      if (!adminPriceOverrideConfirmed) {
        adminPriceOverrideConfirmed = await confirmPriceOverride({ minPrice: formatCurrency(validation.minPrice) });
        if (!adminPriceOverrideConfirmed) return;
      }
    }

    addItem({
      productId: product.id,
      productName: product.omschrijving,
      sku: product.artikelnummer,
      categoryId: product.artikelomzetgroepId || product.artikelgroepId,
      quantity: 1,
      unitPrice,
      basePrice,
      totalPrice: unitPrice,
      vatPercentage: product.btwPercentage || 0,
      ...(adminOverride && {
        adminOverride: true,
        adminPriceOverrideConfirmed,
        adminOverrideReason: 'PRICE_BELOW_MINIMUM_CONFIRMED',
      }),
      // Alış fiyatını kaydet (minimum fiyat kontrolü için)
      ...(product.inkoopprijs !== undefined &&
        product.inkoopprijs !== null && { inkoopprijs: product.inkoopprijs }),
      // Birim bilgisini ekle
      ...(product.eenheid && { eenheid: product.eenheid }),
      // Kapak resmi URL'ini ekle
      ...(product.coverImageUrl && { coverImageUrl: product.coverImageUrl }),
      ...(product.voorraad !== undefined && product.voorraad !== null && { voorraad: product.voorraad }),
    });
    showToast(t('products:messages.addedToCart', { name: product.omschrijving }), 'success');
  };

  const handleCartQuantityChange = (product: any, nextQuantity: number, event: any) => {
    event.stopPropagation();
    const stockLimit = getStockLimit(product);

    if (nextQuantity > stockLimit) {
      showToast(t('products:messages.stockLimit', { count: stockLimit }), 'error');
      return;
    }

    updateQuantity(product.id, Math.max(0, nextQuantity));
  };

  if (isLoading) {
    return (
      <div className="container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
            }}
          />
        </div>
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
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: 'clamp(1rem, 3vw, 2rem)',
          alignItems: 'stretch',
        }}
      >
        <motion.input
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          type="text"
          placeholder={`🔍 ${t('products:searchPlaceholder')}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            minHeight: '48px',
            fontSize: '16px',
            padding: '0.875rem 1rem',
          }}
        />

        {/* Filtre ve sıralama */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Çoklu kategori seçimi */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen((o) => !o)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '0.5rem 0.75rem',
                fontSize: '0.95rem',
                borderRadius: '8px',
                border: '1px solid var(--border, #e5e7eb)',
                background: 'var(--bg-secondary, #fff)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
              aria-label={t('products:selectCategories')}
              aria-expanded={categoryDropdownOpen}
            >
              <span>
                {selectedCategoryIds.length === 0
                  ? t('states.all')
                  : t('pagination.showing', { from: selectedCategoryIds.length, to: selectedCategoryIds.length, total: categories.length })}
              </span>
              <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
                {categoryDropdownOpen ? '▲' : '▼'}
              </span>
            </button>
            {categoryDropdownOpen && (
              <>
                <div
                  role="presentation"
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10,
                  }}
                  onClick={() => setCategoryDropdownOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    minHeight: '200px',
                    maxHeight: '320px',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #e5e7eb)',
                    background: 'var(--bg-secondary, #fff)',
                    boxShadow: 'var(--shadow, 0 4px 12px rgba(0,0,0,0.15))',
                    zIndex: 20,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <input
                    type="text"
                    placeholder={t('products:categorySearchPlaceholder')}
                    value={categorySearchTerm}
                    onChange={(e) => setCategorySearchTerm(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.6rem',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border, #e5e7eb)',
                      background: 'var(--bg-secondary, #fff)',
                      color: 'var(--text-primary)',
                      boxSizing: 'border-box',
                      flexShrink: 0,
                    }}
                    aria-label={t('products:categorySearchPlaceholder')}
                  />
                  <div
                    style={{
                      overflowY: 'auto',
                      flex: '1 1 0',
                      minHeight: '160px',
                      maxHeight: '240px',
                    }}
                  >
                    {categories.length === 0 ? (
                      <div
                        style={{
                          padding: '0.75rem',
                          fontSize: '0.9rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {t('states.loading')}
                      </div>
                    ) : (
                      <>
                        {categories
                          .filter(
                            (cat: { id: string; omschrijving: string }) =>
                              !categorySearchTerm.trim() ||
                              cat.omschrijving
                                .toLowerCase()
                                .includes(categorySearchTerm.trim().toLowerCase())
                          )
                          .map((cat: { id: string; omschrijving: string }) => (
                            <label
                              key={cat.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.6rem',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategoryIds.includes(cat.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCategoryIds((prev) => [...prev, cat.id]);
                                  } else {
                                    setSelectedCategoryIds((prev) =>
                                      prev.filter((id) => id !== cat.id)
                                    );
                                  }
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  accentColor: 'var(--primary)',
                                }}
                              />
                              {cat.omschrijving}
                            </label>
                          ))}
                      </>
                    )}
                  </div>
                  {categories.length > 0 &&
                    categories.filter(
                      (c: { omschrijving: string }) =>
                        !categorySearchTerm.trim() ||
                        c.omschrijving
                          .toLowerCase()
                          .includes(categorySearchTerm.trim().toLowerCase())
                    ).length === 0 && (
                      <div
                        style={{
                          padding: '0.5rem 0.6rem',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          flexShrink: 0,
                        }}
                      >
                        {t('states.empty')}
                      </div>
                    )}
                  {selectedCategoryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryIds([])}
                      style={{
                        marginTop: '0.25rem',
                        padding: '0.4rem 0.6rem',
                        fontSize: '0.85rem',
                        color: 'var(--primary)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        width: '100%',
                        textAlign: 'left',
                        borderRadius: '6px',
                      }}
                    >
                      {t('actions.clear')}
                    </button>
                  )}
                </div>
              </>
            )}
            {selectedCategoryIds.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  marginTop: '0.5rem',
                }}
              >
                {selectedCategoryIds.map((id) => {
                  const cat = categories.find((c: { id: string }) => c.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.8rem',
                        borderRadius: '999px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {cat?.omschrijving ?? id}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategoryIds((prev) => prev.filter((x) => x !== id))
                        }
                        aria-label={t('actions.remove')}
                        style={{
                          padding: 0,
                          margin: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          lineHeight: 1,
                          opacity: 0.8,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              flex: '1 1 200px',
              minHeight: '44px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--bg-secondary, #fff)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            aria-label={t('products:sort.label')}
          >
            <option value="name_asc">{t('products:sort.nameAsc')}</option>
            <option value="name_desc">{t('products:sort.nameDesc')}</option>
            <option value="price_asc">{t('products:sort.priceAsc')}</option>
            <option value="price_desc">{t('products:sort.priceDesc')}</option>
            <option value="stock_desc">{t('products:sort.stockDesc')}</option>
          </select>
          {/* <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              aria-label={t('products:inStockOnly')}
            />
            {t('products:inStockOnly')}
          </label> */}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleSync}
          disabled={isSyncing}
          className="btn-primary"
          whileTap={!isSyncing ? { scale: 0.98 } : {}}
          style={{
            opacity: isSyncing ? 0.6 : 1,
            cursor: isSyncing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            minHeight: '48px',
            fontSize: 'clamp(0.9rem, 3vw, 1rem)',
          }}
        >
          {isSyncing ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                }}
              />
              <span style={{ fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                {t('states.syncing')}
              </span>
            </>
          ) : (
            <>🔄 {t('actions.sync')}</>
          )}
        </motion.button>
      </motion.div>

      <div className="responsive-grid">
        {products?.map((product: any, index: number) => {
          const cartQuantity = getCartQuantity(product.id);
          const outOfStock = isOutOfStock(product);
          const stockLimit = getStockLimit(product);
          const isAtStockLimit = Number.isFinite(stockLimit) && cartQuantity >= stockLimit;

          return (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="card product-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/products/${product.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(`/products/${product.id}`);
              }
            }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
              padding: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {/* Product Image - Square - Responsive with object-fit: cover */}
            {product.coverImageUrl ? (
              <motion.div
                style={{
                  width: '100%',
                  paddingTop: '100%',
                  position: 'relative',
                  marginBottom: '0.5rem',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f0f0f0',
                  flexShrink: 0,
                  minHeight: 0,
                }}
              >
                <motion.img
                  src={product.coverImageUrl}
                  alt={product.omschrijving}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    minWidth: 0,
                    minHeight: 0,
                  }}
                  transition={{ duration: 0.3 }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </motion.div>
            ) : (
              <div
                style={{
                  width: '100%',
                  paddingTop: '100%',
                  marginBottom: '0.5rem',
                  borderRadius: '8px',
                  background:
                    'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  flexShrink: 0,
                  position: 'relative',
                  minHeight: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  📦
                </span>
              </div>
            )}

            {/* Product Name - Daha görünür font */}
            <h3
              style={{
                marginBottom: '0.5rem',
                fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: '1.35',
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minHeight: '6.75em',
                maxHeight: '6.75em',
                flexShrink: 0,
              }}
              title={product.omschrijving}
            >
              {product.omschrijving}
            </h3>

            {/* Product Info - Compact */}
            <div
              style={{
                marginBottom: '0.5rem',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                flexShrink: 0,
              }}
            >
              <p style={{ margin: '0.25rem 0' }}>
                {t('products:fields.unit')}: <strong>{product.eenheid || t('products:fields.unitFallback')}</strong>
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                {t('products:fields.stock')}:{' '}
                <span
                  style={{
                    color: product.voorraad > 0 ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 600,
                  }}
                >
                  {product.voorraad ?? 'N/A'}
                </span>
              </p>
            </div>

            {/* Price - Compact */}
            <div
              style={{
                padding: '0.5rem',
                background:
                  'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                flexShrink: 0,
              }}
            >
              {product.finalPrice !== product.basePrice && (
                <p
                  style={{
                    textDecoration: 'line-through',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    marginBottom: '0.15rem',
                    margin: 0,
                  }}
                >
                  €{product.basePrice?.toFixed(2)}
                </p>
              )}
              <p
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                }}
              >
                €{product.finalPrice?.toFixed(2) || product.basePrice?.toFixed(2) || '0.00'}
              </p>
            </div>

            {/* Cart controls - Compact */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                flexDirection: 'column',
                marginTop: 'auto',
                flexShrink: 0,
              }}
            >
              {cartQuantity > 0 ? (
                <>
                  <div
                    className="quantity-control product-card-quantity-control"
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(40px, 44px) minmax(44px, 1fr) minmax(40px, 44px)',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <motion.button
                      type="button"
                      onClick={(event) =>
                        handleCartQuantityChange(product, cartQuantity - 1, event)
                      }
                      className="btn-secondary"
                      aria-label={t('products:decreaseQuantity', { name: product.omschrijving })}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        padding: 0,
                        borderRadius: '8px',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                      }}
                      whileTap={{ scale: 0.96 }}
                    >
                      -
                    </motion.button>
                    <QuantityInput
                      className="quantity-input"
                      value={cartQuantity}
                      onCommit={(newQuantity) => updateQuantity(product.id, newQuantity)}
                      max={Number.isFinite(stockLimit) ? stockLimit : undefined}
                      ariaLabel={t('products:cartQuantity', { name: product.omschrijving })}
                      style={{
                        minHeight: '44px',
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'white',
                        textAlign: 'center',
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        padding: '0.5rem',
                      }}
                    />
                    <motion.button
                      type="button"
                      onClick={(event) =>
                        handleCartQuantityChange(product, cartQuantity + 1, event)
                      }
                      disabled={isAtStockLimit}
                      className="btn-primary"
                      aria-label={t('products:increaseQuantity', { name: product.omschrijving })}
                      title={isAtStockLimit ? t('products:stockLimitTitle') : t('products:increaseTitle')}
                      style={{
                        minWidth: '44px',
                        minHeight: '44px',
                        padding: 0,
                        borderRadius: '8px',
                        fontSize: '1.2rem',
                        fontWeight: 800,
                      }}
                      whileTap={!isAtStockLimit ? { scale: 0.96 } : {}}
                    >
                      +
                    </motion.button>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {t('products:inCart', { count: cartQuantity })}
                  </p>
                </>
              ) : (
                <motion.button
                  type="button"
                  onClick={(event) => handleAddToCart(product, event)}
                  disabled={outOfStock}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    fontSize: 'clamp(0.8rem, 3vw, 0.85rem)',
                    minHeight: '44px',
                    opacity: outOfStock ? 0.55 : 1,
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                  }}
                  whileTap={!outOfStock ? { scale: 0.98 } : {}}
                >
                  🛒 {t('actions.addToCart')}
                </motion.button>
              )}
            </div>
          </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '2rem',
            flexWrap: 'wrap',
          }}
        >
          <motion.button
            onClick={() => setPage(page - 1)}
            disabled={!pagination.hasPrevPage}
            className="btn-secondary"
            style={{
              padding: '0.5rem 1rem',
              opacity: pagination.hasPrevPage ? 1 : 0.5,
              cursor: pagination.hasPrevPage ? 'pointer' : 'not-allowed',
            }}
            whileTap={pagination.hasPrevPage ? { scale: 0.95 } : {}}
          >
            ← {t('pagination.previous')}
          </motion.button>

          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <motion.button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={page === pageNum ? 'btn-primary' : 'btn-secondary'}
                  style={{
                    padding: '0.5rem 0.75rem',
                    minWidth: '40px',
                  }}
                  whileTap={{ scale: 0.9 }}
                >
                  {pageNum}
                </motion.button>
              );
            })}
          </div>

          <motion.button
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasNextPage}
            className="btn-secondary"
            style={{
              padding: '0.5rem 1rem',
              opacity: pagination.hasNextPage ? 1 : 0.5,
              cursor: pagination.hasNextPage ? 'pointer' : 'not-allowed',
            }}
            whileTap={pagination.hasNextPage ? { scale: 0.95 } : {}}
          >
            {t('pagination.next')} →
          </motion.button>

          <div
            style={{
              marginLeft: '1rem',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
            }}
          >
            {t('products:pageSummary', { page: pagination.page, totalPages: pagination.totalPages, total: pagination.total })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
