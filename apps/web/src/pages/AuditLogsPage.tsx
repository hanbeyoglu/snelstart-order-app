import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';
import Pagination from '../components/Pagination';

type AuditStatus = 'success' | 'failed';

interface AuditActor {
  id?: string;
  username?: string;
  email?: string;
  role?: string;
  displayName?: string;
}

interface AuditLog {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  actor?: AuditActor | null;
  critical?: boolean;
  status?: AuditStatus;
  description?: string;
}

interface AuditStats {
  totalToday: number;
  totalLast7Days: number;
  topActor?: AuditActor | null;
  criticalCount: number;
  failedCount?: number;
  actionDistribution: Array<{ action: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  actorDistribution: Array<{ userId?: string; count: number; actor?: AuditActor | null }>;
}

const pageSize = 20;

const actionOptions = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_PERMISSIONS_UPDATED',
  'USER_DELETED',
  'SNELSTART_SETTINGS_SAVED',
  'SNELSTART_TOKEN_REFRESHED',
  'PRODUCT_VISIBILITY_UPDATED',
  'CATEGORY_VISIBILITY_UPDATED',
  'PRICE_RULE_CREATED',
  'PRICE_RULE_UPDATED',
  'PRICE_RULE_DELETED',
  'ORDER_SYNC_FAILED',
];

const resourceOptions = ['User', 'ConnectionSettings', 'Product', 'Category', 'PriceOverrideRule', 'LocalOrder'];
const redactedText = '[REDACTED]';

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function maskSensitive(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(maskSensitive);
  return Object.entries(value as Record<string, unknown>).reduce((acc, [key, child]) => {
    acc[key] = /password|secret|token|key|authorization|credential/i.test(key) ? redactedText : maskSensitive(child);
    return acc;
  }, {} as Record<string, unknown>);
}

function JsonBlock({ value }: { value?: Record<string, unknown> }) {
  if (!value || Object.keys(value).length === 0) {
    return <div style={styles.mutedBox}>-</div>;
  }

  return <pre style={styles.jsonBlock}>{JSON.stringify(maskSensitive(value), null, 2)}</pre>;
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} style={styles.skeletonRow}>
          <span style={{ ...styles.skeleton, width: '18%' }} />
          <span style={{ ...styles.skeleton, width: '35%' }} />
          <span style={{ ...styles.skeleton, width: '12%' }} />
        </div>
      ))}
    </div>
  );
}

export default function AuditLogsPage() {
  const { t, i18n } = useAppTranslation(['common']);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    entityType: '',
    critical: '',
    status: '',
    search: '',
  });

  const params = useMemo(
    () => ({
      page,
      limit: pageSize,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    }),
    [filters, page],
  );

  const logsQuery = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const response = await api.get('/audit', { params });
      return response.data as { data: AuditLog[]; pagination: { total: number; totalPages: number; page: number } };
    },
  });

  const statsQuery = useQuery({
    queryKey: ['audit-stats', filters.startDate, filters.endDate],
    queryFn: async () => {
      const response = await api.get('/audit/stats', {
        params: {
          ...(filters.startDate ? { startDate: filters.startDate } : {}),
          ...(filters.endDate ? { endDate: filters.endDate } : {}),
        },
      });
      return response.data as AuditStats;
    },
  });

  const logs = logsQuery.data?.data || [];
  const pagination = logsQuery.data?.pagination;
  const stats = statsQuery.data;
  const maxDaily = Math.max(1, ...(stats?.dailyTrend || []).map((item) => item.count));
  const maxAction = Math.max(1, ...(stats?.actionDistribution || []).map((item) => item.count));
  const maxActor = Math.max(1, ...(stats?.actorDistribution || []).map((item) => item.count));

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({ startDate: '', endDate: '', userId: '', action: '', entityType: '', critical: '', status: '', search: '' });
  };

  return (
    <div className="container" style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>{t('audit.breadcrumb', 'Settings > Audit Logs')}</div>
          <h2 style={styles.title}>{t('audit.title', 'Audit Logs')}</h2>
          <p style={styles.subtitle}>
            {t('audit.subtitle', 'Super admin denetimi için filtrelenebilir, okunabilir ve güvenli işlem geçmişi.')}
          </p>
        </div>
        <div style={styles.guardBadge}>{t('audit.superAdminOnly', 'Super admin only')}</div>
      </div>

      <section style={styles.summaryGrid}>
        <SummaryCard label={t('audit.totalToday', 'Bugünkü işlem')} value={stats?.totalToday} tone="blue" loading={statsQuery.isLoading} />
        <SummaryCard label={t('audit.totalLast7Days', 'Son 7 gün')} value={stats?.totalLast7Days} tone="green" loading={statsQuery.isLoading} />
        <SummaryCard label={t('audit.topActor', 'En aktif kullanıcı')} value={stats?.topActor?.displayName || '-'} tone="neutral" loading={statsQuery.isLoading} />
        <SummaryCard label={t('audit.criticalCount', 'Kritik işlem')} value={stats?.criticalCount} tone="red" loading={statsQuery.isLoading} />
        <SummaryCard label={t('audit.failedCount', 'Başarısız/engellenen')} value={stats?.failedCount || 0} tone="amber" loading={statsQuery.isLoading} />
      </section>

      <section className="card" style={styles.filtersCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{t('audit.filters', 'Filtreler')}</h3>
          <button type="button" className="btn-secondary" style={styles.compactButton} onClick={clearFilters}>
            {t('audit.clearFilters', 'Temizle')}
          </button>
        </div>
        <div style={styles.filterGrid}>
          <Field label={t('audit.startDate', 'Başlangıç')}>
            <input type="date" value={filters.startDate} onChange={(event) => updateFilter('startDate', event.target.value)} />
          </Field>
          <Field label={t('audit.endDate', 'Bitiş')}>
            <input type="date" value={filters.endDate} onChange={(event) => updateFilter('endDate', event.target.value)} />
          </Field>
          <Field label={t('audit.user', 'Kullanıcı')}>
            <input value={filters.userId} onChange={(event) => updateFilter('userId', event.target.value)} placeholder={t('audit.userPlaceholder', 'User ID')} />
          </Field>
          <Field label={t('audit.actionType', 'İşlem türü')}>
            <select value={filters.action} onChange={(event) => updateFilter('action', event.target.value)}>
              <option value="">{t('audit.allActions', 'Tüm işlemler')}</option>
              {actionOptions.map((action) => <option key={action} value={action}>{formatAction(action)}</option>)}
            </select>
          </Field>
          <Field label={t('audit.resourceType', 'Kaynak türü')}>
            <select value={filters.entityType} onChange={(event) => updateFilter('entityType', event.target.value)}>
              <option value="">{t('audit.allResources', 'Tüm kaynaklar')}</option>
              {resourceOptions.map((resource) => <option key={resource} value={resource}>{resource}</option>)}
            </select>
          </Field>
          <Field label={t('audit.criticalFilter', 'Kritik işlem')}>
            <select value={filters.critical} onChange={(event) => updateFilter('critical', event.target.value)}>
              <option value="">{t('audit.all', 'Tümü')}</option>
              <option value="true">{t('audit.criticalOnly', 'Sadece kritik')}</option>
              <option value="false">{t('audit.nonCriticalOnly', 'Kritik olmayan')}</option>
            </select>
          </Field>
          <Field label={t('audit.resultStatus', 'Sonuç')}>
            <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="">{t('audit.allStatuses', 'Tüm durumlar')}</option>
              <option value="success">{t('audit.success', 'Başarılı')}</option>
              <option value="failed">{t('audit.failed', 'Başarısız/engellendi')}</option>
            </select>
          </Field>
          <Field label={t('audit.search', 'Arama')}>
            <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder={t('audit.searchPlaceholder', 'İşlem, kaynak, IP ara')} />
          </Field>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <ChartCard title={t('audit.dailyTrend', 'Günlere göre işlem sayısı')}>
          {(stats?.dailyTrend || []).map((item) => (
            <Bar key={item.date} label={new Date(item.date).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' })} value={item.count} max={maxDaily} />
          ))}
        </ChartCard>
        <ChartCard title={t('audit.actionDistribution', 'İşlem türlerine göre dağılım')}>
          {(stats?.actionDistribution || []).slice(0, 6).map((item) => (
            <Bar key={item.action} label={formatAction(item.action)} value={item.count} max={maxAction} />
          ))}
        </ChartCard>
        <ChartCard title={t('audit.actorDensity', 'Kullanıcı bazlı işlem yoğunluğu')}>
          {(stats?.actorDistribution || []).slice(0, 6).map((item) => (
            <Bar key={item.userId || item.actor?.displayName || 'system'} label={item.actor?.displayName || t('audit.system', 'Sistem')} value={item.count} max={maxActor} />
          ))}
        </ChartCard>
      </section>

      <section className="card" style={styles.listCard}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{t('audit.logList', 'Log listesi')}</h3>
          <span style={styles.countText}>{pagination?.total || 0} {t('audit.records', 'kayıt')}</span>
        </div>

        {logsQuery.isLoading ? (
          <Skeleton />
        ) : logsQuery.isError ? (
          <div style={styles.stateBox}>
            <strong>{t('audit.errorTitle', 'Audit loglar yüklenemedi')}</strong>
            <span>{t('audit.errorText', 'Bağlantıyı veya yetkileri kontrol edip tekrar deneyin.')}</span>
          </div>
        ) : logs.length === 0 ? (
          <div style={styles.stateBox}>
            <strong>{t('audit.emptyTitle', 'Kayıt bulunamadı')}</strong>
            <span>{t('audit.emptyText', 'Seçili filtrelerle eşleşen denetim kaydı yok.')}</span>
          </div>
        ) : (
          <div style={styles.logStack}>
            {logs.map((log, index) => (
              <motion.article
                key={log._id}
                className="audit-log-row"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.015 }}
                style={styles.logRow}
              >
                <div style={styles.timeBlock}>
                  <strong>{log.createdAt ? new Date(log.createdAt).toLocaleDateString(i18n.language) : '-'}</strong>
                  <span>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                </div>
                <div style={styles.logMain}>
                  <div style={styles.logTopLine}>
                    <strong>{log.actor?.displayName || t('audit.system', 'Sistem')}</strong>
                    {log.critical && <span style={styles.criticalPill}>{t('audit.critical', 'Kritik')}</span>}
                    <span style={log.status === 'failed' ? styles.failedPill : styles.successPill}>
                      {log.status === 'failed' ? t('audit.failed', 'Başarısız') : t('audit.success', 'Başarılı')}
                    </span>
                  </div>
                  <p style={styles.description}>{log.description || formatAction(log.action)}</p>
                  <div style={styles.metaLine}>
                    <span>{t('audit.resource', 'Kaynak')}: {log.entityType} / {log.entityId}</span>
                    <span>IP: {log.ip || '-'}</span>
                  </div>
                </div>
                <button type="button" className="btn-secondary" style={styles.detailButton} onClick={() => setSelectedLog(log)}>
                  {t('audit.details', 'Detay')}
                </button>
              </motion.article>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={Math.max(1, pagination?.totalPages || 1)} onPageChange={setPage} />
      </section>

      {selectedLog && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true">
          <div style={styles.modal}>
            <div style={styles.sectionHeader}>
              <div>
                <h3 style={styles.sectionTitle}>{t('audit.detailTitle', 'Audit log detayı')}</h3>
                <p style={styles.subtitle}>{selectedLog.description || formatAction(selectedLog.action)}</p>
              </div>
              <button type="button" className="close-x-button" style={styles.closeButton} onClick={() => setSelectedLog(null)} aria-label={t('audit.close', 'Kapat')} />
            </div>
            <div style={styles.detailGrid}>
              <Detail label={t('audit.actor', 'Actor')} value={selectedLog.actor?.displayName || '-'} />
              <Detail label="Action" value={selectedLog.action} />
              <Detail label="Resource type" value={selectedLog.entityType} />
              <Detail label="Resource ID" value={selectedLog.entityId} />
              <Detail label="IP" value={selectedLog.ip || '-'} />
              <Detail label="User agent" value={selectedLog.userAgent || '-'} />
            </div>
            <div style={styles.modalColumns}>
              <div>
                <h4 style={styles.smallTitle}>{t('audit.oldValue', 'Eski değer')}</h4>
                <JsonBlock value={(selectedLog.changes?.before as Record<string, unknown>) || selectedLog.changes} />
              </div>
              <div>
                <h4 style={styles.smallTitle}>{t('audit.newValue', 'Yeni değer')}</h4>
                <JsonBlock value={(selectedLog.changes?.after as Record<string, unknown>) || selectedLog.metadata} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone, loading }: { label: string; value?: string | number; tone: 'blue' | 'green' | 'neutral' | 'red' | 'amber'; loading: boolean }) {
  return (
    <div style={{ ...styles.summaryCard, borderTopColor: toneColors[tone] }}>
      <span style={styles.summaryLabel}>{label}</span>
      {loading ? <span style={{ ...styles.skeleton, width: '55%', height: '1.7rem' }} /> : <strong style={styles.summaryValue}>{value ?? 0}</strong>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ margin: 0 }}>
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={styles.chartCard}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.chartStack}>{children || <div style={styles.mutedBox}>-</div>}</div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div style={styles.barRow}>
      <span style={styles.barLabel}>{label}</span>
      <div style={styles.barTrack}><span style={{ ...styles.barFill, width: `${Math.max(6, (value / max) * 100)}%` }} /></div>
      <strong style={styles.barValue}>{value}</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.detailItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const toneColors = {
  blue: '#2563eb',
  green: '#059669',
  neutral: '#475569',
  red: '#dc2626',
  amber: '#d97706',
};

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: '1320px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap' },
  breadcrumb: { color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' },
  title: { margin: 0, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: 0 },
  subtitle: { color: 'var(--text-secondary)', marginTop: '0.35rem', marginBottom: 0 },
  guardBadge: { border: '1px solid rgba(37, 99, 235, 0.22)', background: '#eff6ff', color: '#1d4ed8', borderRadius: '8px', padding: '0.55rem 0.8rem', fontWeight: 700, fontSize: '0.85rem' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem', marginBottom: '1rem' },
  summaryCard: { background: '#fff', border: '1px solid rgba(226, 232, 240, 0.9)', borderTop: '4px solid', borderRadius: '8px', padding: '1rem', boxShadow: 'var(--shadow-sm)', minHeight: '104px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  summaryLabel: { color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 700 },
  summaryValue: { fontSize: '1.65rem', lineHeight: 1.1, wordBreak: 'break-word' },
  filtersCard: { borderRadius: '8px', marginBottom: '1rem' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' },
  sectionTitle: { margin: 0, fontSize: '1.05rem', letterSpacing: 0 },
  filterGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' },
  fieldLabel: { display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 800 },
  compactButton: { padding: '0.6rem 0.9rem', borderRadius: '8px', fontSize: '0.9rem' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  chartCard: { borderRadius: '8px', marginBottom: 0 },
  chartStack: { display: 'grid', gap: '0.75rem', marginTop: '1rem' },
  barRow: { display: 'grid', gridTemplateColumns: 'minmax(96px, 1fr) 2fr auto', alignItems: 'center', gap: '0.65rem' },
  barLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.82rem' },
  barTrack: { height: '0.55rem', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' },
  barFill: { display: 'block', height: '100%', background: '#2563eb', borderRadius: '999px' },
  barValue: { fontSize: '0.85rem' },
  listCard: { borderRadius: '8px' },
  countText: { color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700 },
  logStack: { display: 'grid', gap: '0.75rem' },
  logRow: { display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr) auto', gap: '1rem', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.9rem', background: '#fff' },
  timeBlock: { display: 'grid', gap: '0.2rem', color: 'var(--text-secondary)', fontSize: '0.86rem' },
  logMain: { minWidth: 0 },
  logTopLine: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  description: { margin: '0.25rem 0', fontWeight: 700 },
  metaLine: { display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '0.84rem' },
  criticalPill: { background: '#fee2e2', color: '#991b1b', borderRadius: '999px', padding: '0.16rem 0.55rem', fontSize: '0.75rem', fontWeight: 800 },
  successPill: { background: '#dcfce7', color: '#166534', borderRadius: '999px', padding: '0.16rem 0.55rem', fontSize: '0.75rem', fontWeight: 800 },
  failedPill: { background: '#fef3c7', color: '#92400e', borderRadius: '999px', padding: '0.16rem 0.55rem', fontSize: '0.75rem', fontWeight: 800 },
  detailButton: { padding: '0.58rem 0.85rem', borderRadius: '8px', fontSize: '0.9rem', whiteSpace: 'nowrap' },
  stateBox: { display: 'grid', gap: '0.35rem', placeItems: 'center', textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', border: '1px dashed #cbd5e1', borderRadius: '8px' },
  pagination: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' },
  pageText: { fontWeight: 800, color: 'var(--text-secondary)' },
  skeletonRow: { display: 'flex', gap: '1rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' },
  skeleton: { display: 'inline-block', height: '1rem', borderRadius: '999px', background: 'linear-gradient(90deg, #e2e8f0 0%, #f8fafc 50%, #e2e8f0 100%)', backgroundSize: '220% 100%', animation: 'shimmer 1.4s infinite' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.56)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: '1rem' },
  modal: { width: 'min(960px, 100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: '8px', padding: '1.25rem', boxShadow: 'var(--shadow-xl)' },
  closeButton: { width: '38px', height: '38px', color: '#334155' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' },
  detailItem: { display: 'grid', gap: '0.2rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', color: 'var(--text-secondary)' },
  modalColumns: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' },
  smallTitle: { margin: '0 0 0.5rem', fontSize: '0.95rem' },
  jsonBlock: { margin: 0, padding: '0.85rem', background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', overflow: 'auto', fontSize: '0.8rem', maxHeight: '320px' },
  mutedBox: { padding: '0.85rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', color: 'var(--text-secondary)' },
};
