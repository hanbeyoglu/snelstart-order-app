import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

interface Category {
  id: string;
  nummer?: number;
  omschrijving: string;
  verkoopNederlandBtwSoort?: string;
  uri?: string;
  productCount?: number;
  coverImageUrl?: string;
  children?: Category[];
}

function CategoryCard({ category, level = 0 }: { category: Category; level?: number }) {
  const navigate = useNavigate();
  const colors = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  ];

  const gradient = colors[level % colors.length];
  const icon = '📦';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: level * 0.05 }}
      whileHover={{ scale: 1.05, y: -8 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        navigate(`/products?groupId=${category.id}`);
      }}
      style={{
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="card"
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid transparent',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          minHeight: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
          e.currentTarget.style.boxShadow = '0 20px 40px rgba(99, 102, 241, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }}
      >
        {/* Gradient Background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: gradient,
            zIndex: 1,
          }}
        />

        {/* Category Image or Icon */}
        {category.coverImageUrl ? (
          <motion.div
            style={{
              width: '100%',
              paddingTop: '75%',
              position: 'relative',
              marginBottom: '1rem',
              borderRadius: '16px',
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
                objectPosition: 'center',
              }}
              transition={{ duration: 0.3 }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            style={{
              fontSize: '3.5rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            {icon}
          </motion.div>
        )}

        {/* Category Name */}
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              color: 'var(--text-primary)',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {category.omschrijving}
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              alignItems: 'center',
              marginTop: '0.5rem',
            }}
          >
            {category.productCount !== undefined && (
              <p
                style={{
                  color: 'var(--primary)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {category.productCount} ürün
              </p>
            )}
            {category.verkoopNederlandBtwSoort && (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}
              >
                BTW: {category.verkoopNederlandBtwSoort}
              </p>
            )}
          </div>
        </div>

        {/* Arrow Indicator */}
        <motion.div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '1rem',
            padding: '0.75rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
          }}
        >
          <motion.span
          style={{ fontSize: '1rem', color: 'var(--success)', fontWeight: 600 }}
          whileHover={{ scale: 1.2 }}
        >
          Ürünleri Gör →
        </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get('/categories');
      return response.data;
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/categories/sync');
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Kategoriler ve ürünler başarıyla senkronize edildi', 'success');
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        showToast(data.message || 'Senkronizasyon başarısız', 'error');
      }
      setIsSyncing(false);
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Senkronizasyon sırasında bir hata oluştu', 'error');
      setIsSyncing(false);
    },
  });

  const handleSync = async () => {
    setIsSyncing(true);
    syncMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '1rem' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '60px',
              height: '60px',
              border: '5px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
            }}
          />
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', fontWeight: 500 }}
          >
            Kategoriler yükleniyor...
          </motion.p>
        </div>
      </div>
    );
  }

  // Categories are already flat from the API
  const allCategories = categories || [];
  
  // Filter categories based on search
  const displayCategories = allCategories.filter((category: Category) => {
    if (!debouncedSearch.trim()) return true;
    const searchLower = debouncedSearch.toLowerCase();
    return (
      category.omschrijving?.toLowerCase().includes(searchLower) ||
      category.nummer?.toString().includes(searchLower) ||
      category.verkoopNederlandBtwSoort?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '3rem', textAlign: 'center' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <h1
              style={{
                fontSize: 'clamp(1.75rem, 5vw, 3rem)',
                fontWeight: 800,
                marginBottom: '1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.02em',
              }}
            >
              Kategoriler
            </h1>
            <p
              style={{
                fontSize: 'clamp(0.9rem, 2vw, 1.25rem)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}
            >
              İstediğiniz kategoriyi seçerek ürünlere göz atın
            </p>
          </div>
          <motion.button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn-primary"
            whileHover={!isSyncing ? { scale: 1.05 } : {}}
            whileTap={!isSyncing ? { scale: 0.95 } : {}}
            style={{
              opacity: isSyncing ? 0.6 : 1,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
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
                Senkronize Ediliyor...
              </>
            ) : (
              <>
                🔄 Senkronize Et
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Search Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
        style={{ marginBottom: '2rem' }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Kategori ara (isim, numara, BTW)..."
          style={{
            width: '100%',
            padding: '0.875rem 1rem',
            fontSize: '1rem',
            border: '2px solid var(--border)',
            borderRadius: '12px',
            transition: 'all 0.3s ease',
          }}
        />
      </motion.div>

      {displayCategories.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card"
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
          }}
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: '5rem', marginBottom: '1rem' }}
          >
            📂
          </motion.div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            {debouncedSearch.trim() ? 'Kategori bulunamadı' : 'Henüz kategori yok'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            {debouncedSearch.trim() 
              ? `"${debouncedSearch}" için sonuç bulunamadı. Farklı bir arama terimi deneyin.`
              : 'Kategoriler yüklendiğinde burada görünecek'
            }
          </p>
        </motion.div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
          className="responsive-grid"
        >
          {displayCategories.map((category: Category, index: number) => (
            <CategoryCard key={category.id} category={category} level={index} />
          ))}
        </div>
      )}
    </div>
  );
}
