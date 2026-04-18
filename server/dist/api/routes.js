"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const aiAnalysisService_1 = require("../services/aiAnalysisService");
const strategy_1 = require("../services/strategy");
const storage_1 = require("../services/storage");
exports.apiRouter = (0, express_1.Router)();
const recommendationWeight = {
    BUY_NOW: 3,
    WAIT: 2,
    EXIT: 1
};
const sortSignals = (left, right) => {
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
exports.apiRouter.get('/health', (_request, response) => {
    response.json({
        ok: true,
        config: {
            scanIntervalMs: config_1.config.scanIntervalMs,
            bybitCategory: config_1.config.bybitCategory,
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable,
            openAiModel: config_1.config.openAiModel,
            aiAnalysisEnabled: config_1.config.aiAnalysisEnabled,
            aiAnalyzeHoldSignals: config_1.config.aiAnalyzeHoldSignals,
            maxSymbolsToAnalyze: config_1.config.maxSymbolsToAnalyze,
            minTurnover24hUsd: config_1.config.minTurnover24hUsd,
            maxSpreadPct: config_1.config.maxSpreadPct,
            timeframes: config_1.config.timeframes
        },
        analyzer: storage_1.storageService.getAnalyzerState(),
        universe: storage_1.storageService.getUniverseState(),
        ai: aiAnalysisService_1.aiAnalysisService.getStatus()
    });
});
exports.apiRouter.get('/signals', (request, response) => {
    const limit = Number(request.query.limit ?? 80);
    const symbol = typeof request.query.symbol === 'string' ? request.query.symbol : undefined;
    const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : undefined;
    const recommendation = typeof request.query.recommendation === 'string' ? request.query.recommendation.toUpperCase() : undefined;
    const filtered = storage_1.storageService
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
exports.apiRouter.get('/signals/latest', (_request, response) => {
    const latestMap = new Map();
    for (const item of storage_1.storageService.getSignals()) {
        const key = `${item.symbol}:${item.timeframe}`;
        if (!latestMap.has(key)) {
            latestMap.set(key, item);
        }
    }
    response.json({
        items: Array.from(latestMap.values()).sort(sortSignals)
    });
});
exports.apiRouter.get('/opportunities', (_request, response) => {
    const latestMap = new Map();
    for (const item of storage_1.storageService.getSignals()) {
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
exports.apiRouter.get('/overview', (_request, response) => {
    const latestMap = new Map();
    for (const item of storage_1.storageService.getSignals()) {
        const key = `${item.symbol}:${item.timeframe}`;
        if (!latestMap.has(key)) {
            latestMap.set(key, item);
        }
    }
    const latestSignals = Array.from(latestMap.values());
    const summary = latestSignals.reduce((accumulator, item) => {
        accumulator.total += 1;
        accumulator[item.recommendation] += 1;
        if (item.aiAnalysis?.status === 'READY') {
            accumulator.aiReady += 1;
        }
        return accumulator;
    }, {
        total: 0,
        BUY_NOW: 0,
        WAIT: 0,
        EXIT: 0,
        aiReady: 0
    });
    response.json({
        summary,
        analyzer: storage_1.storageService.getAnalyzerState(),
        universe: storage_1.storageService.getUniverseState(),
        risk: {
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable
        },
        ai: aiAnalysisService_1.aiAnalysisService.getStatus(),
        timeframes: config_1.config.timeframes
    });
});
exports.apiRouter.get('/strategy', (_request, response) => {
    response.json({
        rules: strategy_1.strategyRules,
        meta: strategy_1.strategyMeta
    });
});
exports.apiRouter.get('/ai/status', (_request, response) => {
    response.json(aiAnalysisService_1.aiAnalysisService.getStatus());
});
