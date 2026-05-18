import { Injectable, Logger } from '@nestjs/common';
import {
  buildCustomerOrderConfirmationHtml,
  buildCustomerOrderConfirmationSubject,
  buildCustomerOrderConfirmationText,
  resolveCustomerEmails,
  resolveOrderEmailLocaleFromOrder,
} from '@snelstart-order-app/shared';
import { MailSettingsService } from '../mail-settings/mail-settings.service';

@Injectable()
export class CustomerOrderConfirmationService {
  private readonly logger = new Logger(CustomerOrderConfirmationService.name);

  constructor(private mailSettingsService: MailSettingsService) {}

  async send(order: any, customer: any): Promise<void> {
    const to = resolveCustomerEmails(customer);
    if (to.length === 0) {
      throw new Error('No valid customer email addresses');
    }

    const settings = await this.mailSettingsService.getActiveSettings();
    if (!settings?.smtpHost) {
      throw new Error('Mail settings not configured');
    }

    const locale = resolveOrderEmailLocaleFromOrder(order, {
      settingsLocale: settings.orderNotificationLocale,
      envLocale: process.env.ORDER_NOTIFICATION_LOCALE,
    });
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

    await this.mailSettingsService.sendMail(settings, {
      to,
      subject: buildCustomerOrderConfirmationSubject(order, locale),
      text: buildCustomerOrderConfirmationText(order, locale, customer),
      html: buildCustomerOrderConfirmationHtml(order, locale, customer, appUrl),
    });
  }

  async trySend(order: any, customer: any): Promise<boolean> {
    try {
      await this.send(order, customer);
      return true;
    } catch (error: any) {
      this.logger.error(`Customer confirmation email failed: ${error?.message || error}`);
      throw error;
    }
  }
}
