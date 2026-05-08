import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  onModuleInit() {
    const pushUrl = process.env.UPTIME_KUMA_PUSH_URL;
    if (!pushUrl) {
      return;
    }

    const intervalMs = Math.max(
      30_000,
      Number(process.env.UPTIME_KUMA_PUSH_INTERVAL_MS || 60_000),
    );

    this.pushHeartbeat('startup').catch(() => undefined);
    this.timer = setInterval(() => {
      this.pushHeartbeat('ok').catch(() => undefined);
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async pushHeartbeat(message: string) {
    const pushUrl = process.env.UPTIME_KUMA_PUSH_URL;
    if (!pushUrl) {
      return;
    }

    const separator = pushUrl.includes('?') ? '&' : '?';
    await axios.get(`${pushUrl}${separator}status=up&msg=${encodeURIComponent(message)}`, {
      timeout: 5000,
    });
  }
}
