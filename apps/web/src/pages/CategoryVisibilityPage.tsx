import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useCartStore } from '../store/cartStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';

type VisibilityStatus = 'all' | 'active' | 'inactive';

interface CategoryVisibilityItem {
  id: string;
  nummer?: number | string | null;
  omschrijving: string;
  productCount: number;
  isActive: boolean;
}

const PAGE_SIZES = [25, 50, 100];

function removeCategoryFromCachedList(oldData: any, categoryId: string) {
  if (!oldData) return oldData;

  if (Array.isArray(oldData)) {
    return oldData.filter((category) => category?.id !== categoryId && category?.snelstartId !== categoryId);
  }

  return oldData;
}

function removeCategoryProductsFromCachedList(oldData: any, categoryId: string) {
  if (!oldData) return oldData;

  const isInCategory = (product: any) =>
    product?.artikelomzetgroepId === categoryId ||
    product?.artikelgroepId === categoryId ||
    product?.categoryId === categoryId;

  if (Array.isArray(oldData)) {
    return oldData.filter((product) => !isInCategory(product));
  }

  const filteredData = Array.isArray(oldData.data)
    ? oldData.data.filter((product: any) => !isInCategory(product))
    : oldData.data;
  const filteredProducts = Array.isArray(oldData.products)
    ? oldData.products.filter((product: any) => !isInCategory(product))
    : oldData.products;

  return {
    ...oldData,
    data: filteredData,
    products: filteredProducts,
  };
}

function ToggleSwitch({
  checked,
  disabled,
  activeLabel,
  passiveLabel,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  activeLabel: string;
  passiveLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: '52px',
        height: '30px',
        borderRadius: '999px',
        padding: '3px',
        background: checked ? 'var(--success)' : '#cbd5e1',
        border: checked ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid #cbd5e1',
        display: 'inline-flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        alignItems: 'center',
        boxShadow: checked ? '0 4px 12px rgba(16, 185, 129, 0.22)' : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
      }}
      title={checked ? activeLabel : passiveLabel}
    >
      <span
        style={{
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.25)',
          display: 'block',
        }}
      />
    </button>
  );
}

export default function CategoryVisibilityPage() {
  const { t } = useAppTranslation(['common', 'categories']);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<VisibilityStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const removeCartItemsByCategory = useCartStore((state) => state.removeItemsByCategory);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, pageSize]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['category-visibility', debouncedSearch, status, page, pageSize],
    queryFn: async () => {
      const response = await api.get('/categories/visibility', {
        params: {
          search: debouncedSearch || undefined,
          status,
          page,
          limit: pageSize,
        },
      });
      return response.data;
    },
    staleTime: 60 * 1000,
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      setUpdatingId(id);
      const response = await api.patch(`/categories/${id}/visibility`, { isActive });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (!variables.isActive) {
        queryClient.setQueriesData(
          { queryKey: ['categories'] },
          (oldData) => removeCategoryFromCachedList(oldData, variables.id),
        );
        queryClient.setQueriesData(
          { queryKey: ['products'] },
          (oldData) => removeCategoryProductsFromCachedList(oldData, variables.id),
        );
        removeCartItemsByCategory(variables.id);
      }

      queryClient.invalidateQueries({ queryKey: ['category-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['product-visibility'] });
      queryClient.invalidateQueries({ queryKey: ['categories'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['cart-calculation'] });
      queryClient.removeQueries({ queryKey: ['categories'], type: 'inactive' });
      queryClient.removeQueries({ queryKey: ['products'], type: 'inactive' });
      showToast(t('categories:visibility.messages.updated'), 'success');
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message || t('categories:visibility.messages.updateError'), 'error');
    },
    onSettled: () => {
      setUpdatingId(null);
    },
  });

  const items: CategoryVisibilityItem[] = data?.data ?? [];
  const pagination = data?.pagination ?? {};
  const total = pagination.total ?? 0;
  const totalPages = Math.max(1, pagination.totalPages ?? 1);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const goToPage = (nextPage: number) => setPage(Math.max(1, Math.min(nextPage, totalPages)));

  if (isLoading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '55vh' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '54px',
              height: '54px',
              border: '5px solid rgba(99, 102, 241, 0.2)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
            }}
          />
        </div>
      </div>
    );
  }

  if (isError) {
    const message = (error as any)?.response?.data?.message || (error as Error)?.message || t('categories:visibility.messages.genericError');
    return (
      <div className="container">
        <div className="card" style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>{t('categories:visibility.title')}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 5vw, 2.4rem)',
            fontWeight: 800,
            marginBottom: '0.35rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {t('categories:visibility.title')}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {t('categories:visibility.subtitle')}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'end' }}>
          <label style={{ margin: 0, flex: '1 1 260px', minWidth: 0 }}>
            {t('common:actions.search')}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('categories:visibility.searchPlaceholder')}
              style={{ marginTop: '0.35rem' }}
            />
          </label>

          <label style={{ margin: 0, flex: '0 1 180px', minWidth: '150px' }}>
            {t('common:forms.status')}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VisibilityStatus)}
              style={{ marginTop: '0.35rem' }}
            >
              <option value="all">{t('common:states.all')}</option>
              <option value="active">{t('common:states.active')}</option>
              <option value="inactive">{t('categories:visibility.status.passive')}</option>
            </select>
          </label>

          <label style={{ margin: 0, flex: '0 1 140px', minWidth: '130px' }}>
            {t('common:pagination.pageSize')}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ marginTop: '0.35rem' }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card" style={{ borderRadius: '8px', padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(99, 102, 241, 0.08)', borderBottom: '1px solid var(--border)' }}>
              {[
                t('categories:visibility.table.categoryName'),
                t('categories:visibility.table.categoryCode'),
                t('categories:visibility.table.productCount'),
                t('categories:visibility.table.visibilityStatus'),
              ].map((heading) => (
                <th key={heading} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {t('categories:visibility.empty')}
                </td>
              </tr>
            ) : (
              items.map((category) => {
                const isPassive = !category.isActive;
                return (
                  <tr
                    key={category.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isPassive ? '#f3f4f6' : 'white',
                      color: isPassive ? '#6b7280' : 'var(--text-primary)',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 650 }}>{category.omschrijving}</td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9rem' }}>
                      {category.nummer || category.id}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>{category.productCount ?? 0}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ToggleSwitch
                          checked={category.isActive}
                          disabled={updatingId === category.id}
                          activeLabel={t('common:states.active')}
                          passiveLabel={t('categories:visibility.status.passive')}
                          onChange={(checked) => visibilityMutation.mutate({ id: category.id, isActive: checked })}
                        />
                        <span
                          style={{
                            minWidth: '72px',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            background: category.isActive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(107, 114, 128, 0.14)',
                            color: category.isActive ? 'var(--success)' : '#6b7280',
                          }}
                        >
                          {category.isActive ? t('common:states.active') : t('categories:visibility.status.passive')}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('categories:visibility.rangeSummary', { start: startItem, end: endItem, total })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={() => goToPage(1)} disabled={page <= 1} style={{ padding: '0.45rem 0.7rem', borderRadius: '6px' }}>
              {t('categories:visibility.pagination.first')}
            </button>
            <button className="btn-secondary" onClick={() => goToPage(page - 1)} disabled={page <= 1} style={{ padding: '0.45rem 0.7rem', borderRadius: '6px' }}>
              {t('categories:visibility.pagination.prev')}
            </button>
            <span style={{ fontWeight: 700, minWidth: '96px', textAlign: 'center' }}>
              {page} / {totalPages}
            </span>
            <button className="btn-secondary" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} style={{ padding: '0.45rem 0.7rem', borderRadius: '6px' }}>
              {t('common:pagination.next')}
            </button>
            <button className="btn-secondary" onClick={() => goToPage(totalPages)} disabled={page >= totalPages} style={{ padding: '0.45rem 0.7rem', borderRadius: '6px' }}>
              {t('categories:visibility.pagination.last')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
