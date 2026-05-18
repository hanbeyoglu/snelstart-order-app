export const SNELSTART_DEFAULT_BASE_URL = 'https://b2bapi.snelstart.nl';
export const SNELSTART_DEFAULT_AUTH_URL = 'https://auth.snelstart.nl/b2b/token';

export interface SnelStartCredentials {
  subscriptionKey: string;
  clientKey: string;
}

export interface SnelStartUrls {
  baseUrl: string;
  authUrl: string;
}

export interface SnelStartTokenResponse {
  access_token: string;
  expires_in: number;
}

export function resolveSnelStartUrls(): SnelStartUrls {
  return {
    baseUrl: (process.env.SNELSTART_API_BASE_URL || SNELSTART_DEFAULT_BASE_URL).replace(/\/$/, ''),
    authUrl: process.env.SNELSTART_API_AUTH_URL || SNELSTART_DEFAULT_AUTH_URL,
  };
}

/** Env-only credentials (SNELSTART_API_SUB_KEY + SNELSTART_CLIENTKEY). */
export function resolveSnelStartCredentialsFromEnv(): SnelStartCredentials | null {
  const subscriptionKey = process.env.SNELSTART_API_SUB_KEY?.trim();
  const clientKey = process.env.SNELSTART_CLIENTKEY?.trim();
  if (!subscriptionKey || !clientKey) {
    return null;
  }
  return { subscriptionKey, clientKey };
}

export function assertSnelStartCredentials(credentials: SnelStartCredentials): void {
  if (!credentials.subscriptionKey?.trim()) {
    throw new Error('SNELSTART_API_SUB_KEY is required');
  }
  if (!credentials.clientKey?.trim()) {
    throw new Error('SNELSTART_CLIENTKEY is required');
  }
}

/**
 * OAuth token exchange — clientkey must be the integration/client key, never the subscription key.
 */
export async function fetchSnelStartAccessToken(
  clientKey: string,
  authUrl?: string,
): Promise<SnelStartTokenResponse> {
  const url = authUrl || resolveSnelStartUrls().authUrl;
  const params = new URLSearchParams();
  params.append('grant_type', 'clientkey');
  params.append('clientkey', clientKey);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const rawText = await response.text();
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    const detail =
      (typeof data.error_description === 'string' && data.error_description) ||
      (typeof data.error === 'string' && data.error) ||
      (typeof data.message === 'string' && data.message) ||
      rawText ||
      response.statusText;
    throw new Error(`SnelStart token exchange failed (${response.status}): ${sanitizeSyncErrorMessage(detail)}`);
  }

  const access_token = typeof data.access_token === 'string' ? data.access_token : '';
  if (!access_token) {
    throw new Error('SnelStart OAuth token exchange returned no access_token');
  }

  const expires_in =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in) ? data.expires_in : 3600;

  return { access_token, expires_in };
}

/** API request headers — must match SnelStartClient interceptor / testConnection. */
export function buildSnelStartApiHeaders(
  subscriptionKey: string,
  accessToken: string,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export function buildSnelStartRequestDebugInfo(options: {
  baseUrl: string;
  authUrl: string;
  hasClientKey: boolean;
  hasSubKey: boolean;
  subKeyLast4?: string;
  hasAccessToken: boolean;
  headers: Record<string, string>;
}): Record<string, unknown> {
  return {
    baseUrl: options.baseUrl,
    authUrl: options.authUrl,
    hasClientKey: options.hasClientKey,
    hasSubKey: options.hasSubKey,
    subKeyLast4: options.subKeyLast4,
    hasAccessToken: options.hasAccessToken,
    headerNames: Object.keys(options.headers),
  };
}

export function sanitizeSyncErrorMessage(error: unknown): string {
  let message = '';

  if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    const err = error as {
      message?: string;
      response?: { data?: unknown; status?: number };
    };
    const data = err.response?.data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      message =
        (typeof record.message === 'string' && record.message) ||
        (typeof record.error_description === 'string' && record.error_description) ||
        (typeof record.error === 'string' && record.error) ||
        '';
    } else if (typeof data === 'string') {
      message = data;
    }
    if (!message) {
      message = err.message || '';
    }
    if (!message && err.response?.status) {
      message = `HTTP ${err.response.status}`;
    }
  } else if (error != null) {
    message = String(error);
  }

  message = message.trim();
  message = message.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted]');
  message = message.replace(/clientkey[=:]\s*\S+/gi, 'clientkey=[redacted]');
  message = message.replace(/Ocp-Apim-Subscription-Key[=:]\s*\S+/gi, 'Ocp-Apim-Subscription-Key=[redacted]');

  if (message.length > 500) {
    message = `${message.slice(0, 497)}...`;
  }

  return message || 'SnelStart sync failed';
}

export async function createSnelStartVerkooporder(
  payload: unknown,
  options: {
    baseUrl: string;
    headers: Record<string, string>;
    onBeforeRequest?: (debug: Record<string, unknown>) => void;
  },
): Promise<{ id: string; data: unknown }> {
  const url = `${options.baseUrl.replace(/\/$/, '')}/v2/verkooporders`;

  if (options.onBeforeRequest) {
    const subKey = options.headers['Ocp-Apim-Subscription-Key'] || '';
    options.onBeforeRequest(
      buildSnelStartRequestDebugInfo({
        baseUrl: options.baseUrl,
        authUrl: resolveSnelStartUrls().authUrl,
        hasClientKey: true,
        hasSubKey: Boolean(subKey),
        subKeyLast4: subKey.length >= 4 ? subKey.slice(-4) : undefined,
        hasAccessToken: Boolean(options.headers.Authorization?.startsWith('Bearer ')),
        headers: options.headers,
      }),
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: options.headers,
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    const err: Error & { response?: { status: number; data: unknown } } = new Error(
      sanitizeSyncErrorMessage(data ?? rawText),
    );
    err.response = { status: response.status, data };
    throw err;
  }

  const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) {
    throw new Error('SnelStart verkooporder response missing id');
  }

  return { id, data };
}
