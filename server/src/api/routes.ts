import { Router } from 'express';
import { config } from '../config';
import { aiAnalysisService } from '../services/aiAnalysisService';
import { strategyMeta, strategyRules } from '../services/strategy';
import { storageService } from '../services/storage';

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.json({
    ok: true,
    config: {
      symbols: config.symbols,
      timeframes: config.timeframes,
      scanIntervalMs: config.scanIntervalMs,
      bybitCategory: config.bybitCategory,
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable,
      openAiModel: config.openAiModel,
      aiAnalysisEnabled: config.aiAnalysisEnabled,
      aiAnalyzeHoldSignals: config.aiAnalyzeHoldSignals
    },
    analyzer: storageService.getAnalyzerState(),
    ai: aiAnalysisService.getStatus()
  });
});

apiRouter.get('/signals', (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  const symbol = typeof request.query.symbol === 'string' ? request.query.symbol : undefined;
  const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : undefined;

  const filtered = storageService
    .getSignals()
    .filter((item) => (symbol ? item.symbol === symbol : true))
    .filter((item) => (timeframe ? item.timeframe === timeframe : true))
    .slice(0, limit);

  response.json({
    count: filtered.length,
    items: filtered
  });
});

apiRouter.get('/signals/latest', (_request, response) => {
  const latestMap = new Map<string, ReturnType<typeof storageService.getSignals>[number]>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  response.json({
    items: Array.from(latestMap.values()).sort((left, right) => {
      if (left.symbol === right.symbol) {
        return left.timeframe.localeCompare(right.timeframe);
      }
      return left.symbol.localeCompare(right.symbol);
    })
  });
});

apiRouter.get('/overview', (_request, response) => {
  const signals = storageService.getSignals().slice(0, 100);
  const summary = signals.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      accumulator[item.signal] += 1;
      if (item.actionable) {
        accumulator.actionable += 1;
      }
      if (item.aiAnalysis?.status === 'READY') {
        accumulator.aiReady += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      BUY: 0,
      SELL: 0,
      HOLD: 0,
      actionable: 0,
      aiReady: 0
    }
  );

  response.json({
    summary,
    analyzer: storageService.getAnalyzerState(),
    trackedSymbols: config.symbols,
    trackedTimeframes: config.timeframes,
    risk: {
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable
    },
    ai: aiAnalysisService.getStatus()
  });
});

apiRouter.get('/strategy', (_request, response) => {
  response.json({
    rules: strategyRules,
    meta: strategyMeta
  });
});

apiRouter.get('/ai/status', (_request, response) => {
  response.json(aiAnalysisService.getStatus());
});
