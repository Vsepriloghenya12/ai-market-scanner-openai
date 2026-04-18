export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type MarketRegime = 'BULL' | 'BEAR' | 'RANGE';
export type SetupType = 'TREND_BREAKOUT' | 'TREND_PULLBACK' | 'BREAKDOWN' | 'NONE';
export type AIAnalysisStatus = 'READY' | 'SKIPPED' | 'ERROR';
export type AIAlignment = 'ALIGNED' | 'MIXED' | 'CONTRARIAN';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorSnapshot {
  emaFast: number;
  emaMedium: number;
  emaTrend: number;
  rsi: number;
  atr: number;
  adx: number;
  momentumPct: number;
  volatilityPct: number;
  volumeRatio: number;
  swingHigh20: number;
  swingLow20: number;
  trendGapPct: number;
}

export interface TradePlan {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  riskAmountUsd: number;
  suggestedPositionUnits: number;
  invalidation: string;
}

export interface AIAnalysis {
  status: AIAnalysisStatus;
  provider: 'openai';
  model: string | null;
  generatedAt: string;
  verdict: SignalType;
  confidence: number | null;
  alignmentWithRules: AIAlignment;
  summary: string;
  marketNarrative: string;
  strengths: string[];
  risks: string[];
  checklist: string[];
  entryStyle: string;
  exitStyle: string;
  invalidation: string;
  positionSizingNote: string;
  nextAction: string;
  error: string | null;
}

export interface SignalRecord {
  id: string;
  symbol: string;
  timeframe: string;
  signal: SignalType;
  confidence: number;
  score: number;
  price: number;
  createdAt: string;
  regime: MarketRegime;
  setup: SetupType;
  actionable: boolean;
  reason: string[];
  indicators: IndicatorSnapshot;
  tradePlan: TradePlan | null;
  aiAnalysis: AIAnalysis | null;
}

export interface AnalyzerState {
  lastRunAt: string | null;
  isRunning: boolean;
  runCount: number;
  lastError: string | null;
}

export interface StrategyRule {
  id: string;
  title: string;
  description: string;
}

export interface AppConfig {
  port: number;
  symbols: string[];
  timeframes: string[];
  scanIntervalMs: number;
  bybitCategory: string;
  historyLimit: number;
  corsOrigin: string;
  storageFile: string;
  accountSizeUsd: number;
  riskPerTradePct: number;
  minConfidenceActionable: number;
  openAiApiKey: string | null;
  openAiModel: string;
  aiAnalysisEnabled: boolean;
  aiAnalyzeHoldSignals: boolean;
}

export interface StoredState {
  signals: SignalRecord[];
  analyzer: AnalyzerState;
}
