import { useCallback, useEffect, useMemo, useState } from 'react';
import { AIAnalysis, api, OverviewResponse, SignalItem } from './api';

type CardMode = 'BUY_NOW' | 'WAIT' | 'SELL';

interface RecommendationMeta {
  mode: CardMode;
  title: string;
  subtitle: string;
  actionText: string;
  exitText: string;
  badgeText: string;
  badgeClassName: string;
}

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(value));
};

const formatNumber = (value: number, maximumFractionDigits = 4): string => {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits
  }).format(value);
};

const formatPrice = (value: number): string => {
  if (value >= 1000) {
    return formatNumber(value, 2);
  }
  if (value >= 1) {
    return formatNumber(value, 4);
  }
  return formatNumber(value, 6);
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const timeframeLabel = (value: string): string => {
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (numeric < 60) {
      return `${numeric} мин`;
    }
    if (numeric % 60 === 0) {
      const hours = numeric / 60;
      return hours === 1 ? '1 час' : `${hours} часа`;
    }
  }

  if (value === 'D') {
    return '1 день';
  }

  if (value === 'W') {
    return '1 неделя';
  }

  return value;
};

const symbolLabel = (symbol: string): string => (symbol === 'ALL' ? 'Все монеты' : symbol);

const aiStatusLabel: Record<AIAnalysis['status'], string> = {
  READY: 'ИИ разбор готов',
  SKIPPED: 'ИИ пропущен',
  ERROR: 'Ошибка ИИ'
};

const modeLabel = (mode: CardMode): string => {
  if (mode === 'BUY_NOW') {
    return 'Покупать сейчас';
  }
  if (mode === 'SELL') {
    return 'Если уже купили — продавать';
  }
  return 'Ждать';
};

const getRecommendationMeta = (item: SignalItem): RecommendationMeta => {
  if (item.signal === 'BUY' && item.actionable && item.tradePlan) {
    return {
      mode: 'BUY_NOW',
      title: 'Покупать сейчас',
      subtitle: 'Сигнал подтверждён правилами стратегии и прошёл риск-фильтр.',
      actionText: `Покупка около ${formatPrice(item.tradePlan.entry)}.`,
      exitText: `Часть позиции можно закрыть около ${formatPrice(item.tradePlan.takeProfit1)}, остаток — около ${formatPrice(item.tradePlan.takeProfit2)}. Защита идеи: ${formatPrice(item.tradePlan.stopLoss)}.`,
      badgeText: 'Покупать',
      badgeClassName: 'status-badge-buy'
    };
  }

  if (item.signal === 'SELL') {
    return {
      mode: 'SELL',
      title: 'Если уже купили — продавать',
      subtitle: 'Для новичка это не вход в шорт, а сигнал не покупать заново и подумать о выходе из уже купленной монеты.',
      actionText: 'Новые покупки сейчас не делать.',
      exitText: item.tradePlan
        ? `Если монета уже куплена, думать о сокращении или выходе. Ближайшие уровни: ${formatPrice(item.tradePlan.takeProfit1)} и ${formatPrice(item.tradePlan.takeProfit2)}. Стоп-контроль: ${formatPrice(item.tradePlan.stopLoss)}.`
        : 'Если монета уже куплена, не усреднять и не докупать. Лучше дождаться нового сигнала на покупку.',
      badgeText: 'Продавать',
      badgeClassName: 'status-badge-sell'
    };
  }

  return {
    mode: 'WAIT',
    title: 'Ждать',
    subtitle: 'Идея ещё не готова для входа или рынок слишком слабый.',
    actionText: item.tradePlan
      ? `Следить за зоной около ${formatPrice(item.tradePlan.entry)} и ждать подтверждения.`
      : 'Сейчас лучше не входить. Ждать следующего обновления и более сильного сигнала.',
    exitText: 'Пока ничего не покупать и ничего не продавать, если позиции ещё нет.',
    badgeText: 'Ждать',
    badgeClassName: 'status-badge-wait'
  };
};

const compactReasonList = (item: SignalItem): string[] => {
  const fromAi = item.aiAnalysis?.strengths?.filter(Boolean) ?? [];
  const fromRules = item.reason.filter(Boolean);
  const joined = [...fromAi, ...fromRules];
  return joined.slice(0, 3);
};

const shortExplanation = (item: SignalItem): string => {
  if (item.aiAnalysis?.summary) {
    return item.aiAnalysis.summary;
  }
  if (item.reason.length > 0) {
    return item.reason[0];
  }
  return 'Сигнал сформирован, но короткое пояснение пока отсутствует.';
};

function RecommendationCard({ item }: { item: SignalItem }) {
  const meta = getRecommendationMeta(item);
  const reasons = compactReasonList(item);

  return (
    <article className="recommendation-card">
      <div className="card-topline">
        <div>
          <div className="coin-line">
            <h3>{item.symbol}</h3>
            <span className="timeframe-pill">{timeframeLabel(item.timeframe)}</span>
          </div>
          <p className="card-subtitle">{meta.subtitle}</p>
        </div>
        <span className={`status-badge ${meta.badgeClassName}`}>{meta.badgeText}</span>
      </div>

      <div className="price-line">
        <span className="label">Текущая цена</span>
        <strong>{formatPrice(item.price)}</strong>
      </div>

      <div className="plain-plan-box plain-plan-primary">
        <span className="plain-plan-label">Что делать</span>
        <strong>{meta.title}</strong>
        <p>{meta.actionText}</p>
      </div>

      <div className="plain-plan-box">
        <span className="plain-plan-label">Когда продавать</span>
        <p>{meta.exitText}</p>
      </div>

      {item.tradePlan ? (
        <div className="levels-grid">
          <div className="level-card">
            <span className="label">Покупка</span>
            <strong>{formatPrice(item.tradePlan.entry)}</strong>
          </div>
          <div className="level-card">
            <span className="label">Стоп</span>
            <strong>{formatPrice(item.tradePlan.stopLoss)}</strong>
          </div>
          <div className="level-card">
            <span className="label">Продажа 1</span>
            <strong>{formatPrice(item.tradePlan.takeProfit1)}</strong>
          </div>
          <div className="level-card">
            <span className="label">Продажа 2</span>
            <strong>{formatPrice(item.tradePlan.takeProfit2)}</strong>
          </div>
        </div>
      ) : (
        <div className="notice-box">Чёткий уровень входа пока не дан. Значит приложение советует только наблюдать.</div>
      )}

      <div className="explanation-box">
        <span className="label">Почему так</span>
        <p>{shortExplanation(item)}</p>
      </div>

      {reasons.length > 0 ? (
        <ul className="reason-list beginner-list">
          {reasons.map((reason) => (
            <li key={`${item.id}-${reason}`}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="meta-row">
        <span>Уверенность: {formatPercent(item.confidence)}</span>
        <span>Обновлено: {formatDateTime(item.createdAt)}</span>
      </div>

      <details className="advanced-box">
        <summary>Показать подробности</summary>

        <div className="advanced-grid">
          <div>
            <span className="label">Сигнал движка</span>
            <strong>{modeLabel(meta.mode)}</strong>
          </div>
          <div>
            <span className="label">RSI</span>
            <strong>{formatNumber(item.indicators.rsi, 2)}</strong>
          </div>
          <div>
            <span className="label">ADX</span>
            <strong>{formatNumber(item.indicators.adx, 2)}</strong>
          </div>
          <div>
            <span className="label">Объём / средний</span>
            <strong>{formatNumber(item.indicators.volumeRatio, 2)}x</strong>
          </div>
        </div>

        {item.aiAnalysis ? (
          <div className="ai-box">
            <div className="ai-box-head">
              <strong>{aiStatusLabel[item.aiAnalysis.status]}</strong>
              <span>{formatDateTime(item.aiAnalysis.generatedAt)}</span>
            </div>
            <p>{item.aiAnalysis.marketNarrative}</p>
            <p className="muted-text">Следующее действие: {item.aiAnalysis.nextAction}</p>
          </div>
        ) : null}
      </details>
    </article>
  );
}

export default function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [latestSignals, setLatestSignals] = useState<SignalItem[]>([]);
  const [historySignals, setHistorySignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    try {
      const [overviewResponse, latestResponse, historyResponse] = await Promise.all([
        api.getOverview(),
        api.getLatestSignals(),
        api.getSignals(60)
      ]);

      setOverview(overviewResponse);
      setLatestSignals(latestResponse.items);
      setHistorySignals(historyResponse.items);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => undefined);
    const interval = window.setInterval(() => {
      loadData().catch(() => undefined);
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [loadData]);

  const symbols = useMemo(() => ['ALL', ...(overview?.trackedSymbols ?? [])], [overview]);

  const filteredLatestSignals = useMemo(() => {
    return latestSignals.filter((item) => (selectedSymbol === 'ALL' ? true : item.symbol === selectedSymbol));
  }, [latestSignals, selectedSymbol]);

  const filteredHistorySignals = useMemo(() => {
    return historySignals.filter((item) => (selectedSymbol === 'ALL' ? true : item.symbol === selectedSymbol));
  }, [historySignals, selectedSymbol]);

  const grouped = useMemo(() => {
    const buyNow = filteredLatestSignals
      .filter((item) => getRecommendationMeta(item).mode === 'BUY_NOW')
      .sort((left, right) => right.confidence - left.confidence);

    const wait = filteredLatestSignals
      .filter((item) => getRecommendationMeta(item).mode === 'WAIT')
      .sort((left, right) => right.confidence - left.confidence);

    const sell = filteredLatestSignals
      .filter((item) => getRecommendationMeta(item).mode === 'SELL')
      .sort((left, right) => right.confidence - left.confidence);

    return { buyNow, wait, sell };
  }, [filteredLatestSignals]);

  const bestIdea = useMemo(() => {
    return grouped.buyNow[0] ?? grouped.wait[0] ?? grouped.sell[0] ?? null;
  }, [grouped]);

  return (
    <div className="app-shell">
      <main className="page">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Простая версия для новичка</p>
            <h1>Что купить и когда продать</h1>
            <p className="hero-text">
              Приложение теперь показывает не сложные индикаторы, а готовый план простыми словами: покупать
              сейчас, ждать или не покупать. Для каждой монеты есть понятные уровни покупки, стоп и две цели
              продажи.
            </p>
          </div>
          <div className="hero-side">
            <div className="hero-stat">
              <span className={overview?.analyzer.isRunning ? 'live-dot active' : 'live-dot'} />
              {overview?.analyzer.isRunning ? 'Рынок сканируется сейчас' : 'Ожидание следующей проверки'}
            </div>
            <div className="hero-meta">Последняя проверка: {formatDateTime(overview?.analyzer.lastRunAt ?? null)}</div>
            <div className="hero-meta">Монет в списке: {overview?.trackedSymbols.length ?? 0}</div>
            <div className="hero-meta">Таймфреймов: {overview?.trackedTimeframes.length ?? 0}</div>
          </div>
        </section>

        {loading ? <section className="panel">Загрузка данных…</section> : null}
        {error ? <section className="panel error-panel">Ошибка: {error}</section> : null}

        <section className="stats-row">
          <article className="small-stat">
            <span>Покупать сейчас</span>
            <strong>{grouped.buyNow.length}</strong>
          </article>
          <article className="small-stat">
            <span>Ждать</span>
            <strong>{grouped.wait.length}</strong>
          </article>
          <article className="small-stat">
            <span>Если уже купили — продавать</span>
            <strong>{grouped.sell.length}</strong>
          </article>
          <article className="small-stat">
            <span>Риск на одну идею</span>
            <strong>{formatNumber(overview?.risk.riskPerTradePct ?? 0, 2)}%</strong>
          </article>
        </section>

        <section className="panel best-idea-panel">
          <div className="section-head">
            <div>
              <h2>Главная подсказка сейчас</h2>
              <p className="muted-text">Если не хотите смотреть всё подряд, начните с этого блока.</p>
            </div>
          </div>
          {bestIdea ? (
            <RecommendationCard item={bestIdea} />
          ) : (
            <div className="empty-box">Пока нет готовых сигналов. Дождитесь следующего обновления рынка.</div>
          )}
        </section>

        <section className="panel filter-panel">
          <div className="section-head">
            <div>
              <h2>Выбор монеты</h2>
              <p className="muted-text">Можно смотреть все монеты сразу или выбрать одну.</p>
            </div>
          </div>
          <div className="tab-row">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className={selectedSymbol === symbol ? 'tab-button active' : 'tab-button'}
                onClick={() => setSelectedSymbol(symbol)}
              >
                {symbolLabel(symbol)}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Покупать сейчас</h2>
              <p className="muted-text">Здесь только монеты, где вход уже подтверждён.</p>
            </div>
          </div>
          {grouped.buyNow.length === 0 ? (
            <div className="empty-box">Сейчас приложение не видит хорошего входа на покупку.</div>
          ) : (
            <div className="card-grid">
              {grouped.buyNow.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Ждать</h2>
              <p className="muted-text">Идея есть, но входить рано. Лучше дождаться следующего подтверждения.</p>
            </div>
          </div>
          {grouped.wait.length === 0 ? (
            <div className="empty-box">Сейчас нет монет в режиме ожидания.</div>
          ) : (
            <div className="card-grid">
              {grouped.wait.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Если уже купили — продавать</h2>
              <p className="muted-text">Для новичка этот раздел значит: не покупать заново и подумать о фиксации.</p>
            </div>
          </div>
          {grouped.sell.length === 0 ? (
            <div className="empty-box">Сигналов на продажу сейчас нет.</div>
          ) : (
            <div className="card-grid">
              {grouped.sell.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="panel learn-panel">
          <div className="section-head">
            <div>
              <h2>Как читать приложение</h2>
            </div>
          </div>
          <div className="learn-grid">
            <article className="learn-card">
              <h3>Покупать сейчас</h3>
              <p>Можно смотреть на вход около указанной цены. Стоп и цели уже показаны в карточке.</p>
            </article>
            <article className="learn-card">
              <h3>Ждать</h3>
              <p>Не входить сейчас. Ждать, пока приложение переведёт монету в раздел “Покупать сейчас”.</p>
            </article>
            <article className="learn-card">
              <h3>Если уже купили — продавать</h3>
              <p>Это не шорт. Это подсказка для уже купленной монеты: не докупать и думать о выходе.</p>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Короткая история</h2>
              <p className="muted-text">Последние обновления сигнала по выбранной монете.</p>
            </div>
          </div>
          <div className="history-list">
            {filteredHistorySignals.length === 0 ? (
              <div className="empty-box">История пока пустая.</div>
            ) : (
              filteredHistorySignals.slice(0, 12).map((item) => {
                const meta = getRecommendationMeta(item);
                return (
                  <article key={item.id} className="history-card">
                    <div>
                      <strong>
                        {item.symbol} · {timeframeLabel(item.timeframe)}
                      </strong>
                      <div className="muted-text">{formatDateTime(item.createdAt)}</div>
                    </div>
                    <div className="history-right">
                      <span className={`status-badge ${meta.badgeClassName}`}>{meta.badgeText}</span>
                      <span className="muted-text">{formatPrice(item.price)}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
