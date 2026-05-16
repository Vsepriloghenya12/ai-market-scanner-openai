import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  downloadFullExport,
  HealthResponse,
  OpportunitiesResponse,
  PaperState,
  PushStatusResponse,
  SignalItem
} from './api';

type DashboardState = {
  health: HealthResponse;
  opportunities: OpportunitiesResponse;
  paper: PaperState;
  latestSignals: SignalItem[];
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

const formatPrice = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value >= 1000 ? 2 : value >= 1 ? 4 : 8 }).format(value);

const formatPercent = (value: number): string => `${formatMoney(value * 100)}%`;

const formatDateTime = (value: string | null): string => (value ? new Date(value).toLocaleString('ru-RU') : '—');

const timeframeLabel = (value: string): string => {
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric < 60 ? `${numeric} мин` : `${numeric / 60} ч`;
  }
  return value;
};

const recommendationText: Record<SignalItem['recommendation'], string> = {
  BUY_NOW: 'Покупать',
  WAIT: 'Ждать',
  EXIT: 'Не покупать'
};

const recommendationClass: Record<SignalItem['recommendation'], string> = {
  BUY_NOW: 'buy',
  WAIT: 'wait',
  EXIT: 'exit'
};

const isStandaloneApp = (): boolean => {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }
  return output;
};

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Этот браузер не поддерживает service worker.');
  }

  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

function SignalCard({ item, featured = false }: { item: SignalItem; featured?: boolean }) {
  const plan = item.tradePlan;

  return (
    <article className={`signal-card ${featured ? 'featured' : ''}`}>
      <div className="signal-head">
        <div>
          <div className="symbol-line">
            <strong>{item.symbol}</strong>
            <span>{timeframeLabel(item.timeframe)}</span>
          </div>
          <p>{item.shortText}</p>
        </div>
        <div className={`signal-badge ${recommendationClass[item.recommendation]}`}>
          {recommendationText[item.recommendation]}
        </div>
      </div>

      {plan ? (
        <div className="plan-grid">
          <div><span>Вход</span><strong>{formatPrice(plan.entryMin)} – {formatPrice(plan.entryMax)}</strong></div>
          <div><span>Стоп</span><strong>{formatPrice(plan.stopLoss)}</strong></div>
          <div><span>TP1</span><strong>{formatPrice(plan.takeProfit1)}</strong></div>
          <div><span>TP2</span><strong>{formatPrice(plan.takeProfit2)}</strong></div>
          <div><span>Риск</span><strong>${formatMoney(plan.riskAmountUsd)}</strong></div>
          <div><span>Размер</span><strong>{formatMoney(plan.suggestedPositionUnits)}</strong></div>
        </div>
      ) : null}

      <div className="signal-meta">
        <span>Цена: {formatPrice(item.price)}</span>
        <span>Уверенность: {formatPercent(item.confidence)}</span>
        <span>{formatDateTime(item.createdAt)}</span>
      </div>

      {item.reason.length > 0 ? (
        <ul className="reason-list">
          {item.reason.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-card">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatusResponse | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const load = useCallback(async () => {
    try {
      const [health, opportunities, paper, latest, push] = await Promise.all([
        api.getHealth(),
        api.getOpportunities(),
        api.getPaper(),
        api.getSignalsLatest(),
        api.getPushStatus()
      ]);
      setData({ health, opportunities, paper, latestSignals: latest.items });
      setPushStatus(push);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    }
  }, []);

  useEffect(() => {
    registerServiceWorker().catch((swError) => {
      console.warn('Service worker не зарегистрирован:', swError);
    });

    setInstalled(isStandaloneApp());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const runAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      setBusy(true);
      setMessage(label);
      await action();
      await load();
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : 'Действие не выполнено');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const runPushAction = async (action: () => Promise<string>) => {
    try {
      setPushBusy(true);
      setPushMessage(null);
      const result = await action();
      setPushMessage(result);
      const nextStatus = await api.getPushStatus();
      setPushStatus(nextStatus);
    } catch (actionError) {
      setPushMessage(actionError instanceof Error ? actionError.message : 'Действие с push-уведомлениями не выполнено');
    } finally {
      setPushBusy(false);
    }
  };

  const handleRefreshNow = () => runAction('Запускаю анализ рынка...', api.runAnalyzeNow);

  const handleToggleScanner = () => {
    if (!data) return;
    const nextEnabled = !data.health.analyzer.scanEnabled;
    runAction(nextEnabled ? 'Включаю сканер...' : 'Выключаю сканер...', () => api.setScannerEnabled(nextEnabled));
  };

  const handleResetPaper = () => {
    const confirmed = window.confirm('Сбросить демо-счёт и удалить текущие открытые демо-сделки?');
    if (!confirmed) return;
    runAction('Сбрасываю демо-счёт...', api.resetPaper);
  };

  const handleInstall = () => runPushAction(async () => {
    if (!installPrompt) {
      throw new Error('На этом устройстве установка доступна через меню браузера: “Добавить на главный экран”.');
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      return 'Приложение установлено или установка подтверждена.';
    }
    return 'Установка отменена.';
  });

  const handleEnablePush = () => runPushAction(async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      throw new Error('Этот браузер не поддерживает push-уведомления для PWA.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Разрешение на уведомления не выдано.');
    }

    const { enabled, publicKey } = await api.getPushPublicKey();
    if (!enabled || !publicKey) {
      throw new Error('Push-уведомления не включены на сервере.');
    }

    const registration = await registerServiceWorker();
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    await api.subscribePush(subscription.toJSON());
    const test = await api.sendPushTest();
    return test.sent > 0
      ? 'Push включён. Тестовое уведомление отправлено.'
      : 'Push включён, но тестовое уведомление не доставлено. Проверьте разрешения телефона.';
  });

  const handleDisablePush = () => runPushAction(async () => {
    const registration = await registerServiceWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await api.unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    return 'Push-уведомления отключены на этом устройстве.';
  });

  const handleTestPush = () => runPushAction(async () => {
    const result = await api.sendPushTest();
    return `Тест отправлен: доставлено ${result.sent}, ошибок ${result.failed}.`;
  });

  const bestBuy = data?.opportunities.buyNow[0] ?? null;
  const fallbackSignals = useMemo(() => data?.latestSignals.filter((item) => item.recommendation !== 'EXIT').slice(0, 6) ?? [], [data]);
  const notificationPermission = 'Notification' in window ? Notification.permission : 'unsupported';

  if (error) {
    return <main className="page"><EmptyState title="Ошибка" text={error} /></main>;
  }

  if (!data) {
    return <main className="page"><EmptyState title="Загрузка" text="Получаю последние сигналы и демо-сделки." /></main>;
  }

  const { health, opportunities, paper, latestSignals } = data;
  const scannerStatus = health.analyzer.isRunning ? 'сканирует сейчас' : health.analyzer.scanEnabled ? 'включён' : 'выключен';

  return (
    <main className="page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Bybit USDT Futures · demo trading · push alerts</p>
          <h1>Сигналы: что купить и где поставить стоп</h1>
          <p className="hero-text">
            Приложение сканирует рынок, показывает понятные long-планы, открывает демо-сделки и отправляет push на телефон при новом сигнале “Покупать”.
          </p>
        </div>
        <div className="action-panel">
          <button onClick={handleRefreshNow} disabled={busy || !health.analyzer.scanEnabled}>Обновить сейчас</button>
          <button onClick={handleToggleScanner} disabled={busy}>{health.analyzer.scanEnabled ? 'Остановить сканер' : 'Включить сканер'}</button>
          <button onClick={downloadFullExport} disabled={busy}>Скачать историю</button>
          <button className="danger" onClick={handleResetPaper} disabled={busy}>Сбросить демо</button>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span>Сканер</span><strong>{scannerStatus}</strong></div>
        <div className="stat-card"><span>Последний анализ</span><strong>{formatDateTime(health.analyzer.lastRunAt)}</strong></div>
        <div className="stat-card"><span>Сигналов купить</span><strong>{opportunities.buyNow.length}</strong></div>
        <div className="stat-card"><span>Баланс демо</span><strong>${formatMoney(paper.summary.balanceUsd)}</strong></div>
        <div className="stat-card"><span>Открыто сделок</span><strong>{paper.summary.openPositions}</strong></div>
        <div className="stat-card"><span>Push-подписок</span><strong>{pushStatus?.subscriptionsCount ?? 0}</strong></div>
      </section>

      {message ? <div className="notice-card">{message}</div> : null}
      {health.analyzer.lastError ? <div className="error-card">Ошибка последнего анализа: {health.analyzer.lastError}</div> : null}

      <section className="section-card">
        <div className="section-title">
          <div>
            <h2>Установка на телефон и push</h2>
            <p>Установите приложение на главный экран и включите уведомления. Новые сигналы “Покупать” будут приходить даже без открытой вкладки.</p>
          </div>
        </div>
        <div className="push-grid">
          <div className="push-card">
            <span>Статус приложения</span>
            <strong>{installed ? 'Установлено' : 'Можно открыть в браузере / добавить на экран'}</strong>
            <p>Android обычно показывает кнопку установки. На iPhone откройте сайт в Safari → Поделиться → На экран “Домой”.</p>
          </div>
          <div className="push-card">
            <span>Push</span>
            <strong>{notificationPermission === 'granted' ? 'Разрешены' : notificationPermission === 'denied' ? 'Запрещены' : 'Не включены'}</strong>
            <p>Подписок на сервере: {pushStatus?.subscriptionsCount ?? 0}. Последний push: {formatDateTime(pushStatus?.lastNotificationAt ?? null)}.</p>
          </div>
        </div>
        <div className="inline-actions">
          <button onClick={handleInstall} disabled={pushBusy || installed}>Установить приложение</button>
          <button onClick={handleEnablePush} disabled={pushBusy || pushStatus?.enabled === false}>Включить push</button>
          <button onClick={handleTestPush} disabled={pushBusy || (pushStatus?.subscriptionsCount ?? 0) === 0}>Тест push</button>
          <button className="secondary" onClick={handleDisablePush} disabled={pushBusy}>Отключить push</button>
        </div>
        {pushMessage ? <div className="notice-card compact-notice">{pushMessage}</div> : null}
        {pushStatus?.enabled === false ? <div className="error-card compact-notice">Push выключен на сервере. Проверьте PUSH_ENABLED и VAPID-ключи.</div> : null}
      </section>

      <section className="section-card">
        <div className="section-title">
          <div>
            <h2>Что покупать сейчас</h2>
            <p>Сюда попадают только сигналы, по которым приложение само готово открыть демо-сделку.</p>
          </div>
        </div>
        {bestBuy ? (
          <SignalCard item={bestBuy} featured />
        ) : (
          <EmptyState
            title="Сейчас нет входа"
            text="Сканер работает, но пока не нашёл достаточно чистый long-план. Ниже показаны идеи, за которыми можно следить."
          />
        )}
        <div className="cards-grid">
          {opportunities.buyNow.slice(bestBuy ? 1 : 0, 7).map((item) => <SignalCard key={item.id} item={item} />)}
        </div>
      </section>

      <section className="section-card">
        <h2>Идеи в ожидании</h2>
        <div className="cards-grid">
          {(opportunities.wait.length > 0 ? opportunities.wait : fallbackSignals).slice(0, 8).map((item) => <SignalCard key={item.id} item={item} />)}
        </div>
        {opportunities.wait.length === 0 && fallbackSignals.length === 0 ? (
          <EmptyState title="Идей пока нет" text="После первого успешного цикла анализа здесь появятся монеты для наблюдения." />
        ) : null}
      </section>

      <section className="section-card">
        <div className="section-title">
          <div>
            <h2>Демо-счёт</h2>
            <p>Приложение открывает виртуальные сделки только по сигналам “Покупать”.</p>
          </div>
        </div>
        <div className="stats-grid compact">
          <div className="stat-card"><span>Старт</span><strong>${formatMoney(paper.summary.startingBalanceUsd)}</strong></div>
          <div className="stat-card"><span>PnL</span><strong>${formatMoney(paper.summary.totalPnlUsd)}</strong></div>
          <div className="stat-card"><span>Win rate</span><strong>{formatPercent(paper.summary.winRate)}</strong></div>
          <div className="stat-card"><span>Комиссии</span><strong>${formatMoney(paper.summary.totalFeesUsd)}</strong></div>
        </div>

        <h3>Открытые сделки</h3>
        <div className="cards-grid">
          {paper.openPositions.map((position) => (
            <article className="trade-card" key={position.id}>
              <div className="symbol-line"><strong>{position.symbol}</strong><span>{timeframeLabel(position.timeframe)}</span></div>
              <div className="plan-grid small">
                <div><span>Вход</span><strong>{formatPrice(position.entryPrice)}</strong></div>
                <div><span>Стоп</span><strong>{formatPrice(position.stopLoss)}</strong></div>
                <div><span>TP1</span><strong>{formatPrice(position.takeProfit1)}</strong></div>
                <div><span>TP2</span><strong>{formatPrice(position.takeProfit2)}</strong></div>
              </div>
              <p>{position.tp1Hit ? 'TP1 уже достигнут, стоп подтянут.' : 'Сделка открыта по сигналу приложения.'}</p>
            </article>
          ))}
        </div>
        {paper.openPositions.length === 0 ? <EmptyState title="Открытых сделок нет" text="Демо-счёт откроет сделку автоматически, когда появится сигнал “Покупать”." /> : null}
      </section>

      <section className="section-card">
        <h2>История сделок</h2>
        <div className="history-list">
          {paper.closedTrades.slice(0, 40).map((trade) => (
            <article className="history-row" key={trade.id}>
              <div>
                <strong>{trade.symbol}</strong>
                <span>{timeframeLabel(trade.timeframe)} · {formatDateTime(trade.closedAt)} · {trade.closeReason}</span>
              </div>
              <div>
                <strong className={trade.pnlUsd >= 0 ? 'positive' : 'negative'}>${formatMoney(trade.pnlUsd)}</strong>
                <span>Вход {formatPrice(trade.entryPrice)} → выход {formatPrice(trade.exitPrice)}</span>
              </div>
            </article>
          ))}
        </div>
        {paper.closedTrades.length === 0 ? <EmptyState title="История пока пустая" text="После закрытия первых демо-сделок здесь будет база для доработки стратегии." /> : null}
      </section>

      <section className="section-card">
        <h2>Последние сигналы</h2>
        <div className="cards-grid">
          {latestSignals.slice(0, 12).map((item) => <SignalCard key={item.id} item={item} />)}
        </div>
        {latestSignals.length === 0 ? <EmptyState title="Сигналов пока нет" text="Нажмите “Обновить сейчас” или дождитесь автоматического цикла сканера." /> : null}
      </section>
    </main>
  );
}
