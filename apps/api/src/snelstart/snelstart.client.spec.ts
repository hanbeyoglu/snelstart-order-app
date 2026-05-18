import test from 'node:test';
import assert from 'node:assert/strict';
import { SnelStartClient, SNELSTART_AUTH_ERROR_MESSAGE } from './snelstart.client';

function create401Error() {
  const error: any = new Error('Unauthorized');
  error.response = { status: 401 };
  return error;
}

function createClientHarness(options?: {
  refreshSuccess?: boolean;
  failRefresh?: boolean;
}) {
  let refreshCallCount = 0;
  let markInvalidCallCount = 0;
  let requestAttempt = 0;

  const connectionSettingsService = {
    getActiveSettings: async () => ({
      subscriptionKey: 'sub',
      integrationKey: 'int',
    }),
    getValidAccessToken: async () => 'token',
    refreshAccessToken: async () => {
      refreshCallCount += 1;
      if (options?.failRefresh) {
        return { success: false, error: 'Token refresh failed' };
      }
      return {
        success: options?.refreshSuccess !== false,
        accessToken: 'fresh-token',
      };
    },
    markConnectionInvalid: async () => {
      markInvalidCallCount += 1;
    },
  };

  const client = new SnelStartClient(connectionSettingsService as any);
  (client as any).mockMode = false;
  (client as any).limiter = {
    schedule: async (fn: () => Promise<unknown>) => fn(),
  };

  const runRequest = (outcomes: Array<'success' | '401'>) =>
    (client as any).requestWithRetry(async () => {
      const outcome = outcomes[requestAttempt] ?? outcomes[outcomes.length - 1];
      requestAttempt += 1;
      if (outcome === '401') {
        throw create401Error();
      }
      return { ok: true };
    });

  return {
    client,
    runRequest,
    getRefreshCallCount: () => refreshCallCount,
    getMarkInvalidCallCount: () => markInvalidCallCount,
    getRequestAttempt: () => requestAttempt,
    resetAttempts: () => {
      requestAttempt = 0;
    },
  };
}

test('401 during request triggers refresh and retries once successfully', async () => {
  const harness = createClientHarness();

  const result = await harness.runRequest(['401', 'success']);

  assert.deepEqual(result, { ok: true });
  assert.equal(harness.getRefreshCallCount(), 1);
  assert.equal(harness.getRequestAttempt(), 2);
  assert.equal(harness.getMarkInvalidCallCount(), 0);
});

test('401 retry after successful refresh does not loop infinitely', async () => {
  const harness = createClientHarness();

  await assert.rejects(
    () => harness.runRequest(['401', '401']),
    (error: Error) => error.message === SNELSTART_AUTH_ERROR_MESSAGE,
  );

  assert.equal(harness.getRefreshCallCount(), 1);
  assert.equal(harness.getRequestAttempt(), 2);
  assert.equal(harness.getMarkInvalidCallCount(), 1);
});

test('401 with failed refresh marks connection invalid and throws auth error', async () => {
  const harness = createClientHarness({ failRefresh: true });

  await assert.rejects(
    () => harness.runRequest(['401']),
    (error: Error) => error.message === SNELSTART_AUTH_ERROR_MESSAGE,
  );

  assert.equal(harness.getRefreshCallCount(), 1);
  assert.equal(harness.getRequestAttempt(), 1);
  assert.equal(harness.getMarkInvalidCallCount(), 1);
});

test('concurrent 401 responses share a single refresh call', async () => {
  let refreshCallCount = 0;
  let refreshResolve: (() => void) | null = null;
  const refreshGate = new Promise<void>((resolve) => {
    refreshResolve = resolve;
  });
  let sharedRefresh: Promise<{ success: boolean; accessToken: string }> | null = null;

  const connectionSettingsService = {
    getActiveSettings: async () => ({ subscriptionKey: 'sub', integrationKey: 'int' }),
    getValidAccessToken: async () => 'token',
    refreshAccessToken: async () => {
      if (!sharedRefresh) {
        sharedRefresh = (async () => {
          refreshCallCount += 1;
          await refreshGate;
          return { success: true, accessToken: 'fresh-token' };
        })().finally(() => {
          sharedRefresh = null;
        });
      }
      return sharedRefresh;
    },
    markConnectionInvalid: async () => {},
  };

  const client = new SnelStartClient(connectionSettingsService as any);
  (client as any).mockMode = false;
  (client as any).limiter = { schedule: async (fn: () => Promise<unknown>) => fn() };

  let attempts = 0;
  const makeRequest = () =>
    (client as any).requestWithRetry(async () => {
      attempts += 1;
      if (attempts <= 2) {
        throw create401Error();
      }
      return { ok: true };
    });

  const p1 = makeRequest();
  const p2 = makeRequest();
  await new Promise((r) => setTimeout(r, 10));
  refreshResolve?.();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.deepEqual(r1, { ok: true });
  assert.deepEqual(r2, { ok: true });
  assert.equal(refreshCallCount, 1);
});
