import crypto from 'node:crypto';
import { buildIndicatorSnapshot, evaluateSignal } from '../utils/indicators';
import { SignalRecord } from '../types';
import { aiAnalysisService } from './aiAnalysisService';
import { marketDataService } from './marketData';
import { storageService } from './storage';

export class AnalysisService {
  public async analyze(symbol: string, timeframe: string): Promise<SignalRecord> {
    const candles = await marketDataService.fetchCandles(symbol, timeframe, 260);

    if (candles.length < 220) {
      throw new Error(`Недостаточно свечей для ${symbol}/${timeframe}`);
    }

    const price = candles.at(-1)?.close ?? 0;
    const indicators = buildIndicatorSnapshot(candles);
    const decision = evaluateSignal(price, indicators);

    const record: SignalRecord = {
      id: crypto.randomUUID(),
      symbol,
      timeframe,
      signal: decision.signal,
      confidence: Number(decision.confidence.toFixed(4)),
      score: Number(decision.score.toFixed(4)),
      price,
      createdAt: new Date().toISOString(),
      regime: decision.regime,
      setup: decision.setup,
      actionable: decision.actionable,
      reason: decision.reason,
      indicators: {
        emaFast: Number(indicators.emaFast.toFixed(4)),
        emaMedium: Number(indicators.emaMedium.toFixed(4)),
        emaTrend: Number(indicators.emaTrend.toFixed(4)),
        rsi: Number(indicators.rsi.toFixed(2)),
        atr: Number(indicators.atr.toFixed(4)),
        adx: Number(indicators.adx.toFixed(2)),
        momentumPct: Number(indicators.momentumPct.toFixed(3)),
        volatilityPct: Number(indicators.volatilityPct.toFixed(3)),
        volumeRatio: Number(indicators.volumeRatio.toFixed(3)),
        swingHigh20: Number(indicators.swingHigh20.toFixed(4)),
        swingLow20: Number(indicators.swingLow20.toFixed(4)),
        trendGapPct: Number(indicators.trendGapPct.toFixed(3))
      },
      tradePlan: decision.tradePlan
        ? {
            entry: Number(decision.tradePlan.entry.toFixed(4)),
            stopLoss: Number(decision.tradePlan.stopLoss.toFixed(4)),
            takeProfit1: Number(decision.tradePlan.takeProfit1.toFixed(4)),
            takeProfit2: Number(decision.tradePlan.takeProfit2.toFixed(4)),
            riskRewardRatio: Number(decision.tradePlan.riskRewardRatio.toFixed(2)),
            riskAmountUsd: Number(decision.tradePlan.riskAmountUsd.toFixed(2)),
            suggestedPositionUnits: Number(decision.tradePlan.suggestedPositionUnits.toFixed(6)),
            invalidation: decision.tradePlan.invalidation
          }
        : null,
      aiAnalysis: null
    };

    record.aiAnalysis = await aiAnalysisService.analyzeSignal(record);

    storageService.saveSignal(record);
    return record;
  }
}

export const analysisService = new AnalysisService();
