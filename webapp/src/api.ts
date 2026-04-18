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
  recommendation: 'BUY_NOW' | 'WAIT' | 'EXIT';
  confidence: number;
  score: number;
  price: number;
  createdAt: string;
  regime: 'BULL' | 'BEAR' | 'RANGE';
  setup: 'BREAKOUT' | 'PULLBACK' | 'BREAKDOWN' | 'NONE';
  actionable: boolean;
  headline: string;
  shortText: string;
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
  market: {
    symbol: string;
    rank24h: number;
    turnover24hUsd: number;
    volume24h: number;
    spreadPct: number;
    lastPrice: number;
    fundingRate: number | null;
  };
  tradePlan: TradePlan | null;
  aiAnalysis: AIAnalysis | null;
}

export interface OverviewResponse {
  summary: {
    total: number;
    BUY_NOW: number;
    WAIT: number;
    EXIT: number;
    aiReady: number;
  };
  analyzer: AnalyzerState;
  universe: UniverseState;
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
  timeframes: string[];
}

export interface OpportunitiesResponse {
  bestIdea: SignalItem | null;
  buyNow: SignalItem[];
  wait: SignalItem[];
  exit: SignalItem[];
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
  getOpportunities: () => request<OpportunitiesResponse>('/api/opportunities'),
  getSignals: (limit = 100) => request<{ items: SignalItem[] }>(`/api/signals?limit=${limit}`),
  getHealth: () => request<{ analyzer: AnalyzerState; config: Record<string, unknown> }>('/api/health'),
  getAiStatus: () => request<OverviewResponse['ai']>('/api/ai/status')
};
