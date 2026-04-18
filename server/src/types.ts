export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type RecommendationType = 'BUY_NOW' | 'WAIT' | 'EXIT';
export type MarketRegime = 'BULL' | 'BEAR' | 'RANGE';
export type SetupType = 'BREAKOUT' | 'PULLBACK' | 'BREAKDOWN' | 'NONE';
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

export interface MarketSnapshot {
  symbol: string;
  rank24h: number;
  turnover24hUsd: number;
  volume24h: number;
  spreadPct: number;
  lastPrice: number;
  fundingRate: number | null;
}

export interface TradePlan {
  entry: number;
  entryMin: number;
  entryMax: number;
  triggerPrice: number | null;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskRewardRatio: number;
  riskAmountUsd: number;
  suggestedPositionUnits: number;
  invalidation: string;
  entryComment: string;
  exitComment: string;
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
  recommendation: RecommendationType;
  confidence: number;
  score: number;
  price: number;
  createdAt: string;
  regime: MarketRegime;
  setup: SetupType;
  actionable: boolean;
  headline: string;
  shortText: string;
  reason: string[];
  indicators: IndicatorSnapshot;
  market: MarketSnapshot;
  tradePlan: TradePlan | null;
  aiAnalysis: AIAnalysis | null;
}

export interface AnalyzerState {
  lastRunAt: string | null;
  isRunning: boolean;
  runCount: number;
  lastError: string | null;
}

export interface UniverseState {
  fetchedAt: string | null;
  totalSymbols: number;
  eligibleSymbols: number;
  analyzedSymbols: number;
  topSymbols: string[];
  minTurnoverUsd: number;
  maxSymbolsToAnalyze: number;
}

export interface StrategyRule {
  id: string;
  title: string;
  description: string;
}

export interface AppConfig {
  port: number;
  scanIntervalMs: number;
  bybitCategory: string;
  historyLimit: number;
  corsOrigin: string;
  storageFile: string;
  accountSizeUsd: number;
  riskPerTradePct: number;
  minConfidenceActionable: number;
  quoteCoin: string;
  maxSymbolsToAnalyze: number;
  minTurnover24hUsd: number;
  maxSpreadPct: number;
  openAiApiKey: string | null;
  openAiModel: string;
  aiAnalysisEnabled: boolean;
  aiAnalyzeHoldSignals: boolean;
  timeframes: string[];
}

export interface StoredState {
  signals: SignalRecord[];
  analyzer: AnalyzerState;
  universe: UniverseState;
}
