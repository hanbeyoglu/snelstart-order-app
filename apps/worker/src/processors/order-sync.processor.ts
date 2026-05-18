import { Job } from 'bullmq';
import mongoose from 'mongoose';
import {
  buildSnelStartOrderOmschrijving,
  buildSnelStartOrderMemo,
  buildSnelStartApiHeaders,
  createSnelStartVerkooporder,
  fetchSnelStartAccessToken,
  resolveSnelStartUrls,
  sanitizeSyncErrorMessage,
} from '@snelstart-order-app/shared';
import { ConnectionSettings, ConnectionSettingsSchema } from '../schemas/connection-settings.schema';
import { LocalOrder, LocalOrderSchema } from '../schemas/local-order.schema';
import { EncryptionService } from '../services/encryption.service';
import { handleOrderSyncFinalFailure, handleOrderSyncSuccess } from '../services/order-post-sync';

const MAX_SYNC_ATTEMPTS = 5;

function buildSnelStartPayload(order: any) {
  const createdAt: Date = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt || Date.now());
  const dateOnly = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate())
    .toISOString()
    .split('T')[0];

  const regels = (order.items || []).map((item: any) => ({
    artikel: { id: item.productId },
    aantal: item.quantity,
    stuksprijs: item.unitPrice,
  }));
  const omschrijving = buildSnelStartOrderOmschrijving(order);

  return {
    relatie: { id: order.customerId },
    datum: `${dateOnly}T00:00:00`,
    verkooporderBtwIngaveModel: 'Exclusief',
    ...(omschrijving ? { omschrijving } : {}),
    regels,
    memo: buildSnelStartOrderMemo(order),
  };
}

function resolveCredentials(
  settings: ConnectionSettings | null,
  encryptionService: EncryptionService,
): { subscriptionKey: string; clientKey: string } {
  const subscriptionKey =
    process.env.SNELSTART_API_SUB_KEY?.trim() ||
    (settings ? encryptionService.decrypt(settings.subscriptionKey) : '');
  const clientKey =
    process.env.SNELSTART_CLIENTKEY?.trim() ||
    (settings ? encryptionService.decrypt(settings.integrationKey) : '');

  if (!subscriptionKey || !clientKey) {
    throw new Error(
      'SnelStart credentials missing: set SNELSTART_API_SUB_KEY and SNELSTART_CLIENTKEY, or configure active connection settings',
    );
  }

  return { subscriptionKey, clientKey };
}

export class OrderSyncProcessor {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  async process(job: Job) {
    const { orderId } = job.data;

    const OrderModel = mongoose.models.LocalOrder || mongoose.model('LocalOrder', LocalOrderSchema);
    const order = await OrderModel.findById(orderId).exec();

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === 'SYNCED') {
      return { message: 'Order already synced', orderId };
    }

    const SettingsModel =
      mongoose.models.ConnectionSettings ||
      mongoose.model('ConnectionSettings', ConnectionSettingsSchema);
    const settings = await SettingsModel.findOne({ isActive: true }).exec();

    const { subscriptionKey, clientKey } = resolveCredentials(settings, this.encryptionService);
    const { baseUrl, authUrl } = resolveSnelStartUrls();

    const tokenResponse = await fetchSnelStartAccessToken(clientKey, authUrl);
    const accessToken = tokenResponse.access_token;
    const headers = buildSnelStartApiHeaders(subscriptionKey, accessToken);
    const payload = buildSnelStartPayload(order);

    try {
      const result = await createSnelStartVerkooporder(payload, {
        baseUrl,
        headers,
        onBeforeRequest: (debug) => {
          console.log('[order-sync] SnelStart verkooporder request', JSON.stringify(debug));
        },
      });

      order.status = 'SYNCED';
      order.snelstartOrderId = result.id;
      order.syncedAt = new Date();
      order.errorMessage = undefined;
      await order.save();

      await handleOrderSyncSuccess(order, subscriptionKey, accessToken);

      return { message: 'Order synced successfully', orderId, snelstartOrderId: result.id };
    } catch (error: unknown) {
      order.retryCount = (order.retryCount || 0) + 1;
      order.errorMessage = sanitizeSyncErrorMessage(error);

      const attemptsMade = typeof job.opts.attempts === 'number' ? job.opts.attempts : MAX_SYNC_ATTEMPTS;
      const isFinalFailure = order.retryCount >= attemptsMade || order.retryCount >= MAX_SYNC_ATTEMPTS;

      order.status = isFinalFailure ? 'SYNC_FAILED' : 'PENDING_SYNC';
      await order.save();

      if (isFinalFailure) {
        await handleOrderSyncFinalFailure(order, order.errorMessage);
      }

      throw error;
    }
  }
}
