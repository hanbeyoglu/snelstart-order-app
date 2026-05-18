import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ConnectionSettingsService,
  TOKEN_REFRESH_THRESHOLD_MS,
} from './connection-settings.service';
import { EncryptionService } from './encryption.service';

function createHarness(options?: {
  tokenExpiresAt?: Date | null;
  hasToken?: boolean;
  integrationKey?: string;
  getTokenDelayMs?: number;
  getTokenFails?: boolean;
}) {
  const hasToken = options?.hasToken !== false;
  const integrationKey = options?.integrationKey ?? 'test-integration-key';
  let storedExpiresAt = options?.tokenExpiresAt;
  let storedAccessToken = hasToken ? 'enc:stored-token' : undefined;
  let getTokenCallCount = 0;

  const settingsDoc: any = {
    isActive: true,
    subscriptionKey: 'enc-sub',
    integrationKey: 'enc-int',
    get accessToken() {
      return storedAccessToken;
    },
    set accessToken(value: string | undefined) {
      storedAccessToken = value;
    },
    get tokenExpiresAt() {
      return storedExpiresAt;
    },
    set tokenExpiresAt(value: Date | undefined) {
      storedExpiresAt = value ?? undefined;
    },
    save: async () => settingsDoc,
    toObject: () => ({
      subscriptionKey: 'enc-sub',
      integrationKey: 'enc-int',
      accessToken: storedAccessToken,
      tokenExpiresAt: storedExpiresAt,
      isActive: true,
    }),
  };

  const connectionSettingsModel: any = {
    findOne: () => ({
      exec: async () => (hasToken || storedAccessToken ? settingsDoc : null),
    }),
    updateMany: () => ({ exec: async () => ({}) }),
  };

  const encryptionService = {
    encrypt: (value: string) => `enc:${value}`,
    decrypt: (value: string) => value.replace(/^enc:/, ''),
  } as unknown as EncryptionService;

  const configService = {
    get: () => undefined,
  };

  const snelStartClient = {
    getToken: async (_integrationKey: string) => {
      getTokenCallCount += 1;
      if (options?.getTokenDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.getTokenDelayMs));
      }
      if (options?.getTokenFails) {
        throw new Error('token endpoint failed');
      }
      return { access_token: 'fresh-token', expires_in: 3600 };
    },
  };

  const service = new ConnectionSettingsService(
    connectionSettingsModel,
    encryptionService,
    configService as any,
    snelStartClient as any,
  );

  Object.defineProperty(service, 'getActiveSettings', {
    value: async () => ({
      subscriptionKey: 'sub-key',
      integrationKey,
      isActive: true,
    }),
  });

  return {
    service,
    getGetTokenCallCount: () => getTokenCallCount,
    getStoredExpiresAt: () => storedExpiresAt,
    settingsDoc,
  };
}

test('getValidAccessToken returns existing token when not near expiry', async () => {
  const futureExpiry = new Date(Date.now() + TOKEN_REFRESH_THRESHOLD_MS + 60_000);
  const { service, getGetTokenCallCount } = createHarness({ tokenExpiresAt: futureExpiry });

  const token = await service.getValidAccessToken();

  assert.equal(token, 'stored-token');
  assert.equal(getGetTokenCallCount(), 0);
});

test('getValidAccessToken refreshes when expiring within threshold', async () => {
  const soonExpiry = new Date(Date.now() + TOKEN_REFRESH_THRESHOLD_MS - 30_000);
  const { service, getGetTokenCallCount } = createHarness({ tokenExpiresAt: soonExpiry });

  const token = await service.getValidAccessToken();

  assert.equal(token, 'fresh-token');
  assert.equal(getGetTokenCallCount(), 1);
});

test('getValidAccessToken refreshes when token is expired', async () => {
  const pastExpiry = new Date(Date.now() - 60_000);
  const { service, getGetTokenCallCount } = createHarness({ tokenExpiresAt: pastExpiry });

  const token = await service.getValidAccessToken();

  assert.equal(token, 'fresh-token');
  assert.equal(getGetTokenCallCount(), 1);
});

test('concurrent getValidAccessToken calls trigger only one refresh', async () => {
  const pastExpiry = new Date(Date.now() - 60_000);
  const { service, getGetTokenCallCount } = createHarness({
    tokenExpiresAt: pastExpiry,
    getTokenDelayMs: 50,
  });

  const [a, b, c] = await Promise.all([
    service.getValidAccessToken(),
    service.getValidAccessToken(),
    service.getValidAccessToken(),
  ]);

  assert.equal(a, 'fresh-token');
  assert.equal(b, 'fresh-token');
  assert.equal(c, 'fresh-token');
  assert.equal(getGetTokenCallCount(), 1);
});

test('refreshAccessToken returns failure without throwing when SnelStart fails', async () => {
  const pastExpiry = new Date(Date.now() - 60_000);
  const { service } = createHarness({
    tokenExpiresAt: pastExpiry,
    getTokenFails: true,
  });

  const result = await service.refreshAccessToken();

  assert.equal(result.success, false);
  assert.equal(result.error, 'Token refresh failed');
});

test('isTokenValid is true after successful refresh via getValidAccessToken', async () => {
  const pastExpiry = new Date(Date.now() - 60_000);
  const { service } = createHarness({ tokenExpiresAt: pastExpiry });

  const valid = await service.isTokenValid();

  assert.equal(valid, true);
});
