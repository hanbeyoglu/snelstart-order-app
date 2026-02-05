import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';

export default function ProductDetailPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('customerId');
  const [quantity, setQuantity] = useState(1);
  const [discountPercentage, setDiscountPercentage] = useState<number | null>(null);
  const [showPurchasePrice, setShowPurchasePrice] = useState(false);
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const showToast = useToastStore((state) => state.showToast);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId, customerId],
    queryFn: async () => {
      const params: any = {};
      if (customerId) params.customerId = customerId;
      const response = await api.get(`/products/${productId}`, { params });
      return response.data;
    },
  });

  const { data: images } = useQuery({
    queryKey: ['product-images', productId],
    queryFn: async () => {
      const response = await api.get(`/images/product/${productId}`);
      return response.data;
    },
  });

  const basePrice = product?.basePrice || product?.finalPrice || 0;
  const finalPrice = discountPercentage
    ? basePrice * (1 - discountPercentage / 100)
    : product?.finalPrice || basePrice;

  const handleAddToCart = () => {
    if (!product) return;
    
    // Son kontrol: Yeni fiyat kuralları
    const purchasePrice = product.inkoopprijs;
    let minPrice: number;
    
    if (purchasePrice === undefined || purchasePrice === null || purchasePrice === 0) {
      // Alış fiyatı yok veya 0 ise: Ürün fiyatından maksimum %5 indirim
      minPrice = basePrice * 0.95;
      if (finalPrice < minPrice) {
        showToast(
          `⚠️ Sepete eklenemedi! Fiyat ürün fiyatından (€${basePrice.toFixed(2)}) maksimum %5 düşük olabilir. Minimum fiyat: €${minPrice.toFixed(2)}`,
          'error',
          5000
        );
        return;
      }
    } else {
      // Alış fiyatı varsa: Alış fiyatının %5 üstü minimum
      minPrice = purchasePrice * 1.05;
      if (finalPrice < minPrice) {
        showToast(
          `⚠️ Sepete eklenemedi! Fiyat alış fiyatının (€${purchasePrice.toFixed(2)}) %5 üstünden düşük olamaz. Minimum fiyat: €${minPrice.toFixed(2)}`,
          'error',
          5000
        );
        return;
      }
    }
    
    // Eğer indirim varsa, customUnitPrice olarak kaydet
    const hasDiscount = discountPercentage !== null && discountPercentage > 0;
    
    addItem({
      productId: product.id,
      productName: product.omschrijving,
      sku: product.artikelnummer,
      quantity,
      unitPrice: basePrice, // Orijinal fiyat
      basePrice: basePrice, // Base price
      totalPrice: finalPrice * quantity, // İndirimli toplam
      vatPercentage: product.btwPercentage || 0,
      // İndirim varsa customUnitPrice olarak kaydet
      ...(hasDiscount && { customUnitPrice: finalPrice }),
      // Alış fiyatını kaydet (minimum fiyat kontrolü için)
      ...(product.inkoopprijs !== undefined && product.inkoopprijs !== null && { inkoopprijs: product.inkoopprijs }),
      // Birim bilgisini ekle
      ...(product.eenheid && { eenheid: product.eenheid }),
      // Kapak resmi URL'ini ekle
      ...(product.coverImageUrl && { coverImageUrl: product.coverImageUrl }),
    });
    const discountText = discountPercentage ? ` (%${discountPercentage} indirim)` : '';
    showToast(`${product.omschrijving} sepete eklendi (${quantity} adet)${discountText}`, 'success');
    navigate('/cart');
  };

  const applyDiscount = (percentage: number) => {
    if (!product) return;
    
    const basePrice = product.basePrice || product.finalPrice || 0;
    const discountedPrice = basePrice * (1 - percentage / 100);
    const purchasePrice = product.inkoopprijs;
    
    // Fiyat kontrolü: Yeni kurallar
    let minPrice: number;
    
    if (purchasePrice === undefined || purchasePrice === null || purchasePrice === 0) {
      // Alış fiyatı yok veya 0 ise: Ürün fiyatından maksimum %5 indirim
      minPrice = basePrice * 0.95;
      if (discountedPrice < minPrice) {
        showToast(
          `⚠️ İndirim uygulanamaz! Maksimum %5 indirim yapılabilir. Minimum fiyat: €${minPrice.toFixed(2)}`,
          'error',
          5000
        );
        return;
      }
    } else {
      // Alış fiyatı varsa: Alış fiyatının %5 üstü minimum
      minPrice = purchasePrice * 1.05;
      if (discountedPrice < minPrice) {
        showToast(
          `⚠️ İndirim uygulanamaz! Fiyat alış fiyatının (€${purchasePrice.toFixed(2)}) %5 üstünden düşük olamaz. Minimum fiyat: €${minPrice.toFixed(2)}`,
          'error',
          5000
        );
        return;
      }
    }
    
    setDiscountPercentage(percentage);
    showToast(`%${percentage} indirim uygulandı`, 'success');
  };

  if (isLoading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
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

  if (!product) {
    return (
      <div className="container">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{ textAlign: 'center', padding: '3rem' }}
        >
          <h2 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Ürün bulunamadı</h2>
          <motion.button onClick={() => navigate(-1)} className="btn-primary" whileTap={{ scale: 0.98 }}>
            ← Geri Dön
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Önce product schema'dan coverImageUrl'i kontrol et, yoksa images array'inden al
  const coverImage = product?.coverImageUrl 
    ? { imageUrl: product.coverImageUrl, isCover: true }
    : images?.find((img: any) => img.isCover) || images?.[0];

  return (
    <div className="container">
      <motion.button
        onClick={() => navigate(-1)}
        className="btn-secondary"
        style={{ 
          marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
          minHeight: '44px',
          padding: 'clamp(0.75rem, 2vw, 0.875rem) clamp(1rem, 3vw, 1.25rem)',
          fontSize: 'clamp(0.9rem, 3vw, 1rem)',
        }}
        whileTap={{ scale: 0.98 }}
      >
        ← Geri
      </motion.button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'clamp(1rem, 3vw, 1.5rem)', alignItems: 'start' }} className="product-detail-grid">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card"
          style={{ padding: 0, overflow: 'hidden' }}
        >
          {coverImage ? (
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f0f0f0',
                minHeight: '250px',
                maxHeight: '500px',
                padding: '1rem',
                position: 'relative',
              }}
            >
              <motion.img
                src={coverImage.thumbnailUrl || coverImage.imageUrl}
                alt={product.omschrijving}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: 'block',
                }}
                transition={{ duration: 0.3 }}
                onError={(e) => {
                  if (coverImage.thumbnailUrl && e.currentTarget.src !== coverImage.imageUrl) {
                    e.currentTarget.src = coverImage.imageUrl;
                  }
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                paddingTop: '75%',
                position: 'relative',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '4rem',
                minHeight: '250px',
              }}
            >
              <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                📦
              </span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h2 style={{ fontSize: 'clamp(1.25rem, 5vw, 2rem)', fontWeight: 700, marginBottom: 'clamp(0.75rem, 3vw, 1rem)', color: 'var(--text-primary)', lineHeight: '1.3' }}>
            {product.omschrijving}
          </h2>

          <div style={{ marginBottom: 'clamp(1rem, 3vw, 1.5rem)', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
              <strong>ID:</strong> <span style={{ wordBreak: 'break-all' }}>{product.id}</span>
            </p>
            <p style={{ marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
              <strong>Ürün Kodu:</strong> {product.artikelcode || product.artikelnummer}
            </p>
            {product.artikelOmzetgroep && (
              <p style={{ marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
                <strong>Kategori:</strong> {product.artikelOmzetgroep.omschrijving || product.artikelomzetgroepOmschrijving || 'N/A'}
                {product.artikelOmzetgroep.id && (
                  <span style={{ fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)', marginLeft: '0.5rem', opacity: 0.7, display: 'block', marginTop: '0.25rem' }}>
                    ({product.artikelOmzetgroep.id})
                  </span>
                )}
              </p>
            )}
            {product.barcode && (
              <p style={{ marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
                <strong>Barkod:</strong> {product.barcode}
              </p>
            )}
            <p style={{ marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
              <strong>Stok:</strong>{' '}
              <span style={{ color: product.voorraad > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                {product.voorraad ?? 'N/A'}
              </span>
            </p>
            <p style={{ fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
              <strong>Birim:</strong> {product.eenheid || 'adet'}
            </p>
          </div>

          {/* {product.prijsafspraak && (
            <div
              style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
                borderRadius: '16px',
                marginBottom: '1.5rem',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Fiyat Anlaşması
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                {product.prijsafspraak.datum && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Tarih:</strong> {new Date(product.prijsafspraak.datum).toLocaleDateString('tr-TR')}
                  </p>
                )}
                {product.prijsafspraak.aantal !== undefined && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Miktar:</strong> {product.prijsafspraak.aantal}
                  </p>
                )}
                {product.prijsafspraak.korting !== undefined && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>İndirim:</strong> {product.prijsafspraak.korting}%
                  </p>
                )}
                {product.prijsafspraak.verkoopprijs !== undefined && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Satış Fiyatı:</strong> €{product.prijsafspraak.verkoopprijs.toFixed(2)}
                  </p>
                )}
                {product.prijsafspraak.basisprijs !== undefined && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Baz Fiyat:</strong> €{product.prijsafspraak.basisprijs.toFixed(2)}
                  </p>
                )}
                {product.prijsafspraak.prijsBepalingSoort && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Fiyat Belirleme Türü:</strong> {product.prijsafspraak.prijsBepalingSoort}
                  </p>
                )}
                {product.prijsafspraak.relatie && (
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>Müşteri:</strong> {product.prijsafspraak.relatie.id || 'N/A'}
                  </p>
                )}
              </div>
            </div>
          )} */}

          <div
            style={{
              padding: 'clamp(1rem, 3vw, 1.5rem)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              borderRadius: '16px',
              marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
            }}
          >
            {(discountPercentage || product.finalPrice !== product.basePrice) && (
              <p
                style={{
                  textDecoration: 'line-through',
                  color: 'var(--text-secondary)',
                  fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                  marginBottom: '0.5rem',
                }}
              >
                Fiyat: €{basePrice.toFixed(2)}
              </p>
            )}
            {discountPercentage && (
              <p
                style={{
                  color: 'var(--success)',
                  fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                }}
              >
                %{discountPercentage} İndirim Uygulandı! 🎉
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <p
                style={{
                  fontSize: 'clamp(1.5rem, 6vw, 2rem)',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                }}
              >
                €{finalPrice.toFixed(2)}
              </p>
              {product.inkoopprijs !== undefined && product.inkoopprijs !== null && (
                <motion.button
                  onClick={() => setShowPurchasePrice(!showPurchasePrice)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 'clamp(0.5rem, 2vw, 0.75rem)',
                    fontSize: 'clamp(1.1rem, 4vw, 1.2rem)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    transition: 'background-color 0.2s ease',
                    minWidth: '44px',
                    minHeight: '44px',
                  }}
                  whileTap={{ scale: 0.9 }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title={showPurchasePrice ? 'Alış fiyatını gizle' : 'Alış fiyatını göster'}
                >
                  {showPurchasePrice ? '👁️' : '👁️‍🗨️'}
                </motion.button>
              )}
            </div>
            {showPurchasePrice && product.inkoopprijs !== undefined && product.inkoopprijs !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  padding: '0.75rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                }}
              >
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <strong style={{ color: 'var(--success)' }}>Alış Fiyatı:</strong>{' '}
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>€{product.inkoopprijs.toFixed(2)}</span>
                </p>
              </motion.div>
            )}
            <p style={{ color: 'var(--text-secondary)' }}>KDV: %{product.btwPercentage || 0}</p>
          </div>

          {/* Hazır İndirim Butonları */}
          <div style={{ marginBottom: 'clamp(1rem, 3vw, 1.5rem)' }}>
            <label style={{ display: 'block', marginBottom: 'clamp(0.5rem, 2vw, 0.75rem)', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.95rem)' }}>
              💰 Hazır İndirimler:
            </label>
            <div style={{ display: 'flex', gap: 'clamp(0.5rem, 2vw, 0.75rem)', flexWrap: 'wrap' }}>
              {[5, 10, 15].map((discount) => {
                const basePrice = product?.basePrice || product?.finalPrice || 0;
                const discountedPrice = basePrice * (1 - discount / 100);
                const purchasePrice = product?.inkoopprijs;
                const isDisabled = purchasePrice !== undefined && purchasePrice !== null && discountedPrice < purchasePrice;
                
                return (
                  <motion.button
                    key={discount}
                    onClick={() => applyDiscount(discount)}
                    disabled={isDisabled}
                    style={{
                      padding: 'clamp(0.75rem, 2vw, 0.875rem) clamp(1rem, 3vw, 1.25rem)',
                      background: discountPercentage === discount
                        ? 'linear-gradient(135deg, var(--success) 0%, #059669 100%)'
                        : isDisabled
                        ? '#f3f4f6'
                        : 'white',
                      color: discountPercentage === discount 
                        ? 'white' 
                        : isDisabled 
                        ? '#9ca3af' 
                        : 'var(--text-primary)',
                      border: `2px solid ${
                        discountPercentage === discount 
                          ? 'var(--success)' 
                          : isDisabled 
                          ? '#e5e7eb' 
                          : 'var(--border)'
                      }`,
                      borderRadius: '12px',
                      fontWeight: 600,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      fontSize: 'clamp(0.85rem, 3vw, 0.95rem)',
                      boxShadow: discountPercentage === discount ? 'var(--shadow)' : 'var(--shadow-sm)',
                      transition: 'all 0.3s ease',
                      opacity: isDisabled ? 0.6 : 1,
                      minHeight: '44px',
                      flex: '1 1 calc(33.333% - 0.5rem)',
                      minWidth: 'calc(33.333% - 0.5rem)',
                    }}
                    whileTap={isDisabled ? {} : { scale: 0.98 }}
                    title={
                      isDisabled
                        ? `Bu indirim uygulanamaz (Alış fiyatı: €${purchasePrice?.toFixed(2)})`
                        : `%${discount} indirim uygula`
                    }
                  >
                    %{discount} İndirim
                  </motion.button>
                );
              })}
              {discountPercentage !== null && (
                <motion.button
                  onClick={() => setDiscountPercentage(null)}
                  style={{
                    padding: 'clamp(0.75rem, 2vw, 0.875rem) clamp(1rem, 3vw, 1.25rem)',
                    background: 'white',
                    color: 'var(--danger)',
                    border: '2px solid var(--danger)',
                    borderRadius: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 'clamp(0.85rem, 3vw, 0.95rem)',
                    boxShadow: 'var(--shadow-sm)',
                    minHeight: '44px',
                    width: '100%',
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  ✕ İptal
                </motion.button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.75rem, 2vw, 1rem)', marginBottom: 'clamp(1rem, 3vw, 1.5rem)' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <strong style={{ fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>Miktar:</strong>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                style={{ 
                  width: '100%',
                  maxWidth: '200px',
                  textAlign: 'center',
                  minHeight: '48px',
                  fontSize: '16px',
                  padding: '0.875rem',
                }}
              />
            </label>
          </div>

          <motion.button
            onClick={handleAddToCart}
            className="btn-primary"
            style={{ 
              width: '100%', 
              padding: 'clamp(0.875rem, 3vw, 1rem)', 
              fontSize: 'clamp(1rem, 4vw, 1.1rem)', 
              fontWeight: 600,
              minHeight: '52px',
            }}
            whileTap={{ scale: 0.98 }}
          >
            🛒 Sepete Ekle
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
