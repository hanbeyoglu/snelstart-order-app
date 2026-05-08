import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../services/api';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';

export default function AdminPricingPage() {
  const { t } = useAppTranslation(['common', 'legacy', 'products', 'settings']);
  const { formatDate } = useLocaleFormat();
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
        <h2>{t('legacy:pricing.title')}</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? t('actions.cancel') : t('legacy:pricing.newRule')}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3>{t('legacy:pricing.newPriceRule')}</h3>
          <p style={{ color: '#666' }}>{t('legacy:pricing.formHelp')}</p>
        </div>
      )}

      <div>
        {rules?.map((rule: any) => (
          <div key={rule._id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h3>Type: {rule.type}</h3>
                {rule.productId && <p>{t('legacy:pricing.productId')} {rule.productId}</p>}
                {rule.categoryId && <p>{t('legacy:pricing.categoryId')} {rule.categoryId}</p>}
                {rule.customerId && <p>{t('products:fields.customer')} ID: {rule.customerId}</p>}
                {rule.fixedPrice !== undefined && <p>{t('legacy:pricing.fixedPrice')} €{rule.fixedPrice}</p>}
                {rule.discountPercent !== undefined && <p>{t('products:fields.discount')}: %{rule.discountPercent}</p>}
                <p>Priority: {rule.priority}</p>
                <p>
                  Validity: {formatDate(rule.validFrom)} -{' '}
                  {rule.validTo ? formatDate(rule.validTo) : 'Unlimited'}
                </p>
                <p>{t('settings:status')}: {rule.isActive ? t('states.active') : t('states.inactive')}</p>
              </div>
              <button
                onClick={() => deleteMutation.mutate(rule._id)}
                className="btn-danger"
                disabled={deleteMutation.isPending}
              >
                {t('actions.delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
