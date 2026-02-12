import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';

interface Customer {
  id: string;
  naam: string;
  relatiecode?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  land?: string;
  telefoon?: string;
  email?: string;
  visitStatus?: 'VISITED' | 'PLANNED' | null;
  visitedAt?: string;
  plannedAt?: string;
  notes?: string;
}


export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [showCityFilter, setShowCityFilter] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const { user } = useAuthStore();
  const cityFilterRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.role === 'admin';

  // Close city filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityFilterRef.current && !cityFilterRef.current.contains(event.target as Node)) {
        setShowCityFilter(false);
      }
    };

    if (showCityFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCityFilter]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search change
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when cities change
  useEffect(() => {
    setPage(1);
  }, [selectedCities]);

  // Get cities list
  const { data: cities } = useQuery({
    queryKey: ['customers-cities'],
    queryFn: async () => {
      const response = await api.get('/customers/cities');
      return response.data;
    },
  });

  const { data: customersResponse, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch, selectedCities.join(','), page, showAllCustomers],
    queryFn: async () => {
      const params: any = {
        page: page.toString(),
        limit: '20',
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCities.length > 0) params.cities = selectedCities.join(',');
      if (isAdmin && showAllCustomers) params.includeAll = 'true';
      const response = await api.get('/customers', { params });
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - data is fresh for 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache for 1 hour (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  const handleCityToggle = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    );
  };

  const handleClearCities = () => {
    setSelectedCities([]);
  };

  const customers = customersResponse?.data || [];
  const pagination = customersResponse?.pagination;

  const { data: customerDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['customer-detail', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer?.id) return null;
      const response = await api.get(`/customers/${selectedCustomer.id}/with-visit-status`);
      return response.data;
    },
    enabled: !!selectedCustomer?.id,
  });

  const updateVisitStatusMutation = useMutation({
    mutationFn: async ({ customerId, status, notes }: { customerId: string; status: 'VISITED' | 'PLANNED'; notes?: string }) => {
      const response = await api.put(`/customers/${customerId}/visit-status`, { status, notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-detail', selectedCustomer?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSelectedCustomer(null);
      setPage(1); // Reset to first page
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/customers', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowCreateForm(false);
      setPage(1); // Reset to first page
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/customers/sync');
      return response.data;
    },
    onSuccess: (data) => {
      if (data.success) {
        showToast('Müşteriler başarıyla senkronize edildi', 'success');
        // Invalidate queries to refetch data
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['customers-cities'] });
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

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCustomerMutation.mutate({
      naam: formData.get('naam'),
      adres: formData.get('adres'),
      postcode: formData.get('postcode'),
      plaats: formData.get('plaats'),
      land: formData.get('land') || 'NL',
      telefoon: formData.get('telefoon'),
      email: formData.get('email') || '',
    });
  };

  const handleCustomerClick = (customer: Customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const handleUpdateStatus = (status: 'VISITED' | 'PLANNED') => {
    if (!selectedCustomer?.id) return;
    updateVisitStatusMutation.mutate({
      customerId: selectedCustomer.id,
      status,
      notes: notes.trim() || undefined,
    });
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
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
            Müşteriler yükleniyor...
          </motion.p>
        </div>
      </div>
    );
  }

  const displayCustomer = customerDetail || selectedCustomer;

  return (
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 5vw, 3rem)',
              fontWeight: 800,
              marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Müşteriler
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(0.9rem, 2vw, 1.1rem)' }}>
            Müşterilerinizi yönetin ve yeni müşteri ekleyin
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <motion.button
            onClick={handleSync}
            disabled={isSyncing}
            className="btn-primary"
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
          <motion.button
            onClick={() => navigate('/customers/new')}
            className="btn-primary"
            whileTap={{ scale: 0.95 }}
          >
            ➕ Yeni Müşteri Ekle
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="card mb-6 overflow-hidden"
          >
            <h3 className="text-2xl font-bold mb-4 text-text-primary">Yeni Müşteri Oluştur</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-full">
                <label className="label">İsim *</label>
                <input type="text" name="naam" required className="input" />
              </div>
              <div className="col-span-full">
                <label className="label">Adres</label>
                <input type="text" name="adres" className="input" />
              </div>
              <div>
                <label className="label">Posta Kodu</label>
                <input type="text" name="postcode" className="input" />
              </div>
              <div>
                <label className="label">Şehir</label>
                <input type="text" name="plaats" className="input" />
              </div>
              <div className="col-span-full">
                <label className="label">Ülke</label>
                <input type="text" name="land" defaultValue="NL" className="input" />
              </div>
              <div>
                <label className="label">Telefon</label>
                <input type="tel" name="telefoon" className="input" />
              </div>
              <div>
                <label className="label">E-posta</label>
                <input type="email" name="email" className="input" />
              </div>
              <div className="col-span-full mt-4">
                <motion.button
                  type="submit"
                  className="btn-primary w-full py-3 text-lg"
                  disabled={createCustomerMutation.isPending}
                  whileTap={{ scale: 0.98 }}
                >
                  {createCustomerMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
                </motion.button>
                {createCustomerMutation.error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-danger bg-opacity-80 text-white p-3 rounded-lg mt-4 text-center"
                  >
                    {createCustomerMutation.error.message}
                  </motion.div>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}
      >
        <input
          type="text"
          placeholder="🔍 Müşteri ara (isim, kod, e-posta, telefon)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ flex: 1, minWidth: '200px', fontSize: '1rem' }}
        />
        {isAdmin && (
          <motion.label
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: showAllCustomers ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <input
              type="checkbox"
              checked={showAllCustomers}
              onChange={(e) => {
                setShowAllCustomers(e.target.checked);
                setPage(1); // Reset to first page when filter changes
              }}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: 'var(--primary)',
              }}
            />
            <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              Tüm Müşterileri Göster
            </span>
          </motion.label>
        )}
        <div style={{ position: 'relative' }} ref={cityFilterRef}>
          <motion.button
            onClick={() => setShowCityFilter(!showCityFilter)}
            className={selectedCities.length > 0 ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap' }}
            whileTap={{ scale: 0.95 }}
          >
            📍 Şehir Filtresi
            {selectedCities.length > 0 && ` (${selectedCities.length})`}
          </motion.button>
          
          <AnimatePresence>
            {showCityFilter && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="card"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  minWidth: '250px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 100,
                  padding: '1rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              >
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Şehir Seç</h3>
                  {selectedCities.length > 0 && (
                    <motion.button
                      onClick={handleClearCities}
                      className="btn-secondary"
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Temizle
                    </motion.button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="🔍 Şehir ara..."
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  className="input"
                  style={{
                    width: '100%',
                    fontSize: '0.9rem',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.5rem',
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                {selectedCities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                    {selectedCities.map((city) => (
                      <span
                        key={city}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.5rem',
                          background: 'var(--primary)',
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {city}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCityToggle(city);
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.3)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            color: 'white',
                            fontSize: '0.625rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {cities
                  ?.filter((city: string) =>
                    city.toLowerCase().includes(citySearch.toLowerCase())
                  )
                  .map((city: string) => (
                    <label
                      key={city}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '8px',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city)}
                        onChange={() => handleCityToggle(city)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.9rem', userSelect: 'none' }}>{city}</span>
                    </label>
                  ))}
                {cities?.filter((city: string) =>
                  city.toLowerCase().includes(citySearch.toLowerCase())
                ).length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Şehir bulunamadı
                  </div>
                )}
              </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {customers?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-text-secondary p-8 card"
        >
          <h3 className="text-2xl font-bold mb-2">Müşteri Bulunamadı</h3>
          <p>Aradığınız kriterlere uygun müşteri bulunamadı.</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            overflowX: 'auto',
            background: 'white',
            borderRadius: '12px',
            boxShadow: 'var(--shadow)',
            marginBottom: '2rem',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: '800px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  borderBottom: '2px solid rgba(99, 102, 241, 0.2)',
                }}
              >
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  İsim
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Kod
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Telefon
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  E-posta
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Şehir
                </th>
                <th
                  style={{
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Durum
                </th>
              </tr>
            </thead>
            <tbody>
              {customers?.map((customer: Customer, index: number) => {
                const statusIcon = customer.visitStatus === 'VISITED' ? '✅' : customer.visitStatus === 'PLANNED' ? '📅' : '👤';
                const statusText = customer.visitStatus === 'VISITED' ? 'Gidildi' : customer.visitStatus === 'PLANNED' ? 'Planlandı' : 'Yeni';
                
                return (
                  <motion.tr
                    key={customer.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleCustomerClick(customer)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td
                      style={{
                        padding: '1rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {customer.naam}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {customer.relatiecode || '-'}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {customer.telefoon || '-'}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {customer.email || '-'}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9rem',
                      }}
                    >
                      {customer.plaats || '-'}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: customer.visitStatus === 'VISITED'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : customer.visitStatus === 'PLANNED'
                            ? 'rgba(245, 158, 11, 0.1)'
                            : 'rgba(99, 102, 241, 0.1)',
                          color: customer.visitStatus === 'VISITED'
                            ? '#10b981'
                            : customer.visitStatus === 'PLANNED'
                            ? '#f59e0b'
                            : 'var(--primary)',
                        }}
                      >
                        {statusIcon} {statusText}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

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

      {/* Customer Detail Modal - Responsive */}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCustomer(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
              overflowY: 'auto',
            }}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="card modal-content"
              style={{
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                margin: 'auto',
                position: 'relative',
              }}
            >
              {isLoadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid rgba(99, 102, 241, 0.2)',
                      borderTopColor: 'var(--primary)',
                      borderRadius: '50%',
                    }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }} className="customer-modal-header">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', flex: 1, width: '100%' }} className="customer-modal-avatar-section">
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          minWidth: '64px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.5rem',
                          fontWeight: 700,
                          color: 'white',
                          background:
                            displayCustomer?.visitStatus === 'VISITED'
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                              : displayCustomer?.visitStatus === 'PLANNED'
                              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        }}
                      >
                        {displayCustomer?.naam?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', wordBreak: 'break-word' }}>
                          {displayCustomer?.naam}
                        </h2>
                        {displayCustomer?.relatiecode && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Kod: {displayCustomer.relatiecode}</p>
                        )}
                      </div>
                    </div>
                    <motion.button
                      onClick={() => setSelectedCustomer(null)}
                      className="btn-secondary"
                      style={{ padding: '0.5rem 1rem', flexShrink: 0 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      ✕
                    </motion.button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    {displayCustomer?.adres && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>📍 Adres</p>
                        <p style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{displayCustomer.adres}</p>
                      </div>
                    )}
                    {displayCustomer?.postcode && displayCustomer?.plaats && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>🏙️ Şehir</p>
                        <p style={{ color: 'var(--text-primary)' }}>
                          {displayCustomer.postcode} {displayCustomer.plaats}
                        </p>
                      </div>
                    )}
                    {displayCustomer?.telefoon && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>📞 Telefon</p>
                        <p style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{displayCustomer.telefoon}</p>
                      </div>
                    )}
                    {displayCustomer?.email && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>📧 E-posta</p>
                        <p style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{displayCustomer.email}</p>
                      </div>
                    )}
                    {displayCustomer?.visitStatus === 'VISITED' && displayCustomer?.visitedAt && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>✅ Gidildi</p>
                        <p style={{ color: 'var(--text-primary)' }}>
                          {new Date(displayCustomer.visitedAt).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    )}
                    {displayCustomer?.visitStatus === 'PLANNED' && displayCustomer?.plannedAt && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>📅 Planlandı</p>
                        <p style={{ color: 'var(--text-primary)' }}>
                          {new Date(displayCustomer.plannedAt).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    )}
                    {displayCustomer?.notes && (
                      <div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>📝 Notlar</p>
                        <p style={{ color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{displayCustomer.notes}</p>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Notlar</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Müşteri hakkında notlar ekleyin..."
                      className="input"
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} className="customer-modal-buttons">
                    <motion.button
                      onClick={() => handleUpdateStatus('PLANNED')}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '0.75rem 1.5rem', fontSize: '1rem', width: '100%' }}
                      disabled={updateVisitStatusMutation.isPending}
                      whileTap={{ scale: 0.98 }}
                    >
                      {updateVisitStatusMutation.isPending ? 'Güncelleniyor...' : '📅 Müşteri Gitme Planına Ekle'}
                    </motion.button>
                    <motion.button
                      onClick={() => handleUpdateStatus('VISITED')}
                      className="btn-success"
                      style={{ flex: 1, padding: '0.75rem 1.5rem', fontSize: '1rem', width: '100%' }}
                      disabled={updateVisitStatusMutation.isPending}
                      whileTap={{ scale: 0.98 }}
                    >
                      {updateVisitStatusMutation.isPending ? 'Güncelleniyor...' : '✅ Gidildi'}
                    </motion.button>
                  </div>

                  {updateVisitStatusMutation.error && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--danger)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        marginTop: '1rem',
                        textAlign: 'center',
                        fontSize: '0.875rem',
                      }}
                    >
                      {updateVisitStatusMutation.error.message}
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
