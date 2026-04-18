const root = document.getElementById('root');

const state = {
  overview: null,
  latestSignals: [],
  historySignals: [],
  loading: true,
  error: null,
  selectedSymbol: 'ALL'
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(value));
};

const formatNumber = (value, maximumFractionDigits = 4) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(value);

const formatPrice = (value) => {
  if (value >= 1000) return formatNumber(value, 2);
  if (value >= 1) return formatNumber(value, 4);
  return formatNumber(value, 6);
};

const formatPercent = (value) => `${Math.round(value * 100)}%`;

const timeframeLabel = (value) => {
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    if (numeric < 60) return `${numeric} мин`;
    if (numeric % 60 === 0) {
      const hours = numeric / 60;
      return hours === 1 ? '1 час' : `${hours} часа`;
    }
  }
  if (value === 'D') return '1 день';
  if (value === 'W') return '1 неделя';
  return value;
};

const symbolLabel = (symbol) => (symbol === 'ALL' ? 'Все монеты' : symbol);

const aiStatusLabel = {
  READY: 'ИИ разбор готов',
  SKIPPED: 'ИИ пропущен',
  ERROR: 'Ошибка ИИ'
};

const modeLabel = (mode) => {
  if (mode === 'BUY_NOW') return 'Покупать сейчас';
  if (mode === 'SELL') return 'Если уже купили — продавать';
  return 'Ждать';
};

const getRecommendationMeta = (item) => {
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
      subtitle:
        'Для новичка это не вход в шорт, а сигнал не покупать заново и подумать о выходе из уже купленной монеты.',
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

const compactReasonList = (item) => {
  const fromAi = item.aiAnalysis?.strengths?.filter(Boolean) ?? [];
  const fromRules = item.reason?.filter(Boolean) ?? [];
  return [...fromAi, ...fromRules].slice(0, 3);
};

const shortExplanation = (item) => {
  if (item.aiAnalysis?.summary) return item.aiAnalysis.summary;
  if (item.reason?.length) return item.reason[0];
  return 'Сигнал сформирован, но короткое пояснение пока отсутствует.';
};

const renderReasonList = (item) => {
  const reasons = compactReasonList(item);
  if (reasons.length === 0) return '';
  return `
    <ul class="reason-list beginner-list">
      ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}
    </ul>
  `;
};

const renderAdvanced = (item, meta) => {
  const aiBlock = item.aiAnalysis
    ? `
      <div class="ai-box">
        <div class="ai-box-head">
          <strong>${escapeHtml(aiStatusLabel[item.aiAnalysis.status] ?? 'ИИ')}</strong>
          <span>${escapeHtml(formatDateTime(item.aiAnalysis.generatedAt))}</span>
        </div>
        <p>${escapeHtml(item.aiAnalysis.marketNarrative || '')}</p>
        <p class="muted-text">Следующее действие: ${escapeHtml(item.aiAnalysis.nextAction || '—')}</p>
      </div>
    `
    : '';

  return `
    <details class="advanced-box">
      <summary>Показать подробности</summary>
      <div class="advanced-grid">
        <div>
          <span class="label">Сигнал движка</span>
          <strong>${escapeHtml(modeLabel(meta.mode))}</strong>
        </div>
        <div>
          <span class="label">RSI</span>
          <strong>${escapeHtml(formatNumber(item.indicators.rsi, 2))}</strong>
        </div>
        <div>
          <span class="label">ADX</span>
          <strong>${escapeHtml(formatNumber(item.indicators.adx, 2))}</strong>
        </div>
        <div>
          <span class="label">Объём / средний</span>
          <strong>${escapeHtml(formatNumber(item.indicators.volumeRatio, 2))}x</strong>
        </div>
      </div>
      ${aiBlock}
    </details>
  `;
};

const renderTradePlan = (item) => {
  if (!item.tradePlan) {
    return '<div class="notice-box">Чёткий уровень входа пока не дан. Значит приложение советует только наблюдать.</div>';
  }

  return `
    <div class="levels-grid">
      <div class="level-card">
        <span class="label">Покупка</span>
        <strong>${escapeHtml(formatPrice(item.tradePlan.entry))}</strong>
      </div>
      <div class="level-card">
        <span class="label">Стоп</span>
        <strong>${escapeHtml(formatPrice(item.tradePlan.stopLoss))}</strong>
      </div>
      <div class="level-card">
        <span class="label">Продажа 1</span>
        <strong>${escapeHtml(formatPrice(item.tradePlan.takeProfit1))}</strong>
      </div>
      <div class="level-card">
        <span class="label">Продажа 2</span>
        <strong>${escapeHtml(formatPrice(item.tradePlan.takeProfit2))}</strong>
      </div>
    </div>
  `;
};

const renderRecommendationCard = (item) => {
  const meta = getRecommendationMeta(item);
  return `
    <article class="recommendation-card">
      <div class="card-topline">
        <div>
          <div class="coin-line">
            <h3>${escapeHtml(item.symbol)}</h3>
            <span class="timeframe-pill">${escapeHtml(timeframeLabel(item.timeframe))}</span>
          </div>
          <p class="card-subtitle">${escapeHtml(meta.subtitle)}</p>
        </div>
        <span class="status-badge ${meta.badgeClassName}">${escapeHtml(meta.badgeText)}</span>
      </div>

      <div class="price-line">
        <span class="label">Текущая цена</span>
        <strong>${escapeHtml(formatPrice(item.price))}</strong>
      </div>

      <div class="plain-plan-box plain-plan-primary">
        <span class="plain-plan-label">Что делать</span>
        <strong>${escapeHtml(meta.title)}</strong>
        <p>${escapeHtml(meta.actionText)}</p>
      </div>

      <div class="plain-plan-box">
        <span class="plain-plan-label">Когда продавать</span>
        <p>${escapeHtml(meta.exitText)}</p>
      </div>

      ${renderTradePlan(item)}

      <div class="explanation-box">
        <span class="label">Почему так</span>
        <p>${escapeHtml(shortExplanation(item))}</p>
      </div>

      ${renderReasonList(item)}

      <div class="meta-row">
        <span>Уверенность: ${escapeHtml(formatPercent(item.confidence))}</span>
        <span>Обновлено: ${escapeHtml(formatDateTime(item.createdAt))}</span>
      </div>

      ${renderAdvanced(item, meta)}
    </article>
  `;
};

const renderSection = (title, subtitle, items, emptyText) => `
  <section class="panel">
    <div class="section-head">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p class="muted-text">${escapeHtml(subtitle)}</p>
      </div>
    </div>
    ${
      items.length === 0
        ? `<div class="empty-box">${escapeHtml(emptyText)}</div>`
        : `<div class="card-grid">${items.map(renderRecommendationCard).join('')}</div>`
    }
  </section>
`;

const getFilteredLatestSignals = () =>
  state.latestSignals.filter((item) => (state.selectedSymbol === 'ALL' ? true : item.symbol === state.selectedSymbol));

const getFilteredHistorySignals = () =>
  state.historySignals.filter((item) => (state.selectedSymbol === 'ALL' ? true : item.symbol === state.selectedSymbol));

const getGroups = (items) => ({
  buyNow: items.filter((item) => getRecommendationMeta(item).mode === 'BUY_NOW').sort((a, b) => b.confidence - a.confidence),
  wait: items.filter((item) => getRecommendationMeta(item).mode === 'WAIT').sort((a, b) => b.confidence - a.confidence),
  sell: items.filter((item) => getRecommendationMeta(item).mode === 'SELL').sort((a, b) => b.confidence - a.confidence)
});

const renderHistory = (items) => `
  <section class="panel">
    <div class="section-head">
      <div>
        <h2>Короткая история</h2>
        <p class="muted-text">Последние обновления сигнала по выбранной монете.</p>
      </div>
    </div>
    <div class="history-list">
      ${
        items.length === 0
          ? '<div class="empty-box">История пока пустая.</div>'
          : items
              .slice(0, 12)
              .map((item) => {
                const meta = getRecommendationMeta(item);
                return `
                  <article class="history-card">
                    <div>
                      <strong>${escapeHtml(item.symbol)} · ${escapeHtml(timeframeLabel(item.timeframe))}</strong>
                      <div class="muted-text">${escapeHtml(formatDateTime(item.createdAt))}</div>
                    </div>
                    <div class="history-right">
                      <span class="status-badge ${meta.badgeClassName}">${escapeHtml(meta.badgeText)}</span>
                      <span class="muted-text">${escapeHtml(formatPrice(item.price))}</span>
                    </div>
                  </article>
                `;
              })
              .join('')
      }
    </div>
  </section>
`;

const render = () => {
  const symbols = ['ALL', ...(state.overview?.trackedSymbols ?? [])];
  const filteredLatestSignals = getFilteredLatestSignals();
  const filteredHistorySignals = getFilteredHistorySignals();
  const grouped = getGroups(filteredLatestSignals);
  const bestIdea = grouped.buyNow[0] ?? grouped.wait[0] ?? grouped.sell[0] ?? null;

  root.innerHTML = `
    <div class="app-shell">
      <main class="page">
        <section class="hero-panel">
          <div>
            <p class="eyebrow">Простая версия для новичка</p>
            <h1>Что купить и когда продать</h1>
            <p class="hero-text">
              Приложение теперь показывает не сложные индикаторы, а готовый план простыми словами: покупать
              сейчас, ждать или не покупать. Для каждой монеты есть понятные уровни покупки, стоп и две цели
              продажи.
            </p>
          </div>
          <div class="hero-side">
            <div class="hero-stat">
              <span class="live-dot ${state.overview?.analyzer.isRunning ? 'active' : ''}"></span>
              ${state.overview?.analyzer.isRunning ? 'Рынок сканируется сейчас' : 'Ожидание следующей проверки'}
            </div>
            <div class="hero-meta">Последняя проверка: ${escapeHtml(formatDateTime(state.overview?.analyzer.lastRunAt ?? null))}</div>
            <div class="hero-meta">Монет в списке: ${escapeHtml(String(state.overview?.trackedSymbols.length ?? 0))}</div>
            <div class="hero-meta">Таймфреймов: ${escapeHtml(String(state.overview?.trackedTimeframes.length ?? 0))}</div>
          </div>
        </section>

        ${state.loading ? '<section class="panel">Загрузка данных…</section>' : ''}
        ${state.error ? `<section class="panel error-panel">Ошибка: ${escapeHtml(state.error)}</section>` : ''}

        <section class="stats-row">
          <article class="small-stat">
            <span>Покупать сейчас</span>
            <strong>${grouped.buyNow.length}</strong>
          </article>
          <article class="small-stat">
            <span>Ждать</span>
            <strong>${grouped.wait.length}</strong>
          </article>
          <article class="small-stat">
            <span>Если уже купили — продавать</span>
            <strong>${grouped.sell.length}</strong>
          </article>
          <article class="small-stat">
            <span>Риск на одну идею</span>
            <strong>${escapeHtml(formatNumber(state.overview?.risk.riskPerTradePct ?? 0, 2))}%</strong>
          </article>
        </section>

        <section class="panel best-idea-panel">
          <div class="section-head">
            <div>
              <h2>Главная подсказка сейчас</h2>
              <p class="muted-text">Если не хотите смотреть всё подряд, начните с этого блока.</p>
            </div>
          </div>
          ${bestIdea ? renderRecommendationCard(bestIdea) : '<div class="empty-box">Пока нет готовых сигналов. Дождитесь следующего обновления рынка.</div>'}
        </section>

        <section class="panel filter-panel">
          <div class="section-head">
            <div>
              <h2>Выбор монеты</h2>
              <p class="muted-text">Можно смотреть все монеты сразу или выбрать одну.</p>
            </div>
          </div>
          <div class="tab-row">
            ${symbols
              .map(
                (symbol) => `
                  <button type="button" class="tab-button ${state.selectedSymbol === symbol ? 'active' : ''}" data-symbol="${escapeHtml(symbol)}">
                    ${escapeHtml(symbolLabel(symbol))}
                  </button>
                `
              )
              .join('')}
          </div>
        </section>

        ${renderSection('Покупать сейчас', 'Здесь только монеты, где вход уже подтверждён.', grouped.buyNow, 'Сейчас приложение не видит хорошего входа на покупку.')}
        ${renderSection('Ждать', 'Идея есть, но входить рано. Лучше дождаться следующего подтверждения.', grouped.wait, 'Сейчас нет монет в режиме ожидания.')}
        ${renderSection('Если уже купили — продавать', 'Для новичка этот раздел значит: не покупать заново и подумать о фиксации.', grouped.sell, 'Сигналов на продажу сейчас нет.')}

        <section class="panel learn-panel">
          <div class="section-head">
            <div><h2>Как читать приложение</h2></div>
          </div>
          <div class="learn-grid">
            <article class="learn-card">
              <h3>Покупать сейчас</h3>
              <p>Можно смотреть на вход около указанной цены. Стоп и цели уже показаны в карточке.</p>
            </article>
            <article class="learn-card">
              <h3>Ждать</h3>
              <p>Не входить сейчас. Ждать, пока приложение переведёт монету в раздел “Покупать сейчас”.</p>
            </article>
            <article class="learn-card">
              <h3>Если уже купили — продавать</h3>
              <p>Это не шорт. Это подсказка для уже купленной монеты: не докупать и думать о выходе.</p>
            </article>
          </div>
        </section>

        ${renderHistory(filteredHistorySignals)}
      </main>
    </div>
  `;

  root.querySelectorAll('[data-symbol]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedSymbol = button.getAttribute('data-symbol') || 'ALL';
      render();
    });
  });
};

const request = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Ошибка запроса: ${response.status}`);
  }
  return response.json();
};

const loadData = async () => {
  try {
    const [overview, latest, history] = await Promise.all([
      request('/api/overview'),
      request('/api/signals/latest'),
      request('/api/signals?limit=60')
    ]);

    state.overview = overview;
    state.latestSignals = latest.items ?? [];
    state.historySignals = history.items ?? [];
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Ошибка загрузки данных';
  } finally {
    state.loading = false;
    render();
  }
};

render();
loadData();
window.setInterval(loadData, 10000);
