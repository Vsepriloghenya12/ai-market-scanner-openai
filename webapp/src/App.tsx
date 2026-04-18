import { useCallback, useEffect, useMemo, useState } from 'react';
import { AIAnalysis, api, OverviewResponse, SignalItem, StrategyResponse } from './api';

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

const signalClassName = (signal: SignalItem['signal']): string => {
  if (signal === 'BUY') {
    return 'signal signal-buy';
  }
  if (signal === 'SELL') {
    return 'signal signal-sell';
  }
  return 'signal signal-hold';
};

const aiStatusClassName = (status: AIAnalysis['status']): string => {
  if (status === 'READY') {
    return 'soft-pill pill-blue';
  }
  if (status === 'ERROR') {
    return 'soft-pill pill-red';
  }
  return 'soft-pill';
};

const signalLabel: Record<SignalItem['signal'], string> = {
  BUY: 'Покупка',
  SELL: 'Продажа',
  HOLD: 'Ожидание'
};

const aiStatusLabel: Record<AIAnalysis['status'], string> = {
  READY: 'Разбор готов',
  SKIPPED: 'Разбор пропущен',
  ERROR: 'Ошибка ИИ'
};

const alignmentLabel: Record<AIAnalysis['alignmentWithRules'], string> = {
  ALIGNED: 'ИИ согласен с правилами',
  MIXED: 'ИИ видит смешанный сценарий',
  CONTRARIAN: 'ИИ расходится с правилами'
};

const regimeLabel: Record<SignalItem['regime'], string> = {
  BULL: 'Восходящий тренд',
  BEAR: 'Нисходящий тренд',
  RANGE: 'Боковой рынок'
};

const setupLabel: Record<SignalItem['setup'], string> = {
  TREND_BREAKOUT: 'Пробой по тренду',
  TREND_PULLBACK: 'Продолжение тренда',
  BREAKDOWN: 'Пробой вниз',
  NONE: 'Сетап не подтверждён'
};

const symbolLabel = (symbol: string): string => {
  return symbol === 'ALL' ? 'Все инструменты' : symbol;
};

export default function App() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [latestSignals, setLatestSignals] = useState<SignalItem[]>([]);
  const [historySignals, setHistorySignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');

  const loadData = useCallback(async () => {
    try {
      const [overviewResponse, strategyResponse, latestResponse, historyResponse] = await Promise.all([
        api.getOverview(),
        api.getStrategy(),
        api.getLatestSignals(),
        api.getSignals(120)
      ]);

      setOverview(overviewResponse);
      setStrategy(strategyResponse);
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

  return (
    <div className="page-shell">
      <div className="background-orb orb-1" />
      <div className="background-orb orb-2" />

      <main className="container">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Русский сканер рынка с ИИ</p>
            <h1>Стратегия считает рынок, а ИИ даёт второй слой разбора</h1>
            <p className="hero-copy">
              Приложение постоянно сканирует рынок по правилам тренда и риска, а при наличии ключа OpenAI
              добавляет к каждому сигналу понятный текстовый разбор: что подтверждает идею, где слабые места,
              как относиться к входу и когда сценарий отменяется.
            </p>
          </div>
          <div className="hero-status">
            <div className="status-badge">
              <span className={overview?.analyzer.isRunning ? 'dot live' : 'dot'} />
              {overview?.analyzer.isRunning ? 'Сканирование рынка выполняется' : 'Ожидание следующего цикла'}
            </div>
            <div className="status-meta">Последний запуск: {formatDateTime(overview?.analyzer.lastRunAt ?? null)}</div>
            <div className="status-meta">Всего циклов анализа: {overview?.analyzer.runCount ?? 0}</div>
            <div className="status-meta">
              Риск на сделку: {formatNumber(overview?.risk.riskPerTradePct ?? 0, 2)}% от{' '}
              {formatNumber(overview?.risk.accountSizeUsd ?? 0, 0)} USD
            </div>
            <div className="status-meta">
              Порог сильного сигнала: {Math.round((overview?.risk.minConfidenceActionable ?? 0) * 100)}%
            </div>
            <div className="status-meta">
              ИИ-разбор: {overview?.ai.ready ? `включён (${overview.ai.model})` : 'не готов'}
            </div>
            <div className="status-meta error-text">Последняя ошибка: {overview?.analyzer.lastError ?? 'нет'}</div>
          </div>
        </section>

        {loading ? <div className="panel">Загрузка данных…</div> : null}
        {error ? <div className="panel error-panel">Ошибка: {error}</div> : null}

        <section className="stats-grid stats-grid-6">
          <article className="stat-card">
            <span className="stat-label">Всего сигналов</span>
            <strong>{overview?.summary.total ?? 0}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Покупка</span>
            <strong>{overview?.summary.BUY ?? 0}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Продажа</span>
            <strong>{overview?.summary.SELL ?? 0}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Ожидание</span>
            <strong>{overview?.summary.HOLD ?? 0}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Сильные сигналы</span>
            <strong>{overview?.summary.actionable ?? 0}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Разобрано ИИ</span>
            <strong>{overview?.summary.aiReady ?? 0}</strong>
          </article>
        </section>

        <section className="panel ai-panel">
          <div className="section-head">
            <div>
              <h2>Слой ИИ в приложении</h2>
              <p className="muted">Серверный анализ OpenAI поверх стратегического движка</p>
            </div>
            <div className="strategy-meta">{overview?.ai.model ?? '—'}</div>
          </div>
          <div className="ai-summary-grid">
            <div className="rule-card">
              <h3>Статус</h3>
              <p className="muted">
                {overview?.ai.ready
                  ? 'OpenAI подключён, и новые сигналы автоматически получают разбор от ИИ.'
                  : overview?.ai.configured
                    ? 'Ключ есть, но слой ИИ отключён переменной AI_ANALYSIS_ENABLED.'
                    : 'Добавьте OPENAI_API_KEY в Railway, чтобы включить разбор сигналов от ИИ.'}
              </p>
            </div>
            <div className="rule-card">
              <h3>Что делает ИИ</h3>
              <p className="muted">
                Он не считает рынок с нуля, а оценивает уже готовый снимок рынка: подтверждает или охлаждает идею,
                выделяет риски и объясняет сценарий входа и выхода.
              </p>
            </div>
            <div className="rule-card">
              <h3>Режим ожидания</h3>
              <p className="muted">
                {overview?.ai.analyzeHoldSignals
                  ? 'ИИ анализирует даже сигналы ожидания.'
                  : 'По умолчанию сигналы ожидания пропускаются, чтобы не тратить токены на рыночный шум.'}
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Правила стратегии</h2>
              <p className="muted">То, что реально зашито в движок сигналов</p>
            </div>
            {strategy ? (
              <div className="strategy-meta">
                ADX ≥ {strategy.meta.adxThreshold} · цели {strategy.meta.rewardTargetsR.join('R / ')}R
              </div>
            ) : null}
          </div>

          <div className="rule-grid">
            {(strategy?.rules ?? []).map((rule) => (
              <article key={rule.id} className="rule-card">
                <h3>{rule.title}</h3>
                <p className="muted">{rule.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="toolbar panel">
          <div>
            <h2>Фильтр</h2>
            <p className="muted">Отбор по инструменту</p>
          </div>
          <div className="symbol-tabs">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className={selectedSymbol === symbol ? 'tab active' : 'tab'}
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
              <h2>Последние сигналы</h2>
              <p className="muted">По одному последнему сигналу на каждый символ и таймфрейм</p>
            </div>
          </div>
          <div className="latest-grid">
            {filteredLatestSignals.length === 0 ? (
              <div className="empty-state">
                Пока нет сигналов. После первого успешного цикла анализа карточки появятся здесь.
              </div>
            ) : null}
            {filteredLatestSignals.map((item) => (
              <article key={item.id} className="latest-card">
                <div className="latest-topline">
                  <div>
                    <h3>{item.symbol}</h3>
                    <p className="muted">
                      Таймфрейм {item.timeframe} · {regimeLabel[item.regime]}
                    </p>
                  </div>
                  <span className={signalClassName(item.signal)}>{signalLabel[item.signal]}</span>
                </div>

                <div className="pill-row">
                  <span className="soft-pill">{setupLabel[item.setup]}</span>
                  <span className={item.actionable ? 'soft-pill pill-green' : 'soft-pill'}>
                    {item.actionable ? 'Готов к разбору сделки' : 'Наблюдение'}
                  </span>
                  {item.aiAnalysis ? (
                    <span className={aiStatusClassName(item.aiAnalysis.status)}>{aiStatusLabel[item.aiAnalysis.status]}</span>
                  ) : null}
                </div>

                <div className="latest-metrics latest-metrics-3">
                  <div>
                    <span className="metric-label">Цена</span>
                    <strong>{formatNumber(item.price, 3)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Уверенность</span>
                    <strong>{Math.round(item.confidence * 100)}%</strong>
                  </div>
                  <div>
                    <span className="metric-label">Оценка</span>
                    <strong>{formatNumber(item.score, 2)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">RSI</span>
                    <strong>{formatNumber(item.indicators.rsi, 2)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">ADX</span>
                    <strong>{formatNumber(item.indicators.adx, 2)}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Объём / средний</span>
                    <strong>{formatNumber(item.indicators.volumeRatio, 2)}x</strong>
                  </div>
                </div>

                {item.tradePlan ? (
                  <div className="trade-box">
                    <div className="trade-grid">
                      <div>
                        <span className="metric-label">Вход</span>
                        <strong>{formatNumber(item.tradePlan.entry, 4)}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Стоп</span>
                        <strong>{formatNumber(item.tradePlan.stopLoss, 4)}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Цель 1</span>
                        <strong>{formatNumber(item.tradePlan.takeProfit1, 4)}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Цель 2</span>
                        <strong>{formatNumber(item.tradePlan.takeProfit2, 4)}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Риск</span>
                        <strong>{formatNumber(item.tradePlan.riskAmountUsd, 2)} USD</strong>
                      </div>
                      <div>
                        <span className="metric-label">Размер позиции</span>
                        <strong>{formatNumber(item.tradePlan.suggestedPositionUnits, 6)}</strong>
                      </div>
                    </div>
                    <p className="muted trade-note">
                      Соотношение риск/прибыль {formatNumber(item.tradePlan.riskRewardRatio, 2)} ·{' '}
                      {item.tradePlan.invalidation}
                    </p>
                  </div>
                ) : (
                  <div className="trade-box trade-box-muted">
                    <p className="muted">Торговый план не выдан: сигнал не прошёл риск-фильтр или рынок некачественный.</p>
                  </div>
                )}

                {item.aiAnalysis ? (
                  <div className="ai-card">
                    <div className="ai-card-topline">
                      <div>
                        <h4>Разбор ИИ</h4>
                        <p className="muted small-text">{formatDateTime(item.aiAnalysis.generatedAt)}</p>
                      </div>
                      <div className="ai-verdict-group">
                        <span className={signalClassName(item.aiAnalysis.verdict)}>{signalLabel[item.aiAnalysis.verdict]}</span>
                        <span className="soft-pill">{alignmentLabel[item.aiAnalysis.alignmentWithRules]}</span>
                      </div>
                    </div>

                    <p className="ai-summary">{item.aiAnalysis.summary}</p>
                    <p className="muted">{item.aiAnalysis.marketNarrative}</p>

                    {item.aiAnalysis.confidence !== null ? (
                      <div className="ai-confidence">Уверенность ИИ: {Math.round(item.aiAnalysis.confidence * 100)}%</div>
                    ) : null}

                    <div className="ai-columns">
                      <div>
                        <span className="metric-label">Что подтверждает идею</span>
                        <ul className="reason-list compact-list">
                          {item.aiAnalysis.strengths.map((point) => (
                            <li key={`${item.id}-strength-${point}`}>{point}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="metric-label">Риски</span>
                        <ul className="reason-list compact-list">
                          {item.aiAnalysis.risks.map((point) => (
                            <li key={`${item.id}-risk-${point}`}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="trade-grid ai-plan-grid">
                      <div>
                        <span className="metric-label">Стиль входа</span>
                        <strong>{item.aiAnalysis.entryStyle}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Стиль выхода</span>
                        <strong>{item.aiAnalysis.exitStyle}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Отмена сценария</span>
                        <strong>{item.aiAnalysis.invalidation}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Размер позиции</span>
                        <strong>{item.aiAnalysis.positionSizingNote}</strong>
                      </div>
                      <div>
                        <span className="metric-label">Следующее действие</span>
                        <strong>{item.aiAnalysis.nextAction}</strong>
                      </div>
                    </div>

                    <div>
                      <span className="metric-label">Проверочный список перед входом</span>
                      <ul className="reason-list compact-list">
                        {item.aiAnalysis.checklist.map((point) => (
                          <li key={`${item.id}-check-${point}`}>{point}</li>
                        ))}
                      </ul>
                    </div>

                    {item.aiAnalysis.error ? <div className="error-text">Ошибка ИИ: {item.aiAnalysis.error}</div> : null}
                  </div>
                ) : null}

                <ul className="reason-list">
                  {item.reason.map((reason) => (
                    <li key={`${item.id}-${reason}`}>{reason}</li>
                  ))}
                </ul>

                <div className="latest-footer">Сформирован: {formatDateTime(item.createdAt)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>История сигналов</h2>
              <p className="muted">Последние записи анализатора</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Инструмент</th>
                  <th>ТФ</th>
                  <th>Сигнал</th>
                  <th>ИИ</th>
                  <th>Режим</th>
                  <th>Цена</th>
                  <th>Оценка</th>
                  <th>Уверенность</th>
                  <th>ADX</th>
                  <th>RSI</th>
                  <th>ATR</th>
                  <th>Волатильность</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistorySignals.length === 0 ? (
                  <tr>
                    <td colSpan={13}>История пока пуста. Дождитесь первого успешного цикла анализа.</td>
                  </tr>
                ) : null}
                {filteredHistorySignals.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td>{item.symbol}</td>
                    <td>{item.timeframe}</td>
                    <td>
                      <span className={signalClassName(item.signal)}>{signalLabel[item.signal]}</span>
                    </td>
                    <td>{item.aiAnalysis ? aiStatusLabel[item.aiAnalysis.status] : '—'}</td>
                    <td>{regimeLabel[item.regime]}</td>
                    <td>{formatNumber(item.price, 3)}</td>
                    <td>{formatNumber(item.score, 2)}</td>
                    <td>{Math.round(item.confidence * 100)}%</td>
                    <td>{formatNumber(item.indicators.adx, 2)}</td>
                    <td>{formatNumber(item.indicators.rsi, 2)}</td>
                    <td>{formatNumber(item.indicators.atr, 4)}</td>
                    <td>{formatNumber(item.indicators.volatilityPct, 3)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
