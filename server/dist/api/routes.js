"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const aiAnalysisService_1 = require("../services/aiAnalysisService");
const strategy_1 = require("../services/strategy");
const storage_1 = require("../services/storage");
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.get('/health', (_request, response) => {
    response.json({
        ok: true,
        config: {
            symbols: config_1.config.symbols,
            timeframes: config_1.config.timeframes,
            scanIntervalMs: config_1.config.scanIntervalMs,
            bybitCategory: config_1.config.bybitCategory,
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable,
            openAiModel: config_1.config.openAiModel,
            aiAnalysisEnabled: config_1.config.aiAnalysisEnabled,
            aiAnalyzeHoldSignals: config_1.config.aiAnalyzeHoldSignals
        },
        analyzer: storage_1.storageService.getAnalyzerState(),
        ai: aiAnalysisService_1.aiAnalysisService.getStatus()
    });
});
exports.apiRouter.get('/signals', (request, response) => {
    const limit = Number(request.query.limit ?? 50);
    const symbol = typeof request.query.symbol === 'string' ? request.query.symbol : undefined;
    const timeframe = typeof request.query.timeframe === 'string' ? request.query.timeframe : undefined;
    const filtered = storage_1.storageService
        .getSignals()
        .filter((item) => (symbol ? item.symbol === symbol : true))
        .filter((item) => (timeframe ? item.timeframe === timeframe : true))
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
        items: Array.from(latestMap.values()).sort((left, right) => {
            if (left.symbol === right.symbol) {
                return left.timeframe.localeCompare(right.timeframe);
            }
            return left.symbol.localeCompare(right.symbol);
        })
    });
});
exports.apiRouter.get('/overview', (_request, response) => {
    const signals = storage_1.storageService.getSignals().slice(0, 100);
    const summary = signals.reduce((accumulator, item) => {
        accumulator.total += 1;
        accumulator[item.signal] += 1;
        if (item.actionable) {
            accumulator.actionable += 1;
        }
        if (item.aiAnalysis?.status === 'READY') {
            accumulator.aiReady += 1;
        }
        return accumulator;
    }, {
        total: 0,
        BUY: 0,
        SELL: 0,
        HOLD: 0,
        actionable: 0,
        aiReady: 0
    });
    response.json({
        summary,
        analyzer: storage_1.storageService.getAnalyzerState(),
        trackedSymbols: config_1.config.symbols,
        trackedTimeframes: config_1.config.timeframes,
        risk: {
            accountSizeUsd: config_1.config.accountSizeUsd,
            riskPerTradePct: config_1.config.riskPerTradePct,
            minConfidenceActionable: config_1.config.minConfidenceActionable
        },
        ai: aiAnalysisService_1.aiAnalysisService.getStatus()
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
