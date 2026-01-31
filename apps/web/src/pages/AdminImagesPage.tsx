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

export default function AdminImagesPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);

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

  // Fetch images for selected product
  const { data: images, isLoading: isLoadingImages } = useQuery({
    queryKey: ['product-images', selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
      const response = await api.get(`/images/product/${identifier}`);
      return response.data;
    },
    enabled: !!selectedProduct,
  });

  // Upload mutation using R2
  const uploadMutation = useMutation({
    mutationFn: async ({ file, isCover }: { file: File; isCover: boolean }) => {
      if (!selectedProduct) throw new Error('Ürün seçilmedi');

      console.log('[AdminImagesPage] Starting upload for product:', selectedProduct);
      
      // Upload to R2
      const { publicUrl, key } = await uploadToR2(file);
      console.log('[AdminImagesPage] Upload successful, publicUrl:', publicUrl, 'key:', key);

      if (!publicUrl || !publicUrl.startsWith('http')) {
        throw new Error(`Geçersiz public URL: ${publicUrl}`);
      }

      // Add image URL to product - use snelstartId (UUID) as identifier
      const identifier = selectedProduct.snelstartId || selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.id;
      console.log('[AdminImagesPage] Adding image to product with identifier:', identifier, 'URL:', publicUrl);
      
      const response = await api.post(`/images/product/${identifier}/url`, {
        imageUrl: publicUrl,
        isCover,
      });
      
      console.log('[AdminImagesPage] Image added to product, response:', response.data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate all product-images queries (for different identifiers)
      queryClient.invalidateQueries({ queryKey: ['product-images'] });
      // Invalidate products list to refresh cover images
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Invalidate specific product detail if viewing
      if (selectedProduct) {
        const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
        queryClient.invalidateQueries({ queryKey: ['product', identifier] });
        queryClient.invalidateQueries({ queryKey: ['product-images', identifier] });
      }
      showToast('Resim başarıyla yüklendi', 'success');
      setShowUploadModal(false);
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
      queryClient.invalidateQueries({ queryKey: ['product-images'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (selectedProduct) {
        const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
        queryClient.invalidateQueries({ queryKey: ['product', identifier] });
      }
      showToast('Resim silindi', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Resim silinirken bir hata oluştu', 'error');
    },
  });

  const setCoverMutation = useMutation({
    mutationFn: async (imageId: string) => {
      if (!selectedProduct) throw new Error('Ürün seçilmedi');
      const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
      await api.put(`/images/product/${identifier}/cover/${imageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-images'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (selectedProduct) {
        const identifier = selectedProduct.artikelcode || selectedProduct.artikelnummer || selectedProduct.snelstartId || selectedProduct.id;
        queryClient.invalidateQueries({ queryKey: ['product', identifier] });
      }
      showToast('Kapak resmi güncellendi', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Kapak resmi güncellenirken bir hata oluştu', 'error');
    },
  });

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setShowUploadModal(true);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) {
      showToast('Lütfen bir dosya seçin', 'error');
      return;
    }

    uploadMutation.mutate({ file, isCover });
    e.target.value = '';
  };

  return (
    <div className="container">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem' }}
      >
        Ürün Resim Yönetimi
      </motion.h2>

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
          placeholder="🔍 Ürün ara (isim, kod)..."
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
      {isLoadingProducts ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Yükleniyor...</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
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
                }}
                whileHover={{ y: -4, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
              >
                {product.coverImageUrl ? (
                  <img
                    src={product.coverImageUrl}
                    alt={product.omschrijving}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '0.5rem',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    📦
                  </div>
                )}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {product.omschrijving}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {product.artikelcode || product.artikelnummer}
                </p>
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

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && selectedProduct && (
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
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem',
            }}
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card"
              style={{
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: 'var(--card-bg)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Resim Yükle: {selectedProduct.omschrijving}</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Upload Buttons */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <label
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--primary)',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'inline-block',
                    flex: 1,
                    minWidth: '150px',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, false)}
                    style={{ display: 'none' }}
                    disabled={uploadMutation.isPending}
                  />
                  {uploadMutation.isPending ? 'Yükleniyor...' : '📷 Resim Yükle'}
                </label>
                <label
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--success)',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'inline-block',
                    flex: 1,
                    minWidth: '150px',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleUpload(e, true)}
                    style={{ display: 'none' }}
                    disabled={uploadMutation.isPending}
                  />
                  {uploadMutation.isPending ? 'Yükleniyor...' : '⭐ Kapak Resmi Olarak Yükle'}
                </label>
              </div>

              {/* Images Gallery */}
              <div>
                <h4 style={{ marginBottom: '1rem' }}>Yüklenen Resimler ({images?.length || 0})</h4>
                {isLoadingImages ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>Yükleniyor...</div>
                ) : !images || images.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Bu ürün için henüz resim yüklenmemiş
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '1rem',
                    }}
                  >
                    {images.map((image: any) => (
                      <motion.div
                        key={image.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', paddingTop: '75%', background: '#f0f0f0' }}>
                          <img
                            src={image.thumbnailUrl || image.imageUrl}
                            alt="Product"
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
                            }}
                          />
                          {image.isCover && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                background: 'var(--success)',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              ⭐ KAPAK
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {!image.isCover && (
                              <button
                                onClick={() => setCoverMutation.mutate(image.id)}
                                className="btn-secondary"
                                disabled={setCoverMutation.isPending}
                                style={{ flex: 1, minWidth: '80px', fontSize: '0.75rem', padding: '0.5rem' }}
                              >
                                {setCoverMutation.isPending ? '...' : '⭐ Kapak'}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Bu resmi silmek istediğinize emin misiniz?')) {
                                  deleteMutation.mutate(image.id);
                                }
                              }}
                              className="btn-danger"
                              disabled={deleteMutation.isPending}
                              style={{ flex: 1, minWidth: '80px', fontSize: '0.75rem', padding: '0.5rem' }}
                            >
                              {deleteMutation.isPending ? '...' : '🗑️ Sil'}
                            </button>
                          </div>
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
    </div>
  );
}
