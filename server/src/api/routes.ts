import { Router } from 'express';
import { config } from '../config';
import { RecommendationType, SignalRecord } from '../types';
import { aiAnalysisService } from '../services/aiAnalysisService';
import { strategyMeta, strategyRules } from '../services/strategy';
import { storageService } from '../services/storage';

export const apiRouter = Router();

const recommendationWeight: Record<RecommendationType, number> = {
  BUY_NOW: 3,
  WAIT: 2,
  EXIT: 1
};

const sortSignals = (left: SignalRecord, right: SignalRecord): number => {
  const recommendationDiff = recommendationWeight[right.recommendation] - recommendationWeight[left.recommendation];
  if (recommendationDiff !== 0) {
    return recommendationDiff;
  }

  const confidenceDiff = right.confidence - left.confidence;
  if (confidenceDiff !== 0) {
    return confidenceDiff;
  }

  const turnoverDiff = right.market.turnover24hUsd - left.market.turnover24hUsd;
  if (turnoverDiff !== 0) {
    return turnoverDiff;
  }

  return left.symbol.localeCompare(right.symbol);
};

apiRouter.get('/health', (_request, response) => {
  response.json({
    ok: true,
    config: {
      scanIntervalMs: config.scanIntervalMs,
      bybitCategory: config.bybitCategory,
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable,
      openAiModel: config.openAiModel,
      aiAnalysisEnabled: config.aiAnalysisEnabled,
      aiAnalyzeHoldSignals: config.aiAnalyzeHoldSignals,
      maxSymbolsToAnalyze: config.maxSymbolsToAnalyze,
      minTurnover24hUsd: config.minTurnover24hUsd,
      maxSpreadPct: config.maxSpreadPct,
      timeframes: config.timeframes
    },
    analyzer: storageService.getAnalyzerState(),
    universe: storageService.getUniverseState(),
    ai: aiAnalysisService.getStatus()
  });
});

apiRouter.get('/signals', (request, response) => {
  const limit = Number(request.query.limit ?? 80);
  const symbol = typeof request.query.symbol === 'string' ? request.query.symbol : undefined;
  const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : undefined;
  const recommendation =
    typeof request.query.recommendation === 'string' ? request.query.recommendation.toUpperCase() : undefined;

  const filtered = storageService
    .getSignals()
    .filter((item) => (symbol ? item.symbol === symbol : true))
    .filter((item) => (timeframe ? item.timeframe === timeframe : true))
    .filter((item) => (recommendation ? item.recommendation === recommendation : true))
    .slice(0, limit);

  response.json({
    count: filtered.length,
    items: filtered
  });
});

apiRouter.get('/signals/latest', (_request, response) => {
  const latestMap = new Map<string, SignalRecord>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  response.json({
    items: Array.from(latestMap.values()).sort(sortSignals)
  });
});

apiRouter.get('/opportunities', (_request, response) => {
  const latestMap = new Map<string, SignalRecord>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  const latest = Array.from(latestMap.values()).sort(sortSignals);

  response.json({
    bestIdea: latest.find((item) => item.recommendation === 'BUY_NOW') ?? latest.find((item) => item.recommendation === 'WAIT') ?? null,
    buyNow: latest.filter((item) => item.recommendation === 'BUY_NOW').slice(0, 8),
    wait: latest.filter((item) => item.recommendation === 'WAIT').slice(0, 12),
    exit: latest.filter((item) => item.recommendation === 'EXIT').slice(0, 12)
  });
});

apiRouter.get('/overview', (_request, response) => {
  const latestMap = new Map<string, SignalRecord>();

  for (const item of storageService.getSignals()) {
    const key = `${item.symbol}:${item.timeframe}`;
    if (!latestMap.has(key)) {
      latestMap.set(key, item);
    }
  }

  const latestSignals = Array.from(latestMap.values());

  const summary = latestSignals.reduce(
    (accumulator, item) => {
      accumulator.total += 1;
      accumulator[item.recommendation] += 1;
      if (item.aiAnalysis?.status === 'READY') {
        accumulator.aiReady += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      BUY_NOW: 0,
      WAIT: 0,
      EXIT: 0,
      aiReady: 0
    }
  );

  response.json({
    summary,
    analyzer: storageService.getAnalyzerState(),
    universe: storageService.getUniverseState(),
    risk: {
      accountSizeUsd: config.accountSizeUsd,
      riskPerTradePct: config.riskPerTradePct,
      minConfidenceActionable: config.minConfidenceActionable
    },
    ai: aiAnalysisService.getStatus(),
    timeframes: config.timeframes
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
