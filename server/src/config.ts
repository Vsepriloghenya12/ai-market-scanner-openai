import path from 'node:path';
import { AppConfig } from './types';

const parseCsv = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parseOptionalString = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3001),
  symbols: parseCsv(process.env.MARKET_SYMBOLS, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']),
  timeframes: parseCsv(process.env.MARKET_TIMEFRAMES, ['15', '60']),
  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS ?? 60_000),
  bybitCategory: process.env.BYBIT_CATEGORY ?? 'linear',
  historyLimit: Number(process.env.HISTORY_LIMIT ?? 500),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  storageFile: process.env.STORAGE_FILE
    ? path.resolve(process.cwd(), process.env.STORAGE_FILE)
    : path.resolve(process.cwd(), 'data', 'market-state.json'),
  accountSizeUsd: Number(process.env.ACCOUNT_SIZE_USD ?? 10000),
  riskPerTradePct: Number(process.env.RISK_PER_TRADE_PCT ?? 1),
  minConfidenceActionable: Number(process.env.MIN_CONFIDENCE_ACTIONABLE ?? 0.67),
  openAiApiKey: parseOptionalString(process.env.OPENAI_API_KEY),
  openAiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini',
  aiAnalysisEnabled: parseBoolean(process.env.AI_ANALYSIS_ENABLED, true),
  aiAnalyzeHoldSignals: parseBoolean(process.env.AI_ANALYZE_HOLD_SIGNALS, false)
};
