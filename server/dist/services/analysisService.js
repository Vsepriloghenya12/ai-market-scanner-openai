"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisService = exports.AnalysisService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const indicators_1 = require("../utils/indicators");
const aiAnalysisService_1 = require("./aiAnalysisService");
const marketData_1 = require("./marketData");
const storage_1 = require("./storage");
class AnalysisService {
    async analyze(symbol, timeframe) {
        const candles = await marketData_1.marketDataService.fetchCandles(symbol, timeframe, 260);
        if (candles.length < 220) {
            throw new Error(`Недостаточно свечей для ${symbol}/${timeframe}`);
        }
        const price = candles.at(-1)?.close ?? 0;
        const indicators = (0, indicators_1.buildIndicatorSnapshot)(candles);
        const decision = (0, indicators_1.evaluateSignal)(price, indicators);
        const record = {
            id: node_crypto_1.default.randomUUID(),
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
        record.aiAnalysis = await aiAnalysisService_1.aiAnalysisService.analyzeSignal(record);
        storage_1.storageService.saveSignal(record);
        return record;
    }
}
exports.AnalysisService = AnalysisService;
exports.analysisService = new AnalysisService();
