import { Injectable, Logger } from '@nestjs/common';
import { MailSettingsService } from '../mail-settings/mail-settings.service';
import {
  buildOrderNotificationHtml,
  buildOrderNotificationSubject,
  buildOrderNotificationText,
} from '@snelstart-order-app/shared';

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  constructor(private mailSettingsService: MailSettingsService) {}

  async sendOrderCreatedNotification(order: any, user?: any, customer?: any): Promise<boolean> {
    const settings = await this.mailSettingsService.getActiveSettings();

    if (!settings || settings.orderNotificationToEmails.length === 0) {
      return false;
    }

    const locale = settings.orderNotificationLocale;
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

    try {
      await this.mailSettingsService.sendMail(settings, {
        to: settings.orderNotificationToEmails,
        cc: settings.orderNotificationCcEmails.length > 0 ? settings.orderNotificationCcEmails : undefined,
        subject: buildOrderNotificationSubject(order, customer, locale),
        text: buildOrderNotificationText(order, locale, user, customer, appUrl),
        html: buildOrderNotificationHtml(order, locale, user, customer, appUrl),
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Order notification email failed: ${error?.message || error}`);
      return false;
    }
  }
}
