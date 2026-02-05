import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { uploadToR2 } from '../services/api';
import { useToastStore } from '../store/toastStore';

interface Product {
  id: string;
  omschrijving: string;
  artikelcode?: string;
  artikelnummer?: string;
  snelstartId?: string;
  coverImageUrl?: string;
}

interface Category {
  id: string;
  omschrijving: string;
  nummer?: number;
  coverImageUrl?: string;
}

type TabType = 'products' | 'categories';

export default function AdminImagesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<{ id: string; type: 'product' | 'category' } | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

  // Reset selections when tab changes
  useEffect(() => {
    setSelectedProduct(null);
    setSelectedCategory(null);
    setShowUploadModal(false);
    setSearch('');
    setPage(1);
  }, [activeTab]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch products list
  const { data: productsResponse, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', debouncedSearch, page],
    queryFn: async () => {
      const params: any = {
        page: page.toString(),
        limit: '20',
      };
      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      const response = await api.get('/products', { params });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const products = productsResponse?.data || [];
  const pagination = productsResponse?.pagination;

  // Fetch categories list
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: activeTab === 'categories',
  });

  // Fetch images for selected product
  const { data: images, isLoading: isLoadingImages } = useQuery({
    queryKey: ['product-images', selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
      const response = await api.get(`/images/product/${identifier}`);
      return response.data;
    },
    enabled: !!selectedProduct && activeTab === 'products',
  });

  // Fetch images for selected category
  const { data: categoryImages, isLoading: isLoadingCategoryImages } = useQuery({
    queryKey: ['category-images', selectedCategory?.id],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const response = await api.get(`/images/category/${selectedCategory.id}`);
      return response.data;
    },
    enabled: !!selectedCategory && activeTab === 'categories',
  });

  // Upload mutation using R2 - tek resim sistemi
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedProduct) throw new Error('Ürün seçilmedi');

      console.log('[AdminImagesPage] Starting upload for product:', selectedProduct);
      
      // Eğer zaten resim varsa, önce eski resmi sil
      const identifier = selectedProduct.snelstartId || selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.id;
      if (images && images.length > 0) {
        // Tüm mevcut resimleri sil
        await Promise.all(
          images.map((img: any) => 
            api.delete(`/images/product/${identifier}/${img.id}`).catch(err => {
              console.warn('Failed to delete old image:', err);
            })
          )
        );
      }
      
      // Upload to R2
      const { publicUrl, key } = await uploadToR2(file);
      console.log('[AdminImagesPage] Upload successful, publicUrl:', publicUrl, 'key:', key);

      if (!publicUrl || !publicUrl.startsWith('http')) {
        throw new Error(`Geçersiz public URL: ${publicUrl}`);
      }

      // Add image URL to product - use snelstartId (UUID) as identifier
      // Tek resim olduğu için her zaman kapak resmi olarak işaretle
      console.log('[AdminImagesPage] Adding image to product with identifier:', identifier, 'URL:', publicUrl);
      
      const response = await api.post(`/images/product/${identifier}/url`, {
        imageUrl: publicUrl,
        isCover: true, // Tek resim olduğu için her zaman kapak
      });
      
      console.log('[AdminImagesPage] Image added to product, response:', response.data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all product-images queries (for different identifiers)
      queryClient.invalidateQueries({ queryKey: ['product-images'] });
      // Invalidate products list to refresh cover images - this ensures the image appears in the product list
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate specific product detail if viewing
      if (selectedProduct) {
        const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
        queryClient.invalidateQueries({ queryKey: ['product', identifier] });
        queryClient.invalidateQueries({ queryKey: ['product-images', identifier] });
      }
      showToast('Resim başarıyla yüklendi ve ürün listesinde görünecek', 'success');
      // Don't close modal automatically - let user see the new image
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      let errorMessage = error.message || 'Resim yüklenirken bir hata oluştu';
      
      // Handle different error types
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      if (!selectedProduct) throw new Error('Ürün seçilmedi');
      const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
      await api.delete(`/images/product/${identifier}/${imageId}`);
    },
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['product-images'] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh product list
      if (selectedProduct) {
        const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
        queryClient.invalidateQueries({ queryKey: ['product', identifier] });
      }
      showToast('Resim silindi ve ürün listesi güncellendi', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Resim silinirken bir hata oluştu', 'error');
    },
  });


  // Category upload mutation
  const categoryUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedCategory) throw new Error('Kategori seçilmedi');

      console.log('[AdminImagesPage] Starting upload for category:', selectedCategory);
      
      // Eğer zaten resim varsa, önce eski resmi sil
      if (categoryImages && categoryImages.length > 0) {
        await Promise.all(
          categoryImages.map((img: any) => 
            api.delete(`/images/category/${selectedCategory.id}/${img.id}`).catch(err => {
              console.warn('Failed to delete old image:', err);
            })
          )
        );
      }
      
      // Upload to R2
      const { publicUrl, key } = await uploadToR2(file);
      console.log('[AdminImagesPage] Upload successful, publicUrl:', publicUrl, 'key:', key);

      if (!publicUrl || !publicUrl.startsWith('http')) {
        throw new Error(`Geçersiz public URL: ${publicUrl}`);
      }

      // Add image URL to category
      const response = await api.post(`/images/category/${selectedCategory.id}/url`, {
        imageUrl: publicUrl,
        isCover: true,
      });
      
      console.log('[AdminImagesPage] Image added to category, response:', response.data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-images'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedCategory) {
        queryClient.invalidateQueries({ queryKey: ['category-images', selectedCategory.id] });
      }
      showToast('Resim başarıyla yüklendi ve kategori listesinde görünecek', 'success');
    },
    onError: (error: any) => {
      console.error('Category upload error:', error);
      let errorMessage = error.message || 'Resim yüklenirken bir hata oluştu';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast(errorMessage, 'error');
    },
  });

  // Category delete mutation
  const categoryDeleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      if (!selectedCategory) throw new Error('Kategori seçilmedi');
      await api.delete(`/images/category/${selectedCategory.id}/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-images'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (selectedCategory) {
        queryClient.invalidateQueries({ queryKey: ['category-images', selectedCategory.id] });
      }
      showToast('Resim silindi ve kategori listesi güncellendi', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Resim silinirken bir hata oluştu', 'error');
    },
  });

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setSelectedCategory(null);
    setShowUploadModal(true);
  };

  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    setSelectedProduct(null);
    setShowUploadModal(true);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (activeTab === 'products') {
      if (!file || !selectedProduct) {
        showToast('Lütfen bir dosya seçin', 'error');
        return;
      }

      // Eğer zaten resim varsa onay iste
      if (images && images.length > 0) {
        if (!confirm('Bu ürün için zaten bir resim var. Yeni resim eskisini değiştirecek. Devam etmek istiyor musunuz?')) {
          e.target.value = '';
          return;
        }
      }

      uploadMutation.mutate(file);
    } else if (activeTab === 'categories') {
      if (!file || !selectedCategory) {
        showToast('Lütfen bir dosya seçin', 'error');
        return;
      }

      // Eğer zaten resim varsa onay iste
      if (categoryImages && categoryImages.length > 0) {
        if (!confirm('Bu kategori için zaten bir resim var. Yeni resim eskisini değiştirecek. Devam etmek istiyor musunuz?')) {
          e.target.value = '';
          return;
        }
      }

      categoryUploadMutation.mutate(file);
    }
    
    e.target.value = '';
  };

  return (
    <div className="container">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem' }}
      >
        📷 Resim Yönetimi
      </motion.h2>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ 
          marginBottom: '1.5rem',
          padding: '0.5rem',
          display: 'flex',
          gap: '0.5rem',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
        }}
      >
        <motion.button
          onClick={() => setActiveTab('products')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            flex: 1,
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'products' 
              ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'
              : 'white',
            color: activeTab === 'products' ? 'white' : 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'products' ? 'var(--shadow)' : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          📦 Ürünler
        </motion.button>
        <motion.button
          onClick={() => setActiveTab('categories')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            flex: 1,
            padding: '1rem',
            borderRadius: '12px',
            border: 'none',
            background: activeTab === 'categories' 
              ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'
              : 'white',
            color: activeTab === 'categories' ? 'white' : 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: activeTab === 'categories' ? 'var(--shadow)' : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          🗂️ Kategoriler
        </motion.button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ marginBottom: '1.5rem' }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={activeTab === 'products' ? "🔍 Ürün ara (isim, kod)..." : "🔍 Kategori ara..."}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
          }}
        />
      </motion.div>

      {/* Products Grid */}
      {activeTab === 'products' && (
        <>
          {isLoadingProducts ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Yükleniyor...</div>
          ) : (
            <>
          <div className="responsive-grid" style={{ marginBottom: '2rem' }}>
            {products.map((product: Product, index: number) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card"
                onClick={() => handleProductClick(product)}
                style={{
                  cursor: 'pointer',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  height: '100%',
                }}
                whileHover={{ y: -4, boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }}
              >
                {product.coverImageUrl ? (
                  <motion.div
                    style={{
                      width: '100%',
                      paddingTop: '100%',
                      position: 'relative',
                      marginBottom: '0.75rem',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#f0f0f0',
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
                      position: 'relative',
                      marginBottom: '0.75rem',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem',
                    }}
                  >
                    <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                      📦
                    </span>
                  </div>
                )}
                <h3 style={{ 
                  fontSize: 'clamp(0.85rem, 3vw, 0.95rem)', 
                  fontWeight: 600, 
                  marginBottom: '0.5rem',
                  color: 'var(--text-primary)',
                  lineHeight: '1.4',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  width: '100%',
                }}>
                  {product.omschrijving}
                </h3>
                <p style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)',
                  margin: 0,
                  opacity: 0.8,
                }}>
                  {product.artikelcode || product.artikelnummer || 'Kod yok'}
                </p>
                {product.coverImageUrl && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    color: 'var(--success)',
                    fontWeight: 600,
                  }}>
                    📷 Resimli
                  </div>
                )}
              </motion.div>
            ))}
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
                marginBottom: '2rem',
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
                ← Önceki
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
                Sonraki →
              </motion.button>

              <div
                style={{
                  marginLeft: '1rem',
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                }}
              >
                Sayfa {pagination.page} / {pagination.totalPages} (Toplam: {pagination.total})
              </div>
            </motion.div>
          )}
            </>
          )}
        </>
      )}

      {/* Categories Grid */}
      {activeTab === 'categories' && (
        <>
          {isLoadingCategories ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  margin: '0 auto 1rem',
                }}
              />
              <p>Kategoriler yükleniyor...</p>
            </div>
          ) : (
            <div className="responsive-grid" style={{ marginBottom: '2rem' }}>
              {categories && categories.length > 0 ? (
                categories
                  .filter((category: Category) => {
                    if (!debouncedSearch) return true;
                    const searchLower = debouncedSearch.toLowerCase();
                    return (
                      category.omschrijving?.toLowerCase().includes(searchLower) ||
                      category.nummer?.toString().includes(searchLower)
                    );
                  })
                  .map((category: Category, index: number) => (
                    <motion.div
                      key={category.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="card"
                      onClick={() => handleCategoryClick(category)}
                      style={{
                        cursor: 'pointer',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        height: '100%',
                      }}
                      whileHover={{ y: -4, boxShadow: '0 10px 20px rgba(0,0,0,0.15)' }}
                    >
                      {category.coverImageUrl ? (
                        <motion.div
                          style={{
                            width: '100%',
                            paddingTop: '100%',
                            position: 'relative',
                            marginBottom: '0.75rem',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: '#f0f0f0',
                          }}
                        >
                          <motion.img
                            src={category.coverImageUrl}
                            alt={category.omschrijving}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
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
                            position: 'relative',
                            marginBottom: '0.75rem',
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem',
                          }}
                        >
                          <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                            🗂️
                          </span>
                        </div>
                      )}
                      <h3 style={{ 
                        fontSize: 'clamp(0.85rem, 3vw, 0.95rem)', 
                        fontWeight: 600, 
                        marginBottom: '0.5rem',
                        color: 'var(--text-primary)',
                        lineHeight: '1.4',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        width: '100%',
                      }}>
                        {category.omschrijving}
                      </h3>
                      {category.nummer && (
                        <p style={{ 
                          fontSize: '0.75rem', 
                          color: 'var(--text-secondary)',
                          margin: 0,
                          opacity: 0.8,
                        }}>
                          No: {category.nummer}
                        </p>
                      )}
                      {category.coverImageUrl && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.25rem 0.75rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          color: 'var(--success)',
                          fontWeight: 600,
                        }}>
                          📷 Resimli
                        </div>
                      )}
                    </motion.div>
                  ))
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem 2rem',
                  color: 'var(--text-secondary)',
                  gridColumn: '1 / -1',
                }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗂️</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                    Kategori bulunamadı
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (selectedProduct || selectedCategory) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem',
            }}
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="card modal-content"
              style={{
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'white',
                position: 'relative',
                padding: 'clamp(1.25rem, 4vw, 2rem)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Improved */}
              <motion.button
                onClick={() => setShowUploadModal(false)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  position: 'absolute',
                  top: 'clamp(0.75rem, 3vw, 1rem)',
                  right: 'clamp(0.75rem, 3vw, 1rem)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '2px solid var(--danger)',
                  borderRadius: '50%',
                  width: 'clamp(36px, 5vw, 40px)',
                  height: 'clamp(36px, 5vw, 40px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--danger)',
                  fontSize: 'clamp(1.25rem, 4vw, 1.5rem)',
                  fontWeight: 'bold',
                  zIndex: 10,
                  transition: 'all 0.2s ease',
                  minWidth: '44px',
                  minHeight: '44px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--danger)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = 'var(--danger)';
                }}
                aria-label="Kapat"
              >
                ×
              </motion.button>

              {/* Header */}
              <div style={{ marginBottom: '2rem', paddingRight: '3rem' }}>
                <h2 style={{ 
                  fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', 
                  fontWeight: 700, 
                  marginBottom: '0.5rem',
                  color: 'var(--text-primary)',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  📷 Resim Yönetimi
                </h2>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                  margin: 0,
                }}>
                  {selectedProduct?.omschrijving || selectedCategory?.omschrijving}
                </p>
                {selectedProduct && (selectedProduct.artikelcode || selectedProduct.artikelnummer) ? (
                  <p style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                    opacity: 0.7,
                  }}>
                    Kod: {selectedProduct.artikelcode || selectedProduct.artikelnummer}
                  </p>
                ) : null}
                {selectedCategory && selectedCategory.nummer ? (
                  <p style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '0.85rem',
                    marginTop: '0.25rem',
                    opacity: 0.7,
                  }}>
                    Kategori No: {selectedCategory.nummer}
                  </p>
                ) : null}
              </div>

              {/* Upload Button - Tek Resim */}
              <div style={{ 
                marginBottom: '2rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderRadius: '16px',
                border: '1px solid rgba(99, 102, 241, 0.1)',
              }}>
                <motion.label
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: '1.25rem 2rem',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                    color: 'white',
                    borderRadius: '12px',
                    cursor: (uploadMutation.isPending || categoryUploadMutation.isPending) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    width: '100%',
                    fontWeight: 600,
                    boxShadow: 'var(--shadow)',
                    opacity: (uploadMutation.isPending || categoryUploadMutation.isPending) ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                    fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    style={{ display: 'none' }}
                    disabled={uploadMutation.isPending || categoryUploadMutation.isPending}
                  />
                  {(uploadMutation.isPending || categoryUploadMutation.isPending) ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{
                          width: '20px',
                          height: '20px',
                          border: '3px solid rgba(255, 255, 255, 0.3)',
                          borderTopColor: 'white',
                          borderRadius: '50%',
                        }}
                      />
                      <span>Yükleniyor...</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '1.5rem' }}>📷</span>
                      <span>
                        {activeTab === 'products' 
                          ? (images && images.length > 0 ? 'Resmi Değiştir' : 'Resim Yükle')
                          : (categoryImages && categoryImages.length > 0 ? 'Resmi Değiştir' : 'Resim Yükle')
                        }
                      </span>
                    </>
                  )}
                </motion.label>
                {((activeTab === 'products' && images && images.length > 0) || 
                  (activeTab === 'categories' && categoryImages && categoryImages.length > 0)) && (
                  <p style={{ 
                    textAlign: 'center', 
                    marginTop: '1rem', 
                    fontSize: '0.85rem', 
                    color: 'var(--text-secondary)',
                    opacity: 0.7,
                  }}>
                    ⚠️ Yeni resim yüklendiğinde mevcut resim değiştirilecektir
                  </p>
                )}
              </div>

              {/* Images Gallery */}
              <div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid var(--border)',
                }}>
                  <h3 style={{ 
                    margin: 0,
                    fontSize: 'clamp(1.1rem, 3vw, 1.3rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    📸 {activeTab === 'products' ? 'Ürün Resmi' : 'Kategori Resmi'}
                  </h3>
                  {((activeTab === 'products' && images && images.length > 0) || 
                    (activeTab === 'categories' && categoryImages && categoryImages.length > 0)) && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <span>✓</span>
                      <span>Resim Yüklü</span>
                    </div>
                  )}
                </div>
                {(activeTab === 'products' ? isLoadingImages : isLoadingCategoryImages) ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '3rem 2rem',
                    color: 'var(--text-secondary)',
                  }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid rgba(99, 102, 241, 0.2)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        margin: '0 auto 1rem',
                      }}
                    />
                    <p>Resimler yükleniyor...</p>
                  </div>
                ) : ((activeTab === 'products' && (!images || images.length === 0)) || 
                      (activeTab === 'categories' && (!categoryImages || categoryImages.length === 0))) ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '3rem 2rem',
                    color: 'var(--text-secondary)',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                    borderRadius: '16px',
                    border: '2px dashed var(--border)',
                  }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                      Henüz resim yüklenmemiş
                    </p>
                    <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                      Yukarıdaki butonu kullanarak resim yükleyebilirsiniz
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    {/* Tek resim gösterimi */}
                    {(activeTab === 'products' ? images : categoryImages)?.map((image: any) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          padding: 0,
                          border: '2px solid var(--primary)',
                          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                          maxWidth: '400px',
                          width: '100%',
                        }}
                        whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
                      >
                        <div style={{ 
                          position: 'relative', 
                          width: '100%', 
                          paddingTop: '100%', 
                          background: '#f0f0f0',
                          overflow: 'hidden',
                        }}>
                          <img
                            src={image.thumbnailUrl || image.imageUrl}
                            alt={activeTab === 'products' ? 'Product' : 'Category'}
                            onError={(e) => {
                              if (image.thumbnailUrl && e.currentTarget.src !== image.imageUrl) {
                                e.currentTarget.src = image.imageUrl;
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              objectPosition: 'center',
                            }}
                          />
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                          <motion.button
                            onClick={() => {
                              setImageToDelete({ 
                                id: image.id, 
                                type: activeTab === 'products' ? 'product' : 'category' 
                              });
                              setShowDeleteModal(true);
                            }}
                            className="btn-danger"
                            disabled={deleteMutation.isPending || categoryDeleteMutation.isPending}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{ 
                              width: '100%',
                              fontSize: '1rem', 
                              padding: '1rem',
                              minHeight: '48px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.5rem',
                            }}
                          >
                            {(deleteMutation.isPending || categoryDeleteMutation.isPending) ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    border: '3px solid white',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                  }}
                                />
                                <span>Siliniyor...</span>
                              </>
                            ) : (
                              <>
                                <span>🗑️</span>
                                <span>Resmi Sil</span>
                              </>
                            )}
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && imageToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
              padding: '1rem',
            }}
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="card modal-content"
              style={{
                maxWidth: '500px',
                width: '100%',
                background: 'white',
                position: 'relative',
                padding: '2rem',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <motion.button
                onClick={() => setShowDeleteModal(false)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '2px solid var(--danger)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--danger)',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  zIndex: 10,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--danger)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.color = 'var(--danger)';
                }}
                aria-label="Kapat"
              >
                ×
              </motion.button>

              {/* Content */}
              <div style={{ textAlign: 'center', paddingRight: '3rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🗑️</div>
                <h2 style={{ 
                  fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', 
                  fontWeight: 700, 
                  marginBottom: '1rem',
                  color: 'var(--text-primary)',
                }}>
                  Resmi Sil
                </h2>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                  marginBottom: '2rem',
                  lineHeight: '1.6',
                }}>
                  Bu resmi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                </p>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                  <motion.button
                    onClick={() => {
                      if (imageToDelete.type === 'product') {
                        deleteMutation.mutate(imageToDelete.id);
                      } else {
                        categoryDeleteMutation.mutate(imageToDelete.id);
                      }
                      setShowDeleteModal(false);
                      setImageToDelete(null);
                    }}
                    className="btn-danger"
                    disabled={deleteMutation.isPending || categoryDeleteMutation.isPending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                      width: '100%',
                      fontSize: '1rem', 
                      padding: '1rem',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {(deleteMutation.isPending || categoryDeleteMutation.isPending) ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{
                            width: '18px',
                            height: '18px',
                            border: '3px solid white',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                          }}
                        />
                        <span>Siliniyor...</span>
                      </>
                    ) : (
                      <>
                        <span>🗑️</span>
                        <span>Evet, Sil</span>
                      </>
                    )}
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setImageToDelete(null);
                    }}
                    className="btn-secondary"
                    disabled={deleteMutation.isPending || categoryDeleteMutation.isPending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                      width: '100%',
                      fontSize: '1rem', 
                      padding: '1rem',
                      minHeight: '48px',
                    }}
                  >
                    İptal
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
