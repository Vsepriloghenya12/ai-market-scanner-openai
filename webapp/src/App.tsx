import { useCallback, useEffect, useState } from 'react';
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
        <h1>Сигналы рынка + демо-счёт</h1>
        <p>
          Приложение само анализирует рынок, ищет сигналы, открывает виртуальные сделки и считает статистику без
          реальных денег.
        </p>
        <p>
          Последний цикл: {formatDateTime(health.analyzer.lastRunAt)} · Баланс демо-счёта: ${formatMoney(paper.summary.balanceUsd)}
        </p>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span>Покупать сейчас</span><strong>{opportunities.buyNow.length}</strong></div>
        <div className="stat-card"><span>Ждать</span><strong>{opportunities.wait.length}</strong></div>
        <div className="stat-card"><span>Закрытых виртуальных сделок</span><strong>{paper.summary.closedTrades}</strong></div>
        <div className="stat-card"><span>Итог PnL</span><strong>${formatMoney(paper.summary.totalPnlUsd)}</strong></div>
      </section>

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
      ) : null}

      <section className="columns">
        <div>
          <h2>Покупать сейчас</h2>
          {opportunities.buyNow.slice(0, 6).map((item) => <SignalCard key={item.id} item={item} />)}
        </div>
        <div>
          <h2>Ждать</h2>
          {opportunities.wait.slice(0, 6).map((item) => <SignalCard key={item.id} item={item} />)}
        </div>
      </section>

      <section className="hero-card">
        <h2>Демо-счёт</h2>
        <p>
          Текущий баланс: ${formatMoney(paper.summary.balanceUsd)} · Win rate: {formatPercent(paper.summary.winRate)} ·
          Комиссии: ${formatMoney(paper.summary.totalFeesUsd)}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={downloadFullExport} disabled={busy}>Выгрузить полную статистику</button>
          <button onClick={handleRefreshNow} disabled={busy}>Обновить сейчас</button>
          <button onClick={handleResetPaper} disabled={busy}>Сбросить демо-счёт</button>
        </div>
        {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
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
        </div>
        <div>
          <h2>Последние виртуальные сделки</h2>
          {paper.closedTrades.slice(0, 10).map((item) => (
            <div key={item.id} className="recommendation-card">
              <strong>{item.symbol}</strong> · {timeframeLabel(item.timeframe)}<br />
              PnL: ${formatMoney(item.pnlUsd)} · Причина: {item.closeReason} · {formatDateTime(item.closedAt)}
            </div>
          ))}
        </div>
      </section>

      <section className="hero-card">
        <h2>Последние сигналы рынка</h2>
        {latestSignals.slice(0, 10).map((item) => <SignalCard key={item.id} item={item} />)}
      </section>
    </main>
  );
}
