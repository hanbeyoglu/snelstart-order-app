import { Job } from 'bullmq';
import mongoose from 'mongoose';
import axios from 'axios';
import { ConnectionSettings, ConnectionSettingsSchema } from '../schemas/connection-settings.schema';
import { LocalOrder, LocalOrderSchema } from '../schemas/local-order.schema';
import { EncryptionService } from '../services/encryption.service';

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

    // Get connection settings
    const SettingsModel =
      mongoose.models.ConnectionSettings ||
      mongoose.model('ConnectionSettings', ConnectionSettingsSchema);
    const settings = await SettingsModel.findOne({ isActive: true }).exec();

    if (!settings) {
      throw new Error('No active SnelStart connection settings found');
    }

    // Decrypt keys
    const subscriptionKey = this.encryptionService.decrypt(settings.subscriptionKey);
    const integrationKey = this.encryptionService.decrypt(settings.integrationKey);

    // Create order in SnelStart
    const baseURL = process.env.SNELSTART_API_BASE_URL || 'https://api.snelstart.nl/v2';
    const snelStartOrder = {
      relatieId: order.customerId,
      orderdatum: order.createdAt.toISOString(),
      regels: order.items.map((item: any) => ({
        artikelId: item.productId,
        aantal: item.quantity,
        eenheidsprijs: item.unitPrice,
        btwPercentage: item.vatPercentage,
      })),
    };

    try {
      const response = await axios.post(`${baseURL}/verkooporders`, snelStartOrder, {
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Authorization': `Bearer ${integrationKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      // Update order
      order.status = 'SYNCED';
      order.snelstartOrderId = response.data.id;
      order.syncedAt = new Date();
      order.errorMessage = undefined;
      await order.save();

      return { message: 'Order synced successfully', snelstartOrderId: response.data.id };
    } catch (error: any) {
      order.retryCount = (order.retryCount || 0) + 1;
      order.errorMessage = error.response?.data?.message || error.message;

      if (order.retryCount >= 5) {
        order.status = 'FAILED';
      } else {
        order.status = 'PENDING_SYNC';
      }

      await order.save();

      throw error;
    }
  }
}

