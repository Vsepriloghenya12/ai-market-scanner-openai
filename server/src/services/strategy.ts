import { config } from '../config';
import { StrategyRule } from '../types';

export const strategyRules: StrategyRule[] = [
  {
    id: 'universe-filter',
    title: 'Сначала отбирать ликвидные фьючерсы',
    description:
      'Сканер не тратит время на тонкий мусорный рынок. В анализ попадают только USDT-фьючерсы с достаточным оборотом и нормальным спредом.'
  },
  {
    id: 'trend-filter',
    title: 'Искать монеты только на рост',
    description:
      'Главный сценарий — long по тренду. Сильный сетап возможен, когда EMA20 > EMA50 > EMA200 и цена держится выше EMA200.'
  },
  {
    id: 'breakout-or-pullback',
    title: 'Покупать либо пробой, либо аккуратный откат',
    description:
      'Система ищет два понятных сценария: пробой максимума последних свечей на объёме или вход после здорового отката к EMA20/EMA50.'
  },
  {
    id: 'momentum-volume',
    title: 'Без объёма и импульса вход не подтверждён',
    description:
      'После анализа paper-сделок фильтр входа стал жёстче: для покупки нужен не просто тренд, а подтверждённый импульс, объём, рабочая RSI-зона и отсутствие перегретого фандинга.'
  },
  {
    id: 'risk-first',
    title: 'Сначала риск, потом прибыль',
    description:
      'Стоп и цели считаются от ATR и рыночной структуры. После первой цели стоп переносится ближе к безубытку, а число одновременных paper-позиций ограничивается.'
  },
  {
    id: 'simple-output',
    title: 'Для пользователя — только простое действие',
    description:
      'На экране показывается не набор индикаторов, а готовый план: купить сейчас, ждать или выходить из уже открытого long.'
  }
];

export const strategyMeta = {
  adxThreshold: 18,
  minAdxForEntry: { fastTimeframe: 24, slowTimeframe: 22 },
  minMomentumForEntryPct: { fastTimeframe: 1.15, slowTimeframe: 0.9 },
  minVolumeRatioForEntry: { fastTimeframe: 1.35, slowTimeframe: 1.25 },
  rsiEntryZone: { min: 55, fastTimeframeMin: 56, max: 66 },
  trendGapEntryZonePct: { min: 0.8, max: 7.5 },
  maxFundingRateForEntry: 0.00015,
  highVolatilityThresholdPct: 4.2,
  rewardTargetsR: [1.5, 2.5],
  accountSizeUsd: config.accountSizeUsd,
  riskPerTradePct: config.riskPerTradePct,
  minConfidenceActionable: config.minConfidenceActionable,
  maxSymbolsToAnalyze: config.maxSymbolsToAnalyze,
  minTurnover24hUsd: config.minTurnover24hUsd,
  maxSpreadPct: config.maxSpreadPct,
  quoteCoin: config.quoteCoin
};
