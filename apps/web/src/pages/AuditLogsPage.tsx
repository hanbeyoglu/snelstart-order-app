import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '../services/api';

interface AuditLog {
  _id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export default function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await api.get('/audit', { params: { limit: 100 } });
      return response.data;
    },
  });

  const logs: AuditLog[] = data?.data || [];

  return (
    <div className="container">
      <h2 style={{ marginBottom: '1.5rem' }}>Audit Logs</h2>

      {isLoading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="loading" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Kayıt bulunamadı
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {logs.map((log, index) => (
            <motion.div
              key={log._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="card"
              style={{ padding: '1rem 1.25rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <strong>{log.action}</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {log.entityType} · {log.entityId}
              </p>
              {(log.changes || log.metadata) && (
                <pre
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.06)',
                    overflowX: 'auto',
                    fontSize: '0.85rem',
                  }}
                >
                  {JSON.stringify({ changes: log.changes, metadata: log.metadata }, null, 2)}
                </pre>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
