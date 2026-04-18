export interface AnalyzerState {
  lastRunAt: string | null;
  isRunning: boolean;
  runCount: number;
  lastError: string | null;
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
  status: 'READY' | 'SKIPPED' | 'ERROR';
  provider: 'openai';
  model: string | null;
  generatedAt: string;
  verdict: 'BUY' | 'SELL' | 'HOLD';
  confidence: number | null;
  alignmentWithRules: 'ALIGNED' | 'MIXED' | 'CONTRARIAN';
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

export interface SignalItem {
  id: string;
  symbol: string;
  timeframe: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  score: number;
  price: number;
  createdAt: string;
  regime: 'BULL' | 'BEAR' | 'RANGE';
  setup: 'TREND_BREAKOUT' | 'TREND_PULLBACK' | 'BREAKDOWN' | 'NONE';
  actionable: boolean;
  reason: string[];
  indicators: {
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
  };
  tradePlan: TradePlan | null;
  aiAnalysis: AIAnalysis | null;
}

export interface OverviewResponse {
  summary: {
    total: number;
    BUY: number;
    SELL: number;
    HOLD: number;
    actionable: number;
    aiReady: number;
  };
  analyzer: AnalyzerState;
  trackedSymbols: string[];
  trackedTimeframes: string[];
  risk: {
    accountSizeUsd: number;
    riskPerTradePct: number;
    minConfidenceActionable: number;
  };
  ai: {
    enabled: boolean;
    configured: boolean;
    ready: boolean;
    model: string;
    analyzeHoldSignals: boolean;
  };
}

export interface StrategyResponse {
  rules: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  meta: {
    adxThreshold: number;
    highVolatilityThresholdPct: number;
    rewardTargetsR: number[];
    accountSizeUsd: number;
    riskPerTradePct: number;
    minConfidenceActionable: number;
  };
}

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Ошибка запроса: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const api = {
  getOverview: () => request<OverviewResponse>('/api/overview'),
  getLatestSignals: () => request<{ items: SignalItem[] }>('/api/signals/latest'),
  getSignals: (limit = 100) => request<{ items: SignalItem[] }>(`/api/signals?limit=${limit}`),
  getHealth: () => request<{ analyzer: AnalyzerState; config: Record<string, unknown> }>('/api/health'),
  getStrategy: () => request<StrategyResponse>('/api/strategy'),
  getAiStatus: () => request<OverviewResponse['ai']>('/api/ai/status')
};
