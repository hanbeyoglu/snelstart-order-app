import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import type { CreateCustomerFieldName } from '@snelstart-order-app/shared/validators/customer-validation';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import {
  focusFirstInvalidCustomerField,
  mapBackendCustomerValidationErrors,
  validateCreateCustomerForm,
  type CreateCustomerFormData,
} from '../utils/customerFormValidation';

const INITIAL_FORM_DATA: CreateCustomerFormData = {
  relatiesoort: [],
  naam: '',
  straat: '',
  postcode: '',
  plaats: '',
  landId: '1d057861-41da-4743-a34b-33388e80c02d',
  telefoon: '',
  email: '',
  kvkNummer: '',
  btwNummer: '',
};

export default function CreateCustomerPage() {
  const { t } = useAppTranslation(['common', 'customers', 'validation']);
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const [formData, setFormData] = useState<CreateCustomerFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Partial<Record<CreateCustomerFieldName, HTMLElement | null>>>({});

  const createCustomerMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await api.post('/customers', data);
      return response.data;
    },
    onSuccess: () => {
      showToast(t('customers:messages.created'), 'success');
      navigate('/customers');
    },
    onError: (error: any) => {
      const responseData = error?.response?.data;

      if (responseData?.errors && typeof responseData.errors === 'object') {
        const mappedErrors = mapBackendCustomerValidationErrors(responseData.errors, t);
        setErrors(mappedErrors);
        requestAnimationFrame(() => {
          focusFirstInvalidCustomerField(mappedErrors, fieldRefs.current);
        });
      }

      const errorMessage =
        responseData?.message || error?.message || t('customers:messages.createError');
      showToast(errorMessage, 'error', 5000);
    },
  });

  const clearFieldError = (field: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleRelatieSoortToggle = (soort: string) => {
    setFormData((prev) => ({
      ...prev,
      relatiesoort: prev.relatiesoort.includes(soort)
        ? prev.relatiesoort.filter((s) => s !== soort)
        : [...prev.relatiesoort, soort],
    }));
    clearFieldError('relatiesoort');
  };

  const handleChange = (field: keyof CreateCustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const registerFieldRef =
    (field: CreateCustomerFieldName) => (element: HTMLElement | null) => {
      fieldRefs.current[field] = element;
    };

  const inputClassName = (field: string) =>
    errors[field] ? 'input-invalid' : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateCreateCustomerForm(formData, t);
    if (!validation.valid) {
      setErrors(validation.errors);
      requestAnimationFrame(() => {
        focusFirstInvalidCustomerField(validation.errors, fieldRefs.current);
      });
      showToast(t('validation:requiredFields'), 'error');
      return;
    }

    createCustomerMutation.mutate(validation.payload);
  };

  return (
    <div className="container">
      <motion.button
        onClick={() => navigate('/customers')}
        className="btn-secondary"
        style={{ marginBottom: 'clamp(1rem, 3vw, 1.5rem)', minHeight: '44px' }}
        whileTap={{ scale: 0.98 }}
      >
        ← {t('actions.back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
          {t('customers:create')}
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.75rem',
                fontWeight: 600,
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              }}
            >
              {t('customers:relationType')} <span className="required-mark">*</span>
            </label>
            <div
              ref={registerFieldRef('relatiesoort')}
              tabIndex={-1}
              style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', outline: 'none' }}
            >
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
            {errors.relatiesoort && <p className="field-error">{errors.relatiesoort}</p>}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 600,
                fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              }}
            >
              {t('customers:customerName')} <span className="required-mark">*</span>
            </label>
            <input
              ref={registerFieldRef('naam')}
              type="text"
              value={formData.naam}
              onChange={(e) => handleChange('naam', e.target.value)}
              className={inputClassName('naam')}
              placeholder="ABC Food Supplier"
            />
            {errors.naam && <p className="field-error">{errors.naam}</p>}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              {t('customers:addressInfo')}
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:street')} <span className="required-mark">*</span>
                </label>
                <input
                  ref={registerFieldRef('straat')}
                  type="text"
                  value={formData.straat}
                  onChange={(e) => handleChange('straat', e.target.value)}
                  className={inputClassName('straat')}
                  placeholder="Industrieweg 10"
                />
                {errors.straat && <p className="field-error">{errors.straat}</p>}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:postalCode')} <span className="required-mark">*</span>
                </label>
                <input
                  ref={registerFieldRef('postcode')}
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => handleChange('postcode', e.target.value)}
                  className={inputClassName('postcode')}
                  placeholder="1234AB"
                />
                {errors.postcode && <p className="field-error">{errors.postcode}</p>}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:city')} <span className="required-mark">*</span>
                </label>
                <input
                  ref={registerFieldRef('plaats')}
                  type="text"
                  value={formData.plaats}
                  onChange={(e) => handleChange('plaats', e.target.value)}
                  className={inputClassName('plaats')}
                  placeholder="Rotterdam"
                />
                {errors.plaats && <p className="field-error">{errors.plaats}</p>}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: 'clamp(1.1rem, 4vw, 1.25rem)',
                fontWeight: 600,
                marginBottom: '1rem',
              }}
            >
              {t('customers:contactInfo')}
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:phone')}
                </label>
                <input
                  ref={registerFieldRef('telefoon')}
                  type="tel"
                  value={formData.telefoon}
                  onChange={(e) => handleChange('telefoon', e.target.value)}
                  className={inputClassName('telefoon')}
                  placeholder="+31 10 123 45 67"
                />
                {errors.telefoon && <p className="field-error">{errors.telefoon}</p>}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:email')}
                </label>
                <input
                  ref={registerFieldRef('email')}
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={inputClassName('email')}
                  placeholder="sales@abcfood.nl"
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:kvkNumber')}
                </label>
                <input
                  type="text"
                  value={formData.kvkNummer}
                  onChange={(e) => handleChange('kvkNummer', e.target.value)}
                  placeholder="99887766"
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 600,
                    fontSize: 'clamp(0.85rem, 3vw, 0.9rem)',
                  }}
                >
                  {t('customers:btwNumber')}
                </label>
                <input
                  ref={registerFieldRef('btwNummer')}
                  type="text"
                  value={formData.btwNummer}
                  onChange={(e) => handleChange('btwNummer', e.target.value)}
                  className={inputClassName('btwNummer')}
                  placeholder="NL123456789B01"
                />
                {errors.btwNummer && <p className="field-error">{errors.btwNummer}</p>}
              </div>
            </div>
          </div>

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
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span className="loading" style={{ width: '16px', height: '16px' }} />
                  {t('customers:creating')}
                </span>
              ) : (
                `✅ ${t('customers:createButton')}`
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
              {t('actions.cancel')}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
