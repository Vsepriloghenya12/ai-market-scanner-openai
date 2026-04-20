"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const node_path_1 = __importDefault(require("node:path"));
const parseCsv = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};
const parseBoolean = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};
const parseOptionalString = (value) => {
    if (!value) {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};
exports.config = {
    port: Number(process.env.PORT ?? 3001),
    scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS ?? 180_000),
    bybitCategory: process.env.BYBIT_CATEGORY ?? 'linear',
    historyLimit: Number(process.env.HISTORY_LIMIT ?? 1000),
    corsOrigin: process.env.CORS_ORIGIN ?? '*',
    storageFile: process.env.STORAGE_FILE
        ? node_path_1.default.resolve(process.cwd(), process.env.STORAGE_FILE)
        : node_path_1.default.resolve(process.cwd(), 'data', 'market-state.json'),
    accountSizeUsd: Number(process.env.ACCOUNT_SIZE_USD ?? 100),
    riskPerTradePct: Number(process.env.RISK_PER_TRADE_PCT ?? 1),
    minConfidenceActionable: Number(process.env.MIN_CONFIDENCE_ACTIONABLE ?? 0.68),
    quoteCoin: process.env.MARKET_QUOTE_COIN?.trim() || 'USDT',
    maxSymbolsToAnalyze: Number(process.env.MAX_SYMBOLS_TO_ANALYZE ?? 20),
    minTurnover24hUsd: Number(process.env.MIN_TURNOVER_24H_USD ?? 2_000_000),
    maxSpreadPct: Number(process.env.MAX_SPREAD_PCT ?? 0.45),
    openAiApiKey: parseOptionalString(process.env.OPENAI_API_KEY),
    openAiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini',
    aiAnalysisEnabled: parseBoolean(process.env.AI_ANALYSIS_ENABLED, true),
    aiAnalyzeHoldSignals: parseBoolean(process.env.AI_ANALYZE_HOLD_SIGNALS, false),
    timeframes: parseCsv(process.env.MARKET_TIMEFRAMES, ['15', '60']),
    paperStartingBalanceUsd: Number(process.env.PAPER_STARTING_BALANCE_USD ?? process.env.ACCOUNT_SIZE_USD ?? 100),
    paperMaxClosedTrades: Number(process.env.PAPER_MAX_CLOSED_TRADES ?? 200),
    simulationFeePct: Number(process.env.SIMULATION_FEE_PCT ?? 0.055),
    backtestCandles: Number(process.env.BACKTEST_CANDLES ?? 320),
    backtestWarmup: Number(process.env.BACKTEST_WARMUP ?? 220),
    backtestMaxSymbols: Number(process.env.BACKTEST_MAX_SYMBOLS ?? 8),
    backtestMaxHoldCandles: Number(process.env.BACKTEST_MAX_HOLD_CANDLES ?? 36),
    backtestStartingBalanceUsd: Number(process.env.BACKTEST_STARTING_BALANCE_USD ?? process.env.ACCOUNT_SIZE_USD ?? 100)
};
