"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushNotificationService = exports.PushNotificationService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const web_push_1 = __importDefault(require("web-push"));
const config_1 = require("../config");
const storage_1 = require("./storage");
const keyFilePath = () => node_path_1.default.join(node_path_1.default.dirname(config_1.config.storageFile), 'vapid-keys.json');
const readOrCreateVapidKeys = () => {
    if (!config_1.config.pushEnabled) {
        return null;
    }
    if (config_1.config.vapidPublicKey && config_1.config.vapidPrivateKey) {
        return {
            publicKey: config_1.config.vapidPublicKey,
            privateKey: config_1.config.vapidPrivateKey
        };
    }
    const filename = keyFilePath();
    if (node_fs_1.default.existsSync(filename)) {
        try {
            const parsed = JSON.parse(node_fs_1.default.readFileSync(filename, 'utf-8'));
            if (parsed.publicKey && parsed.privateKey) {
                return {
                    publicKey: parsed.publicKey,
                    privateKey: parsed.privateKey
                };
            }
        }
        catch (error) {
            console.error('Не удалось прочитать VAPID-ключи push-уведомлений:', error);
        }
    }
    const generated = web_push_1.default.generateVAPIDKeys();
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(filename), { recursive: true });
    node_fs_1.default.writeFileSync(filename, JSON.stringify(generated, null, 2), 'utf-8');
    return generated;
};
const formatPrice = (value) => {
    if (value >= 1000)
        return value.toFixed(2);
    if (value >= 1)
        return value.toFixed(4);
    return value.toFixed(8);
};
const toWebPushSubscription = (subscription) => ({
    endpoint: subscription.endpoint,
    keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
    }
});
const getStatusCode = (error) => {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
        const statusCode = error.statusCode;
        return typeof statusCode === 'number' ? statusCode : null;
    }
    return null;
};
class PushNotificationService {
    vapidKeys;
    constructor() {
        this.vapidKeys = readOrCreateVapidKeys();
        if (this.vapidKeys) {
            web_push_1.default.setVapidDetails(config_1.config.pushSubject, this.vapidKeys.publicKey, this.vapidKeys.privateKey);
        }
    }
    getStatus() {
        const pushState = storage_1.storageService.getPushState();
        return {
            enabled: Boolean(config_1.config.pushEnabled && this.vapidKeys),
            publicKey: this.vapidKeys?.publicKey ?? null,
            subscriptionsCount: pushState.subscriptions.length,
            lastNotificationAt: pushState.sentEvents[0]?.sentAt ?? null,
            lastNotification: pushState.sentEvents[0] ?? null
        };
    }
    getPublicKey() {
        return this.vapidKeys?.publicKey ?? null;
    }
    subscribe(subscription, userAgent) {
        if (!config_1.config.pushEnabled || !this.vapidKeys) {
            throw new Error('Push-уведомления выключены на сервере.');
        }
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
            throw new Error('Браузер прислал неполную push-подписку.');
        }
        return storage_1.storageService.upsertPushSubscription({
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
            },
            userAgent
        });
    }
    unsubscribe(endpoint) {
        if (!endpoint) {
            return;
        }
        storage_1.storageService.removePushSubscription(endpoint);
    }
    async sendTest() {
        return this.sendToAll({
            title: 'Пуш уведомления включены',
            body: 'Теперь новые сигналы “Покупать” будут приходить на телефон.',
            url: '/',
            tag: 'push-test'
        });
    }
    async notifySignal(signal) {
        if (!config_1.config.pushEnabled || !this.vapidKeys || signal.recommendation !== 'BUY_NOW' || !signal.tradePlan) {
            return;
        }
        const pushState = storage_1.storageService.getPushState();
        if (pushState.subscriptions.length === 0) {
            return;
        }
        const signalKey = `${signal.symbol}:${signal.timeframe}`;
        const latestSameSignal = pushState.sentEvents.find((item) => item.signalKey === signalKey && item.status === 'SENT');
        if (latestSameSignal) {
            const ageMs = new Date(signal.createdAt).getTime() - new Date(latestSameSignal.sentAt).getTime();
            if (ageMs >= 0 && ageMs < config_1.config.pushMinRepeatMs) {
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
        const event = {
            id: node_crypto_1.default.randomUUID(),
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
        storage_1.storageService.recordPushEvent(event);
    }
    async sendToAll(payload) {
        if (!config_1.config.pushEnabled || !this.vapidKeys) {
            return { sent: 0, failed: 0 };
        }
        const pushState = storage_1.storageService.getPushState();
        let sent = 0;
        let failed = 0;
        await Promise.all(pushState.subscriptions.map(async (subscription) => {
            try {
                await web_push_1.default.sendNotification(toWebPushSubscription(subscription), JSON.stringify(payload), { TTL: 60 * 30 });
                sent += 1;
            }
            catch (error) {
                failed += 1;
                const statusCode = getStatusCode(error);
                if (statusCode === 404 || statusCode === 410) {
                    storage_1.storageService.removePushSubscription(subscription.endpoint);
                }
                else {
                    console.error('Не удалось отправить push-уведомление:', error);
                }
            }
        }));
        return { sent, failed };
    }
}
exports.PushNotificationService = PushNotificationService;
exports.pushNotificationService = new PushNotificationService();
