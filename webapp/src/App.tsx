import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, OverviewResponse, OpportunitiesResponse, SignalItem } from './api';

type TabType = 'ALL' | 'BUY_NOW' | 'WAIT' | 'EXIT';

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(value));
};

const formatNumber = (value: number, maximumFractionDigits = 2): string => {
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

  return value;
};

const recommendationText: Record<SignalItem['recommendation'], string> = {
  BUY_NOW: 'Покупать сейчас',
  WAIT: 'Ждать',
  EXIT: 'Не покупать / выходить'
};

const recommendationClassName: Record<SignalItem['recommendation'], string> = {
  BUY_NOW: 'status-badge-buy',
  WAIT: 'status-badge-wait',
  EXIT: 'status-badge-sell'
};

const recommendationHint = (item: SignalItem): string => {
  if (item.recommendation === 'BUY_NOW') {
    return 'Это long-идея для фьючерсов. Вход уже подтверждён рынком.';
  }
  if (item.recommendation === 'WAIT') {
    return 'Монета интересна, но покупать рано. Нужно дождаться триггера.';
  }
  return 'Новый long сейчас открывать не стоит. Если позиция уже есть — думать о выходе.';
};

const reasonsForCard = (item: SignalItem): string[] => {
  const merged = [...(item.aiAnalysis?.strengths ?? []), ...item.reason];
  return merged.filter(Boolean).slice(0, 4);
};

function RecommendationCard({ item }: { item: SignalItem }) {
  const reasons = reasonsForCard(item);
  const tradePlan = item.tradePlan;

  return (
    <article className="recommendation-card">
      <div className="card-topline">
        <div>
          <div className="coin-line">
            <h3>{item.symbol}</h3>
            <span className="timeframe-pill">{timeframeLabel(item.timeframe)}</span>
            <span className="timeframe-pill">#{item.market.rank24h} по обороту</span>
          </div>
          <p className="card-subtitle">{recommendationHint(item)}</p>
        </div>
        <span className={`status-badge ${recommendationClassName[item.recommendation]}`}>
          {recommendationText[item.recommendation]}
        </span>
      </div>

      <div className="summary-box summary-box-primary">
        <span className="plain-plan-label">Главная мысль</span>
        <strong>{item.headline}</strong>
        <p>{item.shortText}</p>
      </div>

      <div className="mini-stats-grid">
        <div className="mini-stat-card">
          <span className="label">Текущая цена</span>
          <strong>{formatPrice(item.price)}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="label">Уверенность</span>
          <strong>{formatPercent(item.confidence)}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="label">Оборот 24ч</span>
          <strong>${formatNumber(item.market.turnover24hUsd, 0)}</strong>
        </div>
        <div className="mini-stat-card">
          <span className="label">Спред</span>
          <strong>{formatNumber(item.market.spreadPct, 3)}%</strong>
        </div>
      </div>

      {tradePlan ? (
        <>
          <div className="plain-plan-box plain-plan-primary">
            <span className="plain-plan-label">Что делать</span>
            <strong>
              {item.recommendation === 'BUY_NOW'
                ? `Купить long в зоне ${formatPrice(tradePlan.entryMin)} – ${formatPrice(tradePlan.entryMax)}`
                : item.recommendation === 'WAIT'
                  ? `Ждать зону ${formatPrice(tradePlan.entryMin)} – ${formatPrice(tradePlan.entryMax)}`
                  : 'Новый вход не открывать'}
            </strong>
            <p>{tradePlan.entryComment}</p>
          </div>

          <div className="levels-grid">
            <div className="level-card">
              <span className="label">Зона входа</span>
              <strong>
                {formatPrice(tradePlan.entryMin)} – {formatPrice(tradePlan.entryMax)}
              </strong>
            </div>
            <div className="level-card">
              <span className="label">Стоп</span>
              <strong>{formatPrice(tradePlan.stopLoss)}</strong>
            </div>
            <div className="level-card">
              <span className="label">Продажа 1</span>
              <strong>{formatPrice(tradePlan.takeProfit1)}</strong>
            </div>
            <div className="level-card">
              <span className="label">Продажа 2</span>
              <strong>{formatPrice(tradePlan.takeProfit2)}</strong>
            </div>
          </div>

          <div className="plain-plan-box">
            <span className="plain-plan-label">Когда продавать</span>
            <p>{tradePlan.exitComment}</p>
            <p className="muted-text">Сценарий отмены: {tradePlan.invalidation}</p>
          </div>
        </>
      ) : (
        <div className="notice-box">Пока есть только направление. Чёткая зона входа ещё не подтверждена.</div>
      )}

      <div className="explanation-box">
        <span className="label">Почему приложение так думает</span>
        <p>{item.aiAnalysis?.summary ?? item.shortText}</p>
      </div>

      {reasons.length > 0 ? (
        <ul className="reason-list beginner-list">
          {reasons.map((reason) => (
            <li key={`${item.id}-${reason}`}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <details className="advanced-box">
        <summary>Показать подробности</summary>

        <div className="advanced-grid">
          <div>
            <span className="label">Сетап</span>
            <strong>{item.setup}</strong>
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

        {item.tradePlan ? (
          <div className="advanced-grid">
            <div>
              <span className="label">Риск на идею</span>
              <strong>${formatNumber(item.tradePlan.riskAmountUsd, 2)}</strong>
            </div>
            <div>
              <span className="label">Размер позиции</span>
              <strong>{formatNumber(item.tradePlan.suggestedPositionUnits, 4)} монеты</strong>
            </div>
            <div>
              <span className="label">R/R</span>
              <strong>{formatNumber(item.tradePlan.riskRewardRatio, 2)}</strong>
            </div>
            <div>
              <span className="label">Триггер</span>
              <strong>{item.tradePlan.triggerPrice ? formatPrice(item.tradePlan.triggerPrice) : 'Уже активен'}</strong>
            </div>
          </div>
        ) : null}

        {item.aiAnalysis ? (
          <div className="ai-box">
            <div className="ai-box-head">
              <strong>{item.aiAnalysis.status === 'READY' ? 'Разбор ИИ готов' : 'Разбор ИИ недоступен'}</strong>
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
  const [opportunities, setOpportunities] = useState<OpportunitiesResponse | null>(null);
  const [historySignals, setHistorySignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabType>('ALL');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [overviewResponse, opportunitiesResponse, historyResponse] = await Promise.all([
        api.getOverview(),
        api.getOpportunities(),
        api.getSignals(120)
      ]);

      setOverview(overviewResponse);
      setOpportunities(opportunitiesResponse);
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

  const allLatest = useMemo(() => {
    if (!opportunities) {
      return [] as SignalItem[];
    }
    return [...opportunities.buyNow, ...opportunities.wait, ...opportunities.exit];
  }, [opportunities]);

  const filteredLatest = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();

    return allLatest.filter((item) => {
      const tabMatch = tab === 'ALL' ? true : item.recommendation === tab;
      const searchMatch = normalizedSearch.length === 0 ? true : item.symbol.includes(normalizedSearch);
      return tabMatch && searchMatch;
    });
  }, [allLatest, search, tab]);

  const filteredHistory = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase();
    return historySignals.filter((item) => {
      const searchMatch = normalizedSearch.length === 0 ? true : item.symbol.includes(normalizedSearch);
      return searchMatch;
    });
  }, [historySignals, search]);

  return (
    <div className="app-shell">
      <main className="page">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Фьючерсы · простой режим</p>
            <h1>Что купить сейчас на рынке фьючерсов</h1>
            <p className="hero-text">
              Приложение само просматривает ликвидные USDT-фьючерсы и показывает только готовые long-идеи:
              какую монету купить, в какой зоне входить и на каких ценах продавать.
            </p>
          </div>
          <div className="hero-side">
            <div className="hero-stat">
              <span className={overview?.analyzer.isRunning ? 'live-dot active' : 'live-dot'} />
              {overview?.analyzer.isRunning ? 'Рынок сканируется сейчас' : 'Ожидание следующего цикла'}
            </div>
            <div className="hero-meta">Последняя проверка: {formatDateTime(overview?.analyzer.lastRunAt ?? null)}</div>
            <div className="hero-meta">
              Просматривается монет: {overview?.universe.analyzedSymbols ?? 0} из {overview?.universe.totalSymbols ?? 0}
            </div>
            <div className="hero-meta">Таймфреймы: {(overview?.timeframes ?? []).map(timeframeLabel).join(', ') || '—'}</div>
          </div>
        </section>

        {loading ? <section className="panel">Загрузка данных…</section> : null}
        {error ? <section className="panel error-panel">Ошибка: {error}</section> : null}

        <section className="stats-row">
          <article className="small-stat">
            <span>Купить сейчас</span>
            <strong>{overview?.summary.BUY_NOW ?? 0}</strong>
          </article>
          <article className="small-stat">
            <span>Ждать</span>
            <strong>{overview?.summary.WAIT ?? 0}</strong>
          </article>
          <article className="small-stat">
            <span>Не покупать / выходить</span>
            <strong>{overview?.summary.EXIT ?? 0}</strong>
          </article>
          <article className="small-stat">
            <span>Риск на сделку</span>
            <strong>{formatNumber(overview?.risk.riskPerTradePct ?? 0, 2)}%</strong>
          </article>
        </section>

        <section className="panel best-idea-panel">
          <div className="section-head">
            <div>
              <h2>Лучшая идея сейчас</h2>
              <p className="muted-text">Если хотите смотреть только одну монету — начните с этого блока.</p>
            </div>
          </div>
          {opportunities?.bestIdea ? (
            <RecommendationCard item={opportunities.bestIdea} />
          ) : (
            <div className="empty-box">Пока нет качественной идеи. Значит рынок сейчас лучше просто наблюдать.</div>
          )}
        </section>

        <section className="panel filter-panel">
          <div className="section-head">
            <div>
              <h2>Фильтр по рынку</h2>
              <p className="muted-text">Можно оставить все идеи или смотреть только нужный тип сигнала и монету.</p>
            </div>
          </div>
          <div className="tab-row">
            {[
              ['ALL', 'Все идеи'],
              ['BUY_NOW', 'Покупать сейчас'],
              ['WAIT', 'Ждать'],
              ['EXIT', 'Не покупать / выходить']
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={tab === value ? 'tab-button active' : 'tab-button'}
                onClick={() => setTab(value as TabType)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search-box">
            <span className="label">Поиск монеты</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Например, XRP или DOGE"
            />
          </label>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Готовые идеи</h2>
              <p className="muted-text">Список отсортирован по качеству идеи и ликвидности рынка.</p>
            </div>
          </div>
          {filteredLatest.length === 0 ? (
            <div className="empty-box">Сейчас ничего не найдено по выбранному фильтру.</div>
          ) : (
            <div className="card-grid">
              {filteredLatest.map((item) => (
                <RecommendationCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="panel learn-panel">
          <div className="section-head">
            <div>
              <h2>Как пользоваться</h2>
            </div>
          </div>
          <div className="learn-grid">
            <article className="learn-card">
              <h3>Покупать сейчас</h3>
              <p>Можно смотреть на long-вход в указанной зоне. После входа следите за стопом и двумя целями продажи.</p>
            </article>
            <article className="learn-card">
              <h3>Ждать</h3>
              <p>Монета сильная, но вход ещё не подтверждён. Не спешите покупать раньше триггера.</p>
            </article>
            <article className="learn-card">
              <h3>Не покупать / выходить</h3>
              <p>Новый long лучше не открывать. Если уже купили — контролируйте риск и думайте о выходе.</p>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>История сигналов</h2>
              <p className="muted-text">Последние обновления по монетам, которые сканер уже видел.</p>
            </div>
          </div>
          <div className="history-list">
            {filteredHistory.length === 0 ? (
              <div className="empty-box">История пока пустая.</div>
            ) : (
              filteredHistory.slice(0, 18).map((item) => (
                <article key={item.id} className="history-card">
                  <div>
                    <strong>
                      {item.symbol} · {timeframeLabel(item.timeframe)}
                    </strong>
                    <div className="muted-text">{formatDateTime(item.createdAt)}</div>
                  </div>
                  <div className="history-right">
                    <span className={`status-badge ${recommendationClassName[item.recommendation]}`}>
                      {recommendationText[item.recommendation]}
                    </span>
                    <span className="muted-text">{formatPrice(item.price)}</span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
