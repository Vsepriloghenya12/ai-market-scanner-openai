import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { AnalyzerState, SignalRecord, StoredState } from '../types';

const defaultAnalyzerState: AnalyzerState = {
  lastRunAt: null,
  isRunning: false,
  runCount: 0,
  lastError: null
};

const ensureStorageDir = (): void => {
  const directory = path.dirname(config.storageFile);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const defaultState = (): StoredState => ({
  signals: [],
  analyzer: { ...defaultAnalyzerState }
});

export class StorageService {
  private state: StoredState;

  constructor() {
    ensureStorageDir();
    this.state = this.load();
  }

  private load(): StoredState {
    if (!fs.existsSync(config.storageFile)) {
      const initial = defaultState();
      fs.writeFileSync(config.storageFile, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }

    try {
      const raw = fs.readFileSync(config.storageFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      return {
        signals: parsed.signals ?? [],
        analyzer: {
          ...defaultAnalyzerState,
          ...(parsed.analyzer ?? {})
        }
      };
    } catch (error) {
      console.error('Failed to read storage file, using defaults.', error);
      return defaultState();
    }
  }

  private persist(): void {
    fs.writeFileSync(config.storageFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  public getSignals(): SignalRecord[] {
    return [...this.state.signals].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  public saveSignal(signal: SignalRecord): void {
    this.state.signals.unshift(signal);
    this.state.signals = this.state.signals.slice(0, config.historyLimit);
    this.persist();
  }

  public getAnalyzerState(): AnalyzerState {
    return { ...this.state.analyzer };
  }

  public updateAnalyzerState(nextState: Partial<AnalyzerState>): void {
    this.state.analyzer = {
      ...this.state.analyzer,
      ...nextState
    };
    this.persist();
  }
}

export const storageService = new StorageService();
