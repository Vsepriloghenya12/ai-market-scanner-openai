import { config } from '../config';
import { StrategyRule } from '../types';

export const strategyRules: StrategyRule[] = [
  {
    id: 'trend-filter',
    title: 'Торговать только по структуре рынка',
    description:
      'BUY допускается, когда EMA20 > EMA50 > EMA200 и цена находится выше EMA200. SELL — зеркально в нисходящем тренде.'
  },
  {
    id: 'trend-strength',
    title: 'Избегать боковика',
    description:
      'Сигнал усиливается только при ADX выше порога. При слабом тренде система предпочитает HOLD и не навязывает вход.'
  },
  {
    id: 'momentum-volume',
    title: 'Подтверждать импульс и объём',
    description:
      'Продолжение тренда требует положительного моментума и объёма выше среднего. Без подтверждения от рынка confidence снижается.'
  },
  {
    id: 'rsi-zone',
    title: 'Не гнаться за перегретым движением',
    description:
      'Для трендового BUY RSI должен быть в рабочей зоне продолжения, но не в перегреве. Для SELL — зеркальная логика.'
  },
  {
    id: 'atr-risk',
    title: 'Стоп и цели считать от волатильности',
    description:
      'Стоп-лосс строится через ATR и рыночную структуру. Цели задаются как 1.5R и 2.5R, чтобы сохранить положительное отношение риск/прибыль.'
  },
  {
    id: 'fixed-risk',
    title: 'Риск на сделку должен быть фиксирован',
    description:
      'Размер позиции рассчитывается от процента риска на сделку, а не от эмоций или желания увеличить прибыль.'
  }
];

export const strategyMeta = {
  adxThreshold: 18,
  highVolatilityThresholdPct: 3.8,
  rewardTargetsR: [1.5, 2.5],
  accountSizeUsd: config.accountSizeUsd,
  riskPerTradePct: config.riskPerTradePct,
  minConfidenceActionable: config.minConfidenceActionable
};
