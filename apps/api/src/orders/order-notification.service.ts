import { Injectable, Logger } from '@nestjs/common';
import * as net from 'node:net';
import * as tls from 'node:tls';

@Injectable()
export class OrderNotificationService {
  private readonly logger = new Logger(OrderNotificationService.name);

  async sendCustomerOrderNotification(order: any, user?: any, customer?: any): Promise<boolean> {
    const recipients = (process.env.ORDER_NOTIFICATION_EMAILS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      return false;
    }

    try {
      await this.sendMail({
        to: recipients,
        subject: `Yeni müşteri siparişi: ${customer?.naam || order.customerId}`,
        text: this.buildText(order, user, customer),
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Order notification email failed: ${error?.message || error}`);
      return false;
    }
  }

  private buildText(order: any, user?: any, customer?: any) {
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';
    const orderLink = appUrl ? `${appUrl.replace(/\/$/, '')}/orders/${order._id}` : `/orders/${order._id}`;
    const createdBy = this.getCreatedByText(order, user, customer);
    const lines = (order.items || [])
      .map((item: any) => `- ${item.productName} (${item.sku || item.productId}) x ${item.quantity}: ${item.totalPrice ?? item.unitPrice * item.quantity}`)
      .join('\n');

    return [
      'Yeni müşteri siparişi oluşturuldu',
      '',
      `Müşteri: ${customer?.naam || order.customerId}`,
      `Kullanıcı: ${user?.username || '-'}${user?.email ? ` (${user.email})` : ''}`,
      `Oluşturan: ${createdBy}`,
      `Sipariş tarihi: ${new Date(order.createdAt || Date.now()).toISOString()}`,
      `Sipariş toplamı: ${order.total || 0}`,
      '',
      'Ürün satırları:',
      lines || '-',
      '',
      `Admin panel order linki: ${orderLink}`,
    ].join('\n');
  }

  private getCreatedByText(order: any, user?: any, customer?: any) {
    if (order?.createdByRole === 'customer') {
      return `müşteri ${order.createdByCustomerName || customer?.naam || order.createdByCustomerId || order.customerId}`;
    }

    const fullName = order?.createdByFullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return fullName || order?.createdByUsername || user?.username || '-';
  }

  private async sendMail(message: { to: string[]; subject: string; text: string }) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user || 'orders@snelstart-order-app.local';

    if (!host) {
      throw new Error('SMTP_HOST is not configured');
    }

    const socket = await this.connect(host, port);
    const read = () => this.readResponse(socket);
    const write = async (command: string) => {
      socket.write(`${command}\r\n`);
      return read();
    };

    await read();
    await write(`EHLO ${host}`);
    if (port === 587) {
      await write('STARTTLS');
      const secureSocket = tls.connect({ socket, servername: host });
      await new Promise<void>((resolve, reject) => {
        secureSocket.once('secureConnect', resolve);
        secureSocket.once('error', reject);
      });
      return this.sendMailOverSocket(secureSocket, host, from, user, pass, message);
    }

    return this.sendMailOverSocket(socket, host, from, user, pass, message);
  }

  private async sendMailOverSocket(
    socket: net.Socket | tls.TLSSocket,
    host: string,
    from: string,
    user: string | undefined,
    pass: string | undefined,
    message: { to: string[]; subject: string; text: string },
  ) {
    const read = () => this.readResponse(socket);
    const write = async (command: string) => {
      socket.write(`${command}\r\n`);
      return read();
    };

    await write(`EHLO ${host}`);
    if (user && pass) {
      await write('AUTH LOGIN');
      await write(Buffer.from(user).toString('base64'));
      await write(Buffer.from(pass).toString('base64'));
    }
    await write(`MAIL FROM:<${from}>`);
    for (const recipient of message.to) {
      await write(`RCPT TO:<${recipient}>`);
    }
    await write('DATA');
    socket.write(this.formatMessage(from, message));
    await read();
    await write('QUIT');
    socket.end();
  }

  private connect(host: string, port: number): Promise<net.Socket | tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const socket = port === 465 ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
      socket.setTimeout(10000);
      socket.once(port === 465 ? 'secureConnect' : 'connect', () => resolve(socket));
      socket.once('error', reject);
      socket.once('timeout', () => reject(new Error('SMTP connection timed out')));
    });
  }

  private readResponse(socket: net.Socket | tls.TLSSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        const code = Number(text.slice(0, 3));
        if (code >= 400) {
          reject(new Error(text.trim()));
          return;
        }
        resolve(text);
      };
      socket.once('data', onData);
      socket.once('error', reject);
    });
  }

  private formatMessage(from: string, message: { to: string[]; subject: string; text: string }) {
    return [
      `From: ${from}`,
      `To: ${message.to.join(', ')}`,
      `Subject: ${message.subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.text,
      '.',
      '',
    ].join('\r\n');
  }
}
