import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../services/api';

export default function AdminPricingPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: rules } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: async () => {
      const response = await api.get('/pricing/rules');
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pricing/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-rules'] });
    },
  });

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Fiyat Override Kuralları</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'İptal' : 'Yeni Kural'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>Yeni Fiyat Kuralı</h3>
          <p style={{ color: '#666' }}>Form implementasyonu için API endpoint'lerini kullanın</p>
        </div>
      )}

      <div>
        {rules?.map((rule: any) => (
          <div key={rule._id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3>Tip: {rule.type}</h3>
                {rule.productId && <p>Ürün ID: {rule.productId}</p>}
                {rule.categoryId && <p>Kategori ID: {rule.categoryId}</p>}
                {rule.customerId && <p>Müşteri ID: {rule.customerId}</p>}
                {rule.fixedPrice !== undefined && <p>Sabit Fiyat: €{rule.fixedPrice}</p>}
                {rule.discountPercent !== undefined && <p>İndirim: %{rule.discountPercent}</p>}
                <p>Öncelik: {rule.priority}</p>
                <p>
                  Geçerlilik: {new Date(rule.validFrom).toLocaleDateString('tr-TR')} -{' '}
                  {rule.validTo ? new Date(rule.validTo).toLocaleDateString('tr-TR') : 'Sınırsız'}
                </p>
                <p>Durum: {rule.isActive ? 'Aktif' : 'Pasif'}</p>
              </div>
              <button
                onClick={() => deleteMutation.mutate(rule._id)}
                className="btn-danger"
                disabled={deleteMutation.isPending}
              >
                Sil
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

