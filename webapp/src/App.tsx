import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, downloadFullExport, HealthResponse, OpportunitiesResponse, PaperState, SignalItem } from './api';

type DashboardState = {
  health: HealthResponse;
  opportunities: OpportunitiesResponse;
  paper: PaperState;
  latestSignals: SignalItem[];
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

  const load = useCallback(async () => {
    try {
      const [health, opportunities, paper, latest] = await Promise.all([
        api.getHealth(),
        api.getOpportunities(),
        api.getPaper(),
        api.getSignalsLatest()
      ]);
      setData({ health, opportunities, paper, latestSignals: latest.items });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки');
    }
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

  const bestBuy = data?.opportunities.buyNow[0] ?? null;
  const fallbackSignals = useMemo(() => data?.latestSignals.filter((item) => item.recommendation !== 'EXIT').slice(0, 6) ?? [], [data]);

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
          <p className="eyebrow">Bybit USDT Futures · demo trading</p>
          <h1>Сигналы: что купить и где поставить стоп</h1>
          <p className="hero-text">
            Приложение сканирует рынок, показывает только понятные long-планы и автоматически открывает демо-сделки по своим сигналам.
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
        <div className="stat-card"><span>Закрыто сделок</span><strong>{paper.summary.closedTrades}</strong></div>
      </section>

      {message ? <div className="notice-card">{message}</div> : null}
      {health.analyzer.lastError ? <div className="error-card">Ошибка последнего анализа: {health.analyzer.lastError}</div> : null}

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
