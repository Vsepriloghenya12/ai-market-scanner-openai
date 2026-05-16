import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webpush, { PushSubscription } from 'web-push';
import { config } from '../config';
import { PushNotificationEvent, PushSubscriptionRecord, SignalRecord } from '../types';
import { storageService } from './storage';

interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  signalId?: string;
  symbol?: string;
  timeframe?: string;
}

const keyFilePath = (): string => path.join(path.dirname(config.storageFile), 'vapid-keys.json');

const readOrCreateVapidKeys = (): StoredVapidKeys | null => {
  if (!config.pushEnabled) {
    return null;
  }

  if (config.vapidPublicKey && config.vapidPrivateKey) {
    return {
      publicKey: config.vapidPublicKey,
      privateKey: config.vapidPrivateKey
    };
  }

  const filename = keyFilePath();
  if (fs.existsSync(filename)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filename, 'utf-8')) as Partial<StoredVapidKeys>;
      if (parsed.publicKey && parsed.privateKey) {
        return {
          publicKey: parsed.publicKey,
          privateKey: parsed.privateKey
        };
      }
    } catch (error) {
      console.error('Не удалось прочитать VAPID-ключи push-уведомлений:', error);
    }
  }

  const generated = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(generated, null, 2), 'utf-8');
  return generated;
};

const formatPrice = (value: number): string => {
  if (value >= 1000) return value.toFixed(2);
  if (value >= 1) return value.toFixed(4);
  return value.toFixed(8);
};

const toWebPushSubscription = (subscription: PushSubscriptionRecord): PushSubscription => ({
  endpoint: subscription.endpoint,
  keys: {
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth
  }
});

const getStatusCode = (error: unknown): number | null => {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }
  return null;
};

export class PushNotificationService {
  private readonly vapidKeys: StoredVapidKeys | null;

  constructor() {
    this.vapidKeys = readOrCreateVapidKeys();

    if (this.vapidKeys) {
      webpush.setVapidDetails(config.pushSubject, this.vapidKeys.publicKey, this.vapidKeys.privateKey);
    }
  }

  public getStatus() {
    const pushState = storageService.getPushState();
    return {
      enabled: Boolean(config.pushEnabled && this.vapidKeys),
      publicKey: this.vapidKeys?.publicKey ?? null,
      subscriptionsCount: pushState.subscriptions.length,
      lastNotificationAt: pushState.sentEvents[0]?.sentAt ?? null,
      lastNotification: pushState.sentEvents[0] ?? null
    };
  }

  public getPublicKey(): string | null {
    return this.vapidKeys?.publicKey ?? null;
  }

  public subscribe(subscription: Partial<PushSubscriptionRecord>, userAgent: string | null): PushSubscriptionRecord {
    if (!config.pushEnabled || !this.vapidKeys) {
      throw new Error('Push-уведомления выключены на сервере.');
    }

    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
      throw new Error('Браузер прислал неполную push-подписку.');
    }

    return storageService.upsertPushSubscription({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userAgent
    });
  }

  public unsubscribe(endpoint: string | undefined): void {
    if (!endpoint) {
      return;
    }
    storageService.removePushSubscription(endpoint);
  }

  public async sendTest(): Promise<{ sent: number; failed: number }> {
    return this.sendToAll({
      title: 'Пуш уведомления включены',
      body: 'Теперь новые сигналы “Покупать” будут приходить на телефон.',
      url: '/',
      tag: 'push-test'
    });
  }

  public async notifySignal(signal: SignalRecord): Promise<void> {
    if (!config.pushEnabled || !this.vapidKeys || signal.recommendation !== 'BUY_NOW' || !signal.tradePlan) {
      return;
    }

    const pushState = storageService.getPushState();
    if (pushState.subscriptions.length === 0) {
      return;
    }

    const signalKey = `${signal.symbol}:${signal.timeframe}`;
    const latestSameSignal = pushState.sentEvents.find((item) => item.signalKey === signalKey && item.status === 'SENT');
    if (latestSameSignal) {
      const ageMs = new Date(signal.createdAt).getTime() - new Date(latestSameSignal.sentAt).getTime();
      if (ageMs >= 0 && ageMs < config.pushMinRepeatMs) {
        return;
      }
    }

    const plan = signal.tradePlan;
    const title = `Покупать ${signal.symbol}`;
    const body = `Вход ${formatPrice(plan.entryMin)}–${formatPrice(plan.entryMax)} · Стоп ${formatPrice(plan.stopLoss)} · TP1 ${formatPrice(plan.takeProfit1)} · TP2 ${formatPrice(plan.takeProfit2)}`;

    const result = await this.sendToAll({
      title,
      body,
      url: '/',
      tag: signalKey,
      signalId: signal.id,
      symbol: signal.symbol,
      timeframe: signal.timeframe
    });

    const event: PushNotificationEvent = {
      id: crypto.randomUUID(),
      signalId: signal.id,
      signalKey,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      title,
      body,
      url: '/',
      sentAt: new Date().toISOString(),
      status: result.sent > 0 ? 'SENT' : 'FAILED',
      deliveredCount: result.sent,
      failedCount: result.failed
    };

    storageService.recordPushEvent(event);
  }

  private async sendToAll(payload: PushPayload): Promise<{ sent: number; failed: number }> {
    if (!config.pushEnabled || !this.vapidKeys) {
      return { sent: 0, failed: 0 };
    }

    const pushState = storageService.getPushState();
    let sent = 0;
    let failed = 0;

    await Promise.all(
      pushState.subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(toWebPushSubscription(subscription), JSON.stringify(payload), { TTL: 60 * 30 });
          sent += 1;
        } catch (error) {
          failed += 1;
          const statusCode = getStatusCode(error);
          if (statusCode === 404 || statusCode === 410) {
            storageService.removePushSubscription(subscription.endpoint);
          } else {
            console.error('Не удалось отправить push-уведомление:', error);
          }
        }
      })
    );

    return { sent, failed };
  }
}

export const pushNotificationService = new PushNotificationService();
