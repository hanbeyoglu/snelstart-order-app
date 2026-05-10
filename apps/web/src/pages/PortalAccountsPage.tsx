import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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

type PortalUser = {
  _id: string;
  username: string;
  email?: string | null;
  role: 'customer';
  customerId?: string;
  isActive?: boolean;
  preferredLanguage?: string;
  lastLoginAt?: string;
  createdAt?: string;
  permissions?: string[];
};

type CustomerOption = {
  id: string;
  naam: string;
  email?: string;
  telefoon?: string;
  adres?: { plaats?: string };
  plaats?: string;
};

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
  const queryClient = useQueryClient();
  const showToast = useToastStore((state) => state.showToast);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [createdFrom, setCreatedFrom] = useState('');
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

  const { data: portalUsers = [], isLoading } = useQuery({
    queryKey: ['portal-accounts'],
    queryFn: async () => {
      const response = await api.get('/users', { params: { role: 'customer' } });
      return response.data as PortalUser[];
    },
  });

  const customerIds = useMemo(
    () => Array.from(new Set(portalUsers.map((user) => user.customerId).filter(Boolean))) as string[],
    [portalUsers],
  );

  const { data: customersById = {} } = useQuery({
    queryKey: ['portal-account-customers', customerIds.join(',')],
    queryFn: async () => {
      const map: Record<string, CustomerOption> = {};
      await Promise.all(
        customerIds.map(async (customerId) => {
          try {
            const response = await api.get(`/customers/${customerId}`);
            map[customerId] = response.data;
          } catch {
            map[customerId] = { id: customerId, naam: customerId };
          }
        }),
      );
      return map;
    },
    enabled: customerIds.length > 0,
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

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const fromTime = createdFrom ? new Date(createdFrom).getTime() : null;
    return portalUsers.filter((user) => {
      const customer = user.customerId ? customersById[user.customerId] : null;
      const haystack = [user.username, user.email, user.customerId, customer?.naam]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (normalizedSearch && !haystack.includes(normalizedSearch)) return false;
      if (status === 'active' && user.isActive === false) return false;
      if (status === 'inactive' && user.isActive !== false) return false;
      if (fromTime && user.createdAt && new Date(user.createdAt).getTime() < fromTime) return false;
      return true;
    });
  }, [createdFrom, customersById, portalUsers, search, status]);

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
      const previous = queryClient.getQueryData<PortalUser[]>(['portal-accounts']);
      queryClient.setQueryData<PortalUser[]>(['portal-accounts'], (current = []) =>
        current.map((item) => {
          if (item._id !== user._id) return item;
          const merged = { ...item, ...data };
          if (syncPermissions) {
            merged.permissions = normalizePortalPermissionSelection(syncPermissions.next, portalPermissionOptions);
          }
          return merged;
        }),
      );
      return { previous };
    },
    onError: (error: any, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['portal-accounts'], context.previous);
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
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, marginBottom: '0.35rem' }}>
            {t('common:navigation.portalAccounts')}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t('common:portalAccounts.subtitle')}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ minHeight: 44 }}>
          {t('common:portalAccounts.newAccount')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('common:portalAccounts.searchPlaceholder')} />
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value as any)}>
            <option value="all">{t('common:states.all')}</option>
            <option value="active">{t('common:states.active')}</option>
            <option value="inactive">{t('common:states.inactive')}</option>
          </select>
          <input className="input" type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} aria-label={t('common:portalAccounts.createdFrom')} />
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>{t('common:states.loading')}</div>
      ) : (
        <div className="portal-account-list">
          {filteredUsers.map((user) => {
            const customer = user.customerId ? customersById[user.customerId] : null;
            const isActive = user.isActive !== false;
            return (
              <motion.div key={user._id} className="portal-account-card" layout>
                <div className="portal-account-main">
                  <div className="portal-account-avatar" aria-hidden="true">
                    {(customer?.naam || user.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="portal-account-identity">
                    <div className="portal-account-customer">{customer?.naam || user.customerId || '-'}</div>
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
                      <strong>{isActive ? t('common:states.active') : t('common:states.inactive')}</strong>
                    </label>
                  </div>
                  <div className="portal-account-field">
                    <span>{t('common:portalAccounts.permissions')}</span>
                    <strong>{user.permissions?.length ?? CUSTOMER_DEFAULT_PERMISSIONS.length}</strong>
                  </div>
                  <div className="portal-account-field">
                    <span>{t('common:portalAccounts.lastLogin')}</span>
                    <strong>{user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}</strong>
                  </div>
                  <div className="portal-account-field">
                    <span>{t('common:portalAccounts.createdAt')}</span>
                    <strong>{user.createdAt ? formatDate(user.createdAt) : '-'}</strong>
                  </div>
                </div>

                <div className="portal-account-actions" aria-label={t('common:portalAccounts.actions')}>
                  <button type="button" className="btn-secondary" onClick={() => openEditModal(user)}>{t('common:actions.edit')}</button>
                  <button type="button" className="btn-secondary" onClick={() => setResetTarget(user)}>{t('common:portalAccounts.resetPassword')}</button>
                  <button type="button" className="btn-secondary" onClick={() => user.customerId && navigate(`/customers/${user.customerId}`)} disabled={!user.customerId}>{t('common:portalAccounts.goToCustomer')}</button>
                  <button type="button" className="btn-danger" onClick={() => setDeleteTarget(user)}>{t('common:portalAccounts.deleteAccount')}</button>
                </div>
              </motion.div>
            );
          })}
          {filteredUsers.length === 0 && (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {t('common:states.empty')}
            </div>
          )}
        </div>
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
                {editForm.customerId && customersById[editForm.customerId] && (
                  <option value={editForm.customerId}>{customersById[editForm.customerId].naam}</option>
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
