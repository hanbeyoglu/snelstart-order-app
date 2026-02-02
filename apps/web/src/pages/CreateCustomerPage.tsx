import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';

export default function CreateCustomerPage() {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  
  const [formData, setFormData] = useState({
    relatiesoort: [] as string[],
    naam: '',
    straat: '',
    postcode: '',
    plaats: '',
    landId: '1d057861-41da-4743-a34b-33388e80c02d', // Default NL
    telefoon: '',
    email: '',
    kvkNummer: '',
    btwNummer: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/customers', data);
      return response.data;
    },
    onSuccess: () => {
      showToast('Müşteri başarıyla oluşturuldu!', 'success');
      navigate('/customers');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Müşteri oluşturulurken bir hata oluştu';
      showToast(errorMessage, 'error', 5000);
    },
  });

  const handleRelatieSoortToggle = (soort: string) => {
    setFormData((prev) => ({
      ...prev,
      relatiesoort: prev.relatiesoort.includes(soort)
        ? prev.relatiesoort.filter((s) => s !== soort)
        : [...prev.relatiesoort, soort],
    }));
    if (errors.relatiesoort) {
      setErrors((prev) => ({ ...prev, relatiesoort: '' }));
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.relatiesoort.length === 0) {
      newErrors.relatiesoort = 'En az bir ilişki türü seçmelisiniz';
    }

    if (!formData.naam.trim()) {
      newErrors.naam = 'Müşteri adı zorunludur';
    }

    if (!formData.straat.trim()) {
      newErrors.straat = 'Sokak adresi zorunludur';
    }

    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Posta kodu zorunludur';
    }

    if (!formData.plaats.trim()) {
      newErrors.plaats = 'Şehir zorunludur';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Geçerli bir e-posta adresi giriniz';
    }

    if (formData.telefoon && !/^[\d\s\+\-\(\)]+$/.test(formData.telefoon)) {
      newErrors.telefoon = 'Geçerli bir telefon numarası giriniz';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      showToast('Lütfen tüm zorunlu alanları doldurun', 'error');
      return;
    }

    const customerData = {
      relatiesoort: formData.relatiesoort,
      naam: formData.naam.trim(),
      vestigingsAdres: {
        straat: formData.straat.trim(),
        postcode: formData.postcode.trim(),
        plaats: formData.plaats.trim(),
        land: {
          id: formData.landId,
        },
      },
      ...(formData.telefoon && { telefoon: formData.telefoon.trim() }),
      ...(formData.email && { email: formData.email.trim() }),
      ...(formData.kvkNummer && { kvkNummer: formData.kvkNummer.trim() }),
    };

    createCustomerMutation.mutate(customerData);
  };

  return (
    <div className="container">
      <motion.button
        onClick={() => navigate('/customers')}
        className="btn-secondary"
        style={{ marginBottom: 'clamp(1rem, 3vw, 1.5rem)', minHeight: '44px' }}
        whileTap={{ scale: 0.98 }}
      >
        ← Geri
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
          Yeni Müşteri Ekle
        </h2>

        <form onSubmit={handleSubmit}>
          {/* İlişki Türü */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>
              İlişki Türü <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {['Klant', 'Leverancier'].map((soort) => (
                <motion.label
                  key={soort}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: formData.relatiesoort.includes(soort)
                      ? 'rgba(99, 102, 241, 0.1)'
                      : 'white',
                    border: `2px solid ${
                      formData.relatiesoort.includes(soort)
                        ? 'var(--primary)'
                        : errors.relatiesoort
                        ? 'var(--danger)'
                        : 'var(--border)'
                    }`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    minHeight: '44px',
                    flex: '1 1 calc(50% - 0.5rem)',
                    minWidth: '150px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.relatiesoort.includes(soort)}
                    onChange={() => handleRelatieSoortToggle(soort)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: 500 }}>{soort}</span>
                </motion.label>
              ))}
            </div>
            {errors.relatiesoort && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                {errors.relatiesoort}
              </p>
            )}
          </div>

          {/* Müşteri Adı */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.9rem, 3vw, 1rem)' }}>
              Müşteri Adı <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.naam}
              onChange={(e) => handleChange('naam', e.target.value)}
              style={{
                width: '100%',
                padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                border: `1px solid ${errors.naam ? 'var(--danger)' : 'var(--border)'}`,
                borderRadius: '8px',
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                minHeight: '44px',
              }}
              placeholder="ABC Food Supplier"
            />
            {errors.naam && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                {errors.naam}
              </p>
            )}
          </div>

          {/* Adres Bilgileri */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', fontWeight: 600, marginBottom: '1rem' }}>
              Adres Bilgileri
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {/* Sokak */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  Sokak <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.straat}
                  onChange={(e) => handleChange('straat', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: `1px solid ${errors.straat ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="Industrieweg 10"
                />
                {errors.straat && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {errors.straat}
                  </p>
                )}
              </div>

              {/* Posta Kodu */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  Posta Kodu <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => handleChange('postcode', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: `1px solid ${errors.postcode ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="1234AB"
                />
                {errors.postcode && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {errors.postcode}
                  </p>
                )}
              </div>

              {/* Şehir */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  Şehir <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.plaats}
                  onChange={(e) => handleChange('plaats', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: `1px solid ${errors.plaats ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="Rotterdam"
                />
                {errors.plaats && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {errors.plaats}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* İletişim Bilgileri */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.25rem)', fontWeight: 600, marginBottom: '1rem' }}>
              İletişim Bilgileri
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {/* Telefon */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.telefoon}
                  onChange={(e) => handleChange('telefoon', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: `1px solid ${errors.telefoon ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="+31 10 123 45 67"
                />
                {errors.telefoon && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {errors.telefoon}
                  </p>
                )}
              </div>

              {/* E-posta */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  E-posta
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: `1px solid ${errors.email ? 'var(--danger)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="sales@abcfood.nl"
                />
                {errors.email && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* KVK Numara */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  KVK Numara
                </label>
                <input
                  type="text"
                  value={formData.kvkNummer}
                  onChange={(e) => handleChange('kvkNummer', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="99887766"
                />
              </div>

                {/* BTW Numara */}
                <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: 'clamp(0.85rem, 3vw, 0.9rem)' }}>
                  BTW Numara
                </label>
                <input
                  type="text"
                  value={formData.btwNummer}
                  onChange={(e) => handleChange('btwNummer', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                    minHeight: '44px',
                  }}
                  placeholder="NL123456789B01"
                />
              </div>
            </div>
          </div>

          {/* Butonlar */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '2rem' }}>
            <motion.button
              type="submit"
              className="btn-primary"
              disabled={createCustomerMutation.isPending}
              style={{
                flex: 1,
                minWidth: '150px',
                minHeight: '48px',
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
                opacity: createCustomerMutation.isPending ? 0.6 : 1,
              }}
              whileTap={!createCustomerMutation.isPending ? { scale: 0.98 } : {}}
            >
              {createCustomerMutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span className="loading" style={{ width: '16px', height: '16px' }} />
                  Oluşturuluyor...
                </span>
              ) : (
                '✅ Müşteri Oluştur'
              )}
            </motion.button>
            
            <motion.button
              type="button"
              onClick={() => navigate('/customers')}
              className="btn-secondary"
              style={{
                flex: 1,
                minWidth: '150px',
                minHeight: '48px',
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              İptal
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
