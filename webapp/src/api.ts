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

export interface SignalItem {
  id: string;
  symbol: string;
  timeframe: string;
  recommendation: 'BUY_NOW' | 'WAIT' | 'EXIT';
  confidence: number;
  price: number;
  createdAt: string;
  headline: string;
  shortText: string;
  tradePlan: TradePlan | null;
  reason: string[];
}

export interface OpportunitiesResponse {
  bestIdea: SignalItem | null;
  buyNow: SignalItem[];
  wait: SignalItem[];
  exit: SignalItem[];
}

export interface PaperPosition {
  id: string;
  symbol: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  timeframe: string;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  closeReason: string;
  closedAt: string;
}

export interface PaperState {
  summary: {
    startingBalanceUsd: number;
    balanceUsd: number;
    closedTrades: number;
    openPositions: number;
    winRate: number;
    totalPnlUsd: number;
    totalFeesUsd: number;
    lastEventAt: string | null;
  };
  openPositions: PaperPosition[];
  closedTrades: PaperTrade[];
}

export interface HealthResponse {
  analyzer: AnalyzerState;
  universe: UniverseState;
  paper: PaperState['summary'];
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`Ошибка запроса: ${response.status}`);
  }
  return (await response.json()) as T;
};

export const api = {
  getHealth: () => request<HealthResponse>('/api/health'),
  getOpportunities: () => request<OpportunitiesResponse>('/api/opportunities'),
  getPaper: () => request<PaperState>('/api/paper'),
  getSignalsLatest: () => request<{ items: SignalItem[] }>('/api/signals/latest'),
  resetPaper: () => request<PaperState>('/api/paper/reset', { method: 'POST' })
};


export const downloadFullExport = (): void => {
  window.location.href = '/api/export/full';
};
