import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, downloadFullExport, HealthResponse, OpportunitiesResponse, PaperState, SignalItem } from './api';

type DashboardState = {
  health: HealthResponse;
  opportunities: OpportunitiesResponse;
  paper: PaperState;
  latestSignals: SignalItem[];
};

type TabKey = 'overview' | 'signals' | 'paper' | 'activity';

type ActivityItem = {
  title: string;
  text: string;
  time: string | null;
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

const formatPrice = (value: number): string =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: value >= 1000 ? 2 : 4 }).format(value);

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
  BUY_NOW: 'Покупать сейчас',
  WAIT: 'Ждать',
  EXIT: 'Не покупать / выходить'
};

const secondsToNextBoundary = (minutes: number, now = Date.now()): number => {
  const ms = minutes * 60_000;
  return Math.max(0, Math.ceil((ms - (now % ms)) / 1000));
};

const formatCountdown = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

function SignalCard({ item }: { item: SignalItem }) {
  return (
    <div className="recommendation-card">
      <div className="card-topline">
        <div>
          <strong>{item.symbol}</strong>
          <span className="timeframe-pill">{timeframeLabel(item.timeframe)}</span>
        </div>
        <span className="status-badge">{recommendationText[item.recommendation]}</span>
      </div>
      <p>{item.headline}</p>
      {item.tradePlan ? (
        <p>
          Вход {formatPrice(item.tradePlan.entryMin)} – {formatPrice(item.tradePlan.entryMax)} · Стоп{' '}
          {formatPrice(item.tradePlan.stopLoss)} · TP1 {formatPrice(item.tradePlan.takeProfit1)}
        </p>
      ) : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="hero-card">{text}</div>;
}

export default function App() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [tick, setTick] = useState(Date.now());

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
    const tickTimer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(tickTimer);
    };
  }, [load]);

  const handleRefreshNow = async () => {
    try {
      setBusy(true);
      setMessage('Запускаю новый анализ рынка...');
      await api.runAnalyzeNow();
      await load();
      setMessage('Рынок обновлён.');
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : 'Не удалось обновить рынок');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPaper = async () => {
    try {
      setBusy(true);
      setMessage('Сбрасываю демо-счёт...');
      await api.resetPaper();
      await load();
      setMessage('Демо-счёт сброшен.');
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : 'Не удалось сбросить демо-счёт');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleScanner = async () => {
    if (!data) return;

    const nextEnabled = !data.health.analyzer.scanEnabled;

    try {
      setBusy(true);
      setMessage(nextEnabled ? 'Включаю сканер...' : 'Выключаю сканер...');
      await api.setScannerEnabled(nextEnabled);
      await load();
      setMessage(nextEnabled ? 'Сканер включён.' : 'Сканер выключен.');
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : 'Не удалось переключить сканер');
    } finally {
      setBusy(false);
    }
  };

  const countdown15 = formatCountdown(secondsToNextBoundary(15, tick));
  const countdown60 = formatCountdown(secondsToNextBoundary(60, tick));

  const activity = useMemo<ActivityItem[]>(() => {
    if (!data) return [];
    const items: ActivityItem[] = [
      {
        title: 'Последний цикл анализа',
        text: `Сканер выполнил ${data.health.analyzer.runCount} циклов. Сейчас в рынке: покупать ${data.opportunities.buyNow.length}, ждать ${data.opportunities.wait.length}.`,
        time: data.health.analyzer.lastRunAt
      },
      {
        title: 'Последнее событие демо-счёта',
        text: data.paper.summary.lastEventAt
          ? `Баланс ${formatMoney(data.paper.summary.balanceUsd)} $, закрытых сделок ${data.paper.summary.closedTrades}.`
          : 'Демо-счёт ещё не зафиксировал событий.',
        time: data.paper.summary.lastEventAt
      }
    ];

    const latestClosed = data.paper.closedTrades[0];
    if (latestClosed) {
      items.push({
        title: `Закрыта сделка ${latestClosed.symbol}`,
        text: `PnL ${formatMoney(latestClosed.pnlUsd)} $ · причина: ${latestClosed.closeReason}.`,
        time: latestClosed.closedAt
      });
    }

    const latestSignal = data.latestSignals[0];
    if (latestSignal) {
      items.push({
        title: `Последний сигнал ${latestSignal.symbol}`,
        text: `${recommendationText[latestSignal.recommendation]} · ${latestSignal.headline}`,
        time: latestSignal.createdAt
      });
    }

    return items.sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime());
  }, [data]);

  if (error) {
    return <div className="page"><div className="hero-card">Ошибка: {error}</div></div>;
  }

  if (!data) {
    return <div className="page"><div className="hero-card">Загрузка…</div></div>;
  }

  const { health, opportunities, paper, latestSignals } = data;

  return (
    <main className="page">
      <section className="hero-card">
        <div className="tab-hero-row">
          <div>
            <h1>Сигналы рынка + демо-счёт</h1>
            <p>
              Приложение само анализирует рынок, ищет сигналы, открывает виртуальные сделки и считает статистику.
            </p>
          </div>
          <div className="tab-actions">
            <button onClick={downloadFullExport} disabled={busy}>Выгрузить полную статистику</button>
            <button onClick={handleRefreshNow} disabled={busy || !health.analyzer.scanEnabled}>Обновить сейчас</button>
            <button onClick={handleToggleScanner} disabled={busy}>{health.analyzer.scanEnabled ? 'Выключить сканер' : 'Включить сканер'}</button>
            <button onClick={handleResetPaper} disabled={busy}>Сбросить демо-счёт</button>
          </div>
        </div>

        <div className="stats-grid compact-top-grid">
          <div className="stat-card"><span>Последний анализ</span><strong>{formatDateTime(health.analyzer.lastRunAt)}</strong></div>
          <div className="stat-card"><span>Следующая 15м свеча</span><strong>{countdown15}</strong></div>
          <div className="stat-card"><span>Следующая 1ч свеча</span><strong>{countdown60}</strong></div>
          <div className="stat-card"><span>Баланс демо</span><strong>${formatMoney(paper.summary.balanceUsd)}</strong></div>
          <div className="stat-card"><span>Сканер</span><strong>{health.analyzer.scanEnabled ? 'Включён' : 'Выключен'}</strong></div>
        </div>

        {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
      </section>

      <section className="tab-strip">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Главное</button>
        <button className={activeTab === 'signals' ? 'active' : ''} onClick={() => setActiveTab('signals')}>Сигналы</button>
        <button className={activeTab === 'paper' ? 'active' : ''} onClick={() => setActiveTab('paper')}>Демо-счёт</button>
        <button className={activeTab === 'activity' ? 'active' : ''} onClick={() => setActiveTab('activity')}>Активность</button>
      </section>

      {activeTab === 'overview' ? (
        <>
          {opportunities.bestIdea ? (
            <section className="hero-card">
              <h2>Главный сигнал сейчас: {opportunities.bestIdea.symbol}</h2>
              <p>{opportunities.bestIdea.shortText}</p>
              {opportunities.bestIdea.tradePlan ? (
                <p>
                  Вход {formatPrice(opportunities.bestIdea.tradePlan.entryMin)} – {formatPrice(opportunities.bestIdea.tradePlan.entryMax)} ·
                  Стоп {formatPrice(opportunities.bestIdea.tradePlan.stopLoss)} · Продажа 1{' '}
                  {formatPrice(opportunities.bestIdea.tradePlan.takeProfit1)} · Продажа 2{' '}
                  {formatPrice(opportunities.bestIdea.tradePlan.takeProfit2)}
                </p>
              ) : null}
            </section>
          ) : (
            <EmptyState text={health.analyzer.scanEnabled ? 'Пока нет главного сигнала. Приложение ждёт следующий цикл и новую свечу.' : 'Сканер выключен. Включите его, чтобы приложение снова искало сигналы.'} />
          )}

          <section className="stats-grid">
            <div className="stat-card"><span>Покупать сейчас</span><strong>{opportunities.buyNow.length}</strong></div>
            <div className="stat-card"><span>Ждать</span><strong>{opportunities.wait.length}</strong></div>
            <div className="stat-card"><span>Открытых сделок</span><strong>{paper.summary.openPositions}</strong></div>
            <div className="stat-card"><span>Итог PnL</span><strong>${formatMoney(paper.summary.totalPnlUsd)}</strong></div>
            <div className="stat-card"><span>Сканер</span><strong>{health.analyzer.scanEnabled ? 'Работает' : 'Остановлен'}</strong></div>
          </section>

          <section className="columns">
            <div>
              <h2>Что купить сейчас</h2>
              {opportunities.buyNow.slice(0, 4).map((item) => <SignalCard key={item.id} item={item} />)}
              {opportunities.buyNow.length === 0 ? <EmptyState text="Сейчас сильных сигналов на покупку нет." /> : null}
            </div>
            <div>
              <h2>Что ждать</h2>
              {opportunities.wait.slice(0, 4).map((item) => <SignalCard key={item.id} item={item} />)}
              {opportunities.wait.length === 0 ? <EmptyState text="Сейчас нет идей в режиме ожидания." /> : null}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'signals' ? (
        <>
          <section className="columns">
            <div>
              <h2>Покупать сейчас</h2>
              {opportunities.buyNow.slice(0, 8).map((item) => <SignalCard key={item.id} item={item} />)}
              {opportunities.buyNow.length === 0 ? <EmptyState text="Пока нет сильных сигналов на вход." /> : null}
            </div>
            <div>
              <h2>Ждать</h2>
              {opportunities.wait.slice(0, 8).map((item) => <SignalCard key={item.id} item={item} />)}
              {opportunities.wait.length === 0 ? <EmptyState text="Сейчас всё либо слабое, либо уже отработало." /> : null}
            </div>
          </section>

          <section className="hero-card">
            <h2>Последние сигналы рынка</h2>
            {latestSignals.slice(0, 12).map((item) => <SignalCard key={item.id} item={item} />)}
            {latestSignals.length === 0 ? <p>Сигналов пока нет.</p> : null}
          </section>
        </>
      ) : null}

      {activeTab === 'paper' ? (
        <>
          <section className="stats-grid">
            <div className="stat-card"><span>Стартовый баланс</span><strong>${formatMoney(paper.summary.startingBalanceUsd)}</strong></div>
            <div className="stat-card"><span>Текущий баланс</span><strong>${formatMoney(paper.summary.balanceUsd)}</strong></div>
            <div className="stat-card"><span>Win rate</span><strong>{formatPercent(paper.summary.winRate)}</strong></div>
            <div className="stat-card"><span>Комиссии</span><strong>${formatMoney(paper.summary.totalFeesUsd)}</strong></div>
          </section>

          <section className="columns">
            <div>
              <h2>Открытые виртуальные сделки</h2>
              {paper.openPositions.map((item) => (
                <div key={item.id} className="recommendation-card">
                  <strong>{item.symbol}</strong> · {timeframeLabel(item.timeframe)}<br />
                  Вход {formatPrice(item.entryPrice)} · Стоп {formatPrice(item.stopLoss)} · TP1 {formatPrice(item.takeProfit1)} · TP2{' '}
                  {formatPrice(item.takeProfit2)}
                </div>
              ))}
              {paper.openPositions.length === 0 ? <EmptyState text="Пока нет открытых демо-сделок." /> : null}
            </div>
            <div>
              <h2>Последние закрытые сделки</h2>
              {paper.closedTrades.slice(0, 12).map((item) => (
                <div key={item.id} className="recommendation-card">
                  <strong>{item.symbol}</strong> · {timeframeLabel(item.timeframe)}<br />
                  PnL: ${formatMoney(item.pnlUsd)} · Причина: {item.closeReason} · {formatDateTime(item.closedAt)}
                </div>
              ))}
              {paper.closedTrades.length === 0 ? <EmptyState text="Закрытых демо-сделок пока нет." /> : null}
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'activity' ? (
        <>
          <section className="hero-card">
            <h2>Что происходит сейчас</h2>
            <p>
              Сканер {health.analyzer.isRunning ? 'сейчас выполняет цикл анализа.' : 'ждёт следующий цикл.'} Проверяется до{' '}
              {health.universe.maxSymbolsToAnalyze} монет, таймфреймы — 15 минут и 1 час.
            </p>
            <p>
              Если цифры на экране не меняются несколько минут подряд — это нормально: стратегия ждёт закрытия новой свечи.
            </p>
          </section>

          <section className="hero-card">
            <h2>Последние действия</h2>
            <div className="activity-list">
              {activity.map((item, index) => (
                <div key={`${item.title}-${index}`} className="activity-item">
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                  <span>{formatDateTime(item.time)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
