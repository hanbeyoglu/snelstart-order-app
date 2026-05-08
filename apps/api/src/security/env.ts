const INSECURE_JWT_SECRETS = new Set([
  '',
  'your-secret-key-change-in-production',
  'change-me',
  'secret',
]);

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || '';
  const isProduction = process.env.NODE_ENV === 'production';

  if (INSECURE_JWT_SECRETS.has(secret) || secret.length < 32) {
    if (isProduction) {
      throw new Error('JWT_SECRET must be set to a strong value in production');
    }

    if (process.env.NODE_ENV !== 'test') {
      console.warn('JWT_SECRET is missing or weak; using development-only fallback');
    }

    return 'development-only-jwt-secret-change-before-production';
  }

  return secret;
}

export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  getJwtSecret();

  const encryptionKey = process.env.ENCRYPTION_MASTER_KEY?.trim() || '';
  if (
    encryptionKey.length < 32 ||
    encryptionKey === 'your-master-key-change-in-production'
  ) {
    throw new Error('ENCRYPTION_MASTER_KEY must be set to a strong value in production');
  }
}
