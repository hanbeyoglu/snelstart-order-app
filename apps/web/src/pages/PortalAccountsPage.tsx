import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import { useLocaleFormat } from '../i18n/hooks/useLocaleFormat';
import {
  CUSTOMER_DEFAULT_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  PERMISSION_LABELS,
  getPortalAssignablePermissions,
  normalizePortalPermissionSelection,
} from '../utils/permissions';

const DEFAULT_PAGE_SIZE = 10;

const PORTAL_ACCOUNT_SORT_BY = ['customerName', 'username', 'createdAt', 'lastLoginAt'] as const;
type PortalAccountSortBy = (typeof PORTAL_ACCOUNT_SORT_BY)[number];
type PortalAccountSortOrder = 'asc' | 'desc';

const PORTAL_SORT_OPTIONS: { value: string; sortBy: PortalAccountSortBy; sortOrder: PortalAccountSortOrder }[] = [
  { value: 'customerName:asc', sortBy: 'customerName', sortOrder: 'asc' },
  { value: 'customerName:desc', sortBy: 'customerName', sortOrder: 'desc' },
  { value: 'createdAt:desc', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'createdAt:asc', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'lastLoginAt:desc', sortBy: 'lastLoginAt', sortOrder: 'desc' },
  { value: 'lastLoginAt:asc', sortBy: 'lastLoginAt', sortOrder: 'asc' },
];

function parsePortalSortParams(searchParams: URLSearchParams): { sortBy: PortalAccountSortBy; sortOrder: PortalAccountSortOrder } {
  const rawBy = searchParams.get('sortBy');
  const rawOrder = searchParams.get('sortOrder');
  const sortBy = PORTAL_ACCOUNT_SORT_BY.includes(rawBy as PortalAccountSortBy)
    ? (rawBy as PortalAccountSortBy)
    : 'customerName';
  const sortOrder = rawOrder === 'desc' || rawOrder === 'asc' ? rawOrder : 'asc';
  return { sortBy, sortOrder };
}

type PortalUser = {
  _id: string;
  username: string;
  email?: string | null;
  role: 'customer';
  customerId?: string;
  customerName?: string;
  isActive?: boolean;
  preferredLanguage?: string;
  lastLoginAt?: string;
  createdAt?: string;
  permissions?: string[];
};

type PaginatedPortalResponse = {
  data: PortalUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type CustomerOption = {
  id: string;
  naam: string;
  email?: string;
  telefoon?: string;
  adres?: { plaats?: string };
  plaats?: string;
};

function formatPortalLastLoginRelative(
  lastLoginIso: string,
  t: (key: string, options?: { count: number }) => string,
): string {
  const d = new Date(lastLoginIso);
  const ms = Date.now() - d.getTime();
  if (Number.isNaN(d.getTime()) || !Number.isFinite(ms)) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 0) return '';
  if (minutes < 1) return t('common:portalAccounts.lastLoginRelative.justNow');
  if (minutes < 60) return t('common:portalAccounts.lastLoginRelative.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common:portalAccounts.lastLoginRelative.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('common:portalAccounts.lastLoginRelative.daysAgo', { count: days });
}

function PortalLastLoginCell({ lastLoginAt }: { lastLoginAt?: string | null }) {
  const { t } = useAppTranslation(['common']);
  const { formatDateTime, formatDateTimeLong } = useLocaleFormat();

  if (!lastLoginAt || !String(lastLoginAt).trim()) {
    return (
      <span className="portal-last-login-never" role="status">
        {t('common:portalAccounts.lastLoginNever')}
      </span>
    );
  }

  const d = new Date(lastLoginAt);
  if (Number.isNaN(d.getTime())) {
    return (
      <span className="portal-last-login-never" role="status">
        {t('common:portalAccounts.lastLoginNever')}
      </span>
    );
  }

  const relative = formatPortalLastLoginRelative(lastLoginAt, t);
  const absoluteShort = formatDateTime(lastLoginAt);
  const absoluteLong = formatDateTimeLong(lastLoginAt);
  const tooltip = [relative, absoluteLong].filter(Boolean).join(' — ');

  return (
    <strong className="portal-last-login-datetime" title={tooltip}>
      {absoluteShort}
    </strong>
  );
}

const emptyForm = () => ({
  customerId: '',
  username: '',
  email: '',
  password: '',
  isActive: true,
  permissions: [...CUSTOMER_DEFAULT_PERMISSIONS],
});

export default function PortalAccountsPage() {
  const { t } = useAppTranslation(['common']);
  const { formatDate } = useLocaleFormat();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [form, setForm] = useState(() => emptyForm());
  const [resetTarget, setResetTarget] = useState<PortalUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [editTarget, setEditTarget] = useState<PortalUser | null>(null);
  const [editForm, setEditForm] = useState({
    customerId: '',
    username: '',
    email: '',
    isActive: true,
  });
  const [editCustomerSearch, setEditCustomerSearch] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editPermissionBaseline, setEditPermissionBaseline] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PortalUser | null>(null);

  useEffect(() => {
    const rawBy = searchParams.get('sortBy');
    const rawOrder = searchParams.get('sortOrder');
    const byOk = PORTAL_ACCOUNT_SORT_BY.includes(rawBy as PortalAccountSortBy);
    const orderOk = rawOrder === 'asc' || rawOrder === 'desc';
    if (byOk && orderOk) return;
    const next = new URLSearchParams(searchParams);
    if (!byOk) next.set('sortBy', 'customerName');
    if (!orderOk) next.set('sortOrder', 'asc');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const { sortBy, sortOrder } = parsePortalSortParams(searchParams);
  const sortSelectValue = `${sortBy}:${sortOrder}`;

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = DEFAULT_PAGE_SIZE;
  const statusParam = searchParams.get('status');
  const status: 'all' | 'active' | 'inactive' =
    statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';
  const createdFrom = searchParams.get('createdFrom') ?? '';
  const q = searchParams.get('q') ?? '';

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const trimmed = searchInput.trim();
        const prevQ = prev.get('q') ?? '';
        if (trimmed) next.set('q', trimmed);
        else next.delete('q');
        if (prevQ !== trimmed) next.set('page', '1');
        return next;
      }, { replace: true });
    }, 320);
    return () => window.clearTimeout(t);
  }, [searchInput, setSearchParams]);

  const setPage = useCallback(
    (nextPage: number) => {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.set('page', String(Math.max(1, nextPage)));
        return n;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setStatusFilter = (value: 'all' | 'active' | 'inactive') => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (value === 'all') n.delete('status');
      else n.set('status', value);
      n.set('page', '1');
      return n;
    }, { replace: true });
  };

  const setCreatedFromFilter = (value: string) => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      if (value) n.set('createdFrom', value);
      else n.delete('createdFrom');
      n.set('page', '1');
      return n;
    }, { replace: true });
  };

  const { data: permissionCatalog } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: async () => {
      const response = await api.get('/users/permissions/catalog');
      return response.data.permissions as string[];
    },
  });

  const portalPermissionOptions = useMemo(
    () => getPortalAssignablePermissions(permissionCatalog ?? []),
    [permissionCatalog],
  );

  const defaultPermissionSet = useMemo(() => new Set(CUSTOMER_DEFAULT_PERMISSIONS), []);

  const {
    data: portalPage,
    isPending,
    isPlaceholderData,
  } = useQuery({
    queryKey: ['portal-accounts', page, limit, q, sortBy, sortOrder, status, createdFrom],
    queryFn: async () => {
      const response = await api.get('/users', {
        params: {
          role: 'customer',
          page,
          limit,
          sortBy,
          sortOrder,
          search: q || undefined,
          isActive: status === 'all' ? undefined : status,
          createdFrom: createdFrom || undefined,
        },
      });
      return response.data as PaginatedPortalResponse;
    },
    placeholderData: keepPreviousData,
  });

  const portalUsers = portalPage?.data ?? [];
  const total = portalPage?.total ?? 0;
  const totalPages = portalPage?.totalPages ?? 0;

  useEffect(() => {
    if (!portalPage || totalPages <= 0) return;
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, portalPage, setPage, totalPages]);

  const showBlockingLoader = isPending && !isPlaceholderData;

  const { data: editCustomerRecord } = useQuery({
    queryKey: ['portal-edit-customer', editForm.customerId],
    queryFn: async () => (await api.get(`/customers/${editForm.customerId}`)).data as CustomerOption,
    enabled: !!editTarget && !!editForm.customerId,
  });

  const { data: customersResponse } = useQuery({
    queryKey: ['portal-account-customer-search', showCreateModal ? customerSearch : editCustomerSearch],
    queryFn: async () => {
      const effectiveSearch = showCreateModal ? customerSearch : editCustomerSearch;
      const response = await api.get('/customers', {
        params: { page: 1, limit: 30, ...(effectiveSearch ? { search: effectiveSearch } : {}) },
      });
      return response.data;
    },
    enabled: showCreateModal || !!editTarget,
  });

  const customerOptions: CustomerOption[] = customersResponse?.data || [];

  function sortedPermissionListsEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((permission, index) => permission === sb[index]);
  }

  const updateMutation = useMutation({
    mutationFn: async ({
      user,
      data,
      syncPermissions,
    }: {
      user: PortalUser;
      data: Partial<PortalUser> & { password?: string; email?: string | null };
      syncPermissions?: { next: string[]; baseline: string[] };
    }) => {
      const { customerId, ...rest } = data;
      const response = await api.put(`/users/${user._id}`, {
        ...rest,
        role: 'customer',
        customerId: customerId ?? user.customerId,
      });
      if (syncPermissions) {
        const normalized = normalizePortalPermissionSelection(syncPermissions.next, portalPermissionOptions);
        const baselineNorm = normalizePortalPermissionSelection(syncPermissions.baseline, portalPermissionOptions);
        if (!sortedPermissionListsEqual(normalized, baselineNorm)) {
          await api.put(`/users/${user._id}/permissions`, { permissions: normalized });
        }
      }
      return response.data;
    },
    onMutate: async ({ user, data, syncPermissions }) => {
      await queryClient.cancelQueries({ queryKey: ['portal-accounts'] });
      const previousEntries = queryClient.getQueriesData<PaginatedPortalResponse>({ queryKey: ['portal-accounts'] });
      queryClient.setQueriesData<PaginatedPortalResponse>({ queryKey: ['portal-accounts'] }, (current) => {
        if (!current?.data) return current;
        return {
          ...current,
          data: current.data.map((item) => {
            if (item._id !== user._id) return item;
            const merged = { ...item, ...data };
            if (syncPermissions) {
              merged.permissions = normalizePortalPermissionSelection(syncPermissions.next, portalPermissionOptions);
            }
            return merged;
          }),
        };
      });
      return { previousEntries };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousEntries) {
        for (const [key, data] of context.previousEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      showToast(error?.response?.data?.message || error?.message || t('common:portalAccounts.updateError'), 'error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-accounts'] });
      showToast(t('common:portalAccounts.updated'), 'success');
      setResetTarget(null);
      setResetPassword('');
      setEditTarget(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const permissions = normalizePortalPermissionSelection(form.permissions, portalPermissionOptions);
      const response = await api.post('/users', {
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
        role: 'customer',
        customerId: form.customerId,
        isActive: form.isActive,
        permissions,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-accounts'] });
      showToast(t('common:portalAccounts.created'), 'success');
      setShowCreateModal(false);
      setForm(emptyForm());
      setCustomerSearch('');
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.message || error?.message || t('common:portalAccounts.createError'), 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => api.delete(`/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-accounts'] });
      showToast(t('common:portalAccounts.deleted'), 'success');
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      showToast(error?.response?.data?.message || error?.message || t('common:portalAccounts.deleteError'), 'error');
    },
  });

  const openEditModal = (user: PortalUser) => {
    setEditTarget(user);
    setEditForm({
      customerId: user.customerId || '',
      username: user.username || '',
      email: user.email || '',
      isActive: user.isActive !== false,
    });
    const initialPerms =
      user.permissions?.length ? [...user.permissions] : [...CUSTOMER_DEFAULT_PERMISSIONS];
    setEditPermissions(initialPerms);
    setEditPermissionBaseline([...initialPerms]);
    setEditCustomerSearch('');
  };

  return (
    <div className="container portal-accounts-page">
      <header className="portal-accounts-header-block">
        <div>
          <h1 className="portal-accounts-title">{t('common:navigation.portalAccounts')}</h1>
          <p className="portal-accounts-subtitle">{t('common:portalAccounts.subtitle')}</p>
        </div>
      </header>

      <div className="portal-accounts-toolbar card">
        <div className="portal-accounts-toolbar__row portal-accounts-toolbar__row--primary">
          <div className="portal-accounts-search-wrap">
            <span className="portal-accounts-search-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              className="portal-accounts-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('common:portalAccounts.searchPlaceholder')}
              aria-label={t('common:portalAccounts.searchLabel')}
              autoComplete="off"
            />
          </div>
          <div className="portal-accounts-toolbar__actions">
            <label className="portal-accounts-field portal-accounts-field--compact">
              <span className="portal-accounts-field-label">{t('common:portalAccounts.sortLabel')}</span>
              <select
                className="input portal-accounts-select"
                value={sortSelectValue}
                onChange={(event) => {
                  const opt = PORTAL_SORT_OPTIONS.find((o) => o.value === event.target.value);
                  if (!opt) return;
                  const next = new URLSearchParams(searchParams);
                  next.set('sortBy', opt.sortBy);
                  next.set('sortOrder', opt.sortOrder);
                  next.set('page', '1');
                  setSearchParams(next, { replace: true });
                }}
                aria-label={t('common:portalAccounts.sortLabel')}
              >
                <option value="customerName:asc">{t('common:portalAccounts.sortNameAsc')}</option>
                <option value="customerName:desc">{t('common:portalAccounts.sortNameDesc')}</option>
                <option value="createdAt:desc">{t('common:portalAccounts.sortCreatedDesc')}</option>
                <option value="createdAt:asc">{t('common:portalAccounts.sortCreatedAsc')}</option>
                <option value="lastLoginAt:desc">{t('common:portalAccounts.sortLastLoginDesc')}</option>
                <option value="lastLoginAt:asc">{t('common:portalAccounts.sortLastLoginAsc')}</option>
              </select>
            </label>
            <button type="button" className="btn-primary portal-accounts-create-btn" onClick={() => setShowCreateModal(true)}>
              {t('common:portalAccounts.newAccount')}
            </button>
          </div>
        </div>
        <div className="portal-accounts-toolbar__row portal-accounts-toolbar__row--filters">
          <label className="portal-accounts-field portal-accounts-field--grow">
            <span className="portal-accounts-field-label">{t('common:forms.status')}</span>
            <select className="input portal-accounts-select" value={status} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">{t('common:states.all')}</option>
              <option value="active">{t('common:states.active')}</option>
              <option value="inactive">{t('common:states.inactive')}</option>
            </select>
          </label>
          <label className="portal-accounts-field portal-accounts-field--grow">
            <span className="portal-accounts-field-label">{t('common:portalAccounts.createdFrom')}</span>
            <input
              className="input"
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFromFilter(e.target.value)}
              aria-label={t('common:portalAccounts.createdFrom')}
            />
          </label>
        </div>
      </div>

      <p className="portal-accounts-total" role="status">
        {t('common:portalAccounts.totalCount', { count: total })}
      </p>

      {showBlockingLoader ? (
        <div className="portal-account-list portal-account-list--skeleton" aria-busy>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="portal-account-skeleton-card" />
          ))}
        </div>
      ) : (
        <>
          <div className={`portal-account-list${isPlaceholderData ? ' portal-account-list--muted' : ''}`}>
            {portalUsers.map((user) => {
              const displayName = user.customerName?.trim() || user.customerId || '-';
              const isActive = user.isActive !== false;
              return (
                <motion.div key={user._id} className="portal-account-card portal-account-card--elevated" layout>
                  <div className="portal-account-main">
                    <div className="portal-account-avatar" aria-hidden="true">
                      {(displayName || user.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="portal-account-identity">
                      <div className="portal-account-customer-row">
                        <span className="portal-account-customer">{displayName}</span>
                        <span className={`portal-status-badge ${isActive ? 'portal-status-badge--active' : 'portal-status-badge--inactive'}`}>
                          {isActive ? t('common:states.active') : t('common:states.inactive')}
                        </span>
                      </div>
                      <div className="portal-account-username">{user.username}</div>
                      <div className="portal-account-email">{user.email || t('common:states.notAvailable')}</div>
                    </div>
                  </div>

                  <div className="portal-account-meta">
                    <div className="portal-account-field">
                      <span>{t('common:forms.status')}</span>
                      <label className="portal-switch">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(event) => updateMutation.mutate({ user, data: { isActive: event.target.checked } })}
                        />
                        <strong className="portal-switch-label">{isActive ? t('common:states.active') : t('common:states.inactive')}</strong>
                      </label>
                    </div>
                    <div className="portal-account-field">
                      <span>{t('common:portalAccounts.permissions')}</span>
                      <strong>{user.permissions?.length ?? CUSTOMER_DEFAULT_PERMISSIONS.length}</strong>
                    </div>
                    <div className="portal-account-field portal-account-field-last-login">
                      <span>{t('common:portalAccounts.lastLogin')}</span>
                      <div className="portal-last-login-wrap">
                        <PortalLastLoginCell lastLoginAt={user.lastLoginAt} />
                      </div>
                    </div>
                    <div className="portal-account-field">
                      <span>{t('common:portalAccounts.createdAtLabel')}</span>
                      <strong>{user.createdAt ? formatDate(user.createdAt) : '-'}</strong>
                    </div>
                  </div>

                  <div className="portal-account-actions" aria-label={t('common:portalAccounts.actions')}>
                    <button type="button" className="btn-secondary" onClick={() => openEditModal(user)}>
                      {t('common:actions.edit')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setResetTarget(user)}>
                      {t('common:portalAccounts.resetPassword')}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => user.customerId && navigate(`/customers/${user.customerId}`)}
                      disabled={!user.customerId}
                    >
                      {t('common:portalAccounts.goToCustomer')}
                    </button>
                    <button type="button" className="btn-danger" onClick={() => setDeleteTarget(user)}>
                      {t('common:portalAccounts.deleteAccount')}
                    </button>
                  </div>
                </motion.div>
              );
            })}
            {portalUsers.length === 0 && (
              <div className="portal-accounts-empty card">
                <div className="portal-accounts-empty-icon" aria-hidden>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h2 className="portal-accounts-empty-title">{t('common:portalAccounts.emptyTitle')}</h2>
                <p className="portal-accounts-empty-hint">{t('common:portalAccounts.emptyHint')}</p>
                {(q || status !== 'all' || createdFrom) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setSearchInput('');
                      setSearchParams((prev) => {
                        const n = new URLSearchParams(prev);
                        n.delete('q');
                        n.delete('status');
                        n.delete('createdFrom');
                        n.set('page', '1');
                        return n;
                      }, { replace: true });
                    }}
                  >
                    {t('common:portalAccounts.clearSearch')}
                  </button>
                )}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <nav className="portal-accounts-pagination card" aria-label={t('common:pagination.page')}>
              <button type="button" className="btn-secondary portal-pag-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('common:pagination.previous')}
              </button>
              <span className="portal-pag-info">
                {t('common:portalAccounts.pageOf', { page, totalPages })}
              </span>
              <button type="button" className="btn-secondary portal-pag-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t('common:pagination.next')}
              </button>
            </nav>
          )}
        </>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <PortalAccountModal
            t={t}
            form={form}
            setForm={setForm}
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            customers={customerOptions}
            permissionOptions={portalPermissionOptions}
            defaultPermissionSet={defaultPermissionSet}
            pending={createMutation.isPending}
            onClose={() => setShowCreateModal(false)}
            onSubmit={() => createMutation.mutate()}
          />
        )}
        {resetTarget && (
          <motion.div className="portal-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setResetTarget(null)}>
            <motion.div className="card portal-modal" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} onClick={(event) => event.stopPropagation()}>
              <h2>{t('common:portalAccounts.resetPassword')}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{resetTarget.username}</p>
              <input className="input" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder={t('common:portalAccounts.newPassword')} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>{t('common:actions.cancel')}</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={resetPassword.length < 8}
                  onClick={() => updateMutation.mutate({ user: resetTarget, data: { password: resetPassword } })}
                >
                  {t('common:portalAccounts.resetPassword')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {editTarget && (
          <motion.div className="portal-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTarget(null)}>
            <motion.form
              className="card portal-modal"
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                updateMutation.mutate({
                  user: editTarget,
                  data: {
                    ...editForm,
                    username: editForm.username.trim(),
                    email: editForm.email.trim() || null,
                  },
                  syncPermissions: {
                    next: editPermissions,
                    baseline: editPermissionBaseline,
                  },
                });
              }}
            >
              <h2>{t('common:portalAccounts.editAccount')}</h2>
              <input className="input" value={editCustomerSearch} onChange={(event) => setEditCustomerSearch(event.target.value)} placeholder={t('common:portalAccounts.customerSearch')} />
              <select className="input" required value={editForm.customerId} onChange={(event) => setEditForm({ ...editForm, customerId: event.target.value })}>
                <option value="">{t('common:portalAccounts.selectCustomer')}</option>
                {editForm.customerId && editCustomerRecord && (
                  <option value={editForm.customerId}>{editCustomerRecord.naam}</option>
                )}
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.naam}{customer.adres?.plaats || customer.plaats ? ` - ${customer.adres?.plaats || customer.plaats}` : ''}
                  </option>
                ))}
              </select>
              <input className="input" required minLength={3} value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} placeholder={t('common:forms.username')} />
              <input className="input" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} placeholder={t('common:forms.email')} />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, minHeight: 44 }}>
                <input type="checkbox" checked={editForm.isActive} onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })} />
                {editForm.isActive ? t('common:states.active') : t('common:states.inactive')}
              </label>
              {portalPermissionOptions.length > 0 && (
                <PortalPermissionFields
                  t={t}
                  options={portalPermissionOptions}
                  value={editPermissions}
                  onChange={setEditPermissions}
                  defaultPermissionSet={defaultPermissionSet}
                />
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>{t('common:actions.cancel')}</button>
                <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('common:states.saving') : t('common:actions.save')}</button>
              </div>
            </motion.form>
          </motion.div>
        )}
        {deleteTarget && (
          <motion.div className="portal-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)}>
            <motion.div className="card portal-modal" initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} onClick={(event) => event.stopPropagation()}>
              <h2>{t('common:portalAccounts.deleteAccount')}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{t('common:portalAccounts.deleteDescription')}</p>
              <strong>{deleteTarget.username}</strong>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => setDeleteTarget(null)}>{t('common:actions.cancel')}</button>
                <button type="button" className="btn-danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget._id)}>
                  {deleteMutation.isPending ? t('common:states.deleting') : t('common:actions.delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type PortalAccountFormState = ReturnType<typeof emptyForm>;

function PortalPermissionFields({
  t,
  options,
  value,
  onChange,
  defaultPermissionSet,
}: {
  t: (key: string) => string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  defaultPermissionSet: Set<string>;
}) {
  return (
    <div style={{ marginTop: '0.25rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{t('common:portalAccounts.permissions')}</div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
        {t('common:portalAccounts.permissionsHint')}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.6rem',
          maxHeight: 'min(50vh, 320px)',
          overflowY: 'auto',
        }}
      >
        {options.map((permission) => {
          const locked = defaultPermissionSet.has(permission);
          const checked = locked || value.includes(permission);
          return (
            <label
              key={permission}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.55rem',
                minHeight: 44,
                padding: '0.65rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                cursor: locked ? 'default' : 'pointer',
                opacity: locked ? 0.9 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={(event) => {
                  if (locked) return;
                  onChange(
                    event.target.checked
                      ? [...new Set([...value, permission])]
                      : value.filter((item) => item !== permission),
                  );
                }}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 2,
                  flexShrink: 0,
                  accentColor: 'var(--primary)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600 }}>
                  {PERMISSION_LABELS[permission] || permission}
                  {locked ? ` (${t('common:portalAccounts.permissionDefault')})` : ''}
                </span>
                <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.35 }}>
                  {PERMISSION_DESCRIPTIONS[permission] || permission}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function PortalAccountModal({
  t,
  form,
  setForm,
  customerSearch,
  setCustomerSearch,
  customers,
  permissionOptions,
  defaultPermissionSet,
  pending,
  onClose,
  onSubmit,
}: {
  t: (key: string) => string;
  form: PortalAccountFormState;
  setForm: (form: PortalAccountFormState) => void;
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  customers: CustomerOption[];
  permissionOptions: string[];
  defaultPermissionSet: Set<string>;
  pending: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div className="portal-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="card portal-modal"
        initial={{ scale: 0.96, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 12 }}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2>{t('common:portalAccounts.newAccount')}</h2>
        <input className="input" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder={t('common:portalAccounts.customerSearch')} />
        <select className="input" required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}>
          <option value="">{t('common:portalAccounts.selectCustomer')}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.naam}{customer.adres?.plaats || customer.plaats ? ` - ${customer.adres?.plaats || customer.plaats}` : ''}
            </option>
          ))}
        </select>
        <input className="input" required minLength={3} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder={t('common:forms.username')} />
        <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={t('common:forms.email')} />
        <input className="input" required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={t('common:forms.password')} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, minHeight: 44 }}>
          <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
          {form.isActive ? t('common:states.active') : t('common:states.inactive')}
        </label>
        {permissionOptions.length > 0 && (
          <PortalPermissionFields
            t={t}
            options={permissionOptions}
            value={form.permissions}
            onChange={(permissions) => setForm({ ...form, permissions })}
            defaultPermissionSet={defaultPermissionSet}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common:actions.cancel')}</button>
          <button type="submit" className="btn-primary" disabled={pending}>{pending ? t('common:states.saving') : t('common:portalAccounts.newAccount')}</button>
        </div>
      </motion.form>
    </motion.div>
  );
}
