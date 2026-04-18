import { config } from '../config';
import { MarketSnapshot } from '../types';
import { analysisService } from './analysisService';
import { marketDataService } from './marketData';
import { storageService } from './storage';

const runWithConcurrency = async <T>(items: T[], limit: number, handler: (item: T) => Promise<void>): Promise<void> => {
  const queue = [...items];

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        return;
      }
      await handler(item);
    }
  });

  await Promise.all(workers);
};

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public start(): void {
    this.runCycle().catch((error) => {
      console.error('Первый запуск планировщика завершился ошибкой:', error);
    });

    this.timer = setInterval(() => {
      this.runCycle().catch((error) => {
        console.error('Плановый цикл завершился ошибкой:', error);
      });
    }, config.scanIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runCycle(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    storageService.updateAnalyzerState({ isRunning: true, lastError: null });

    const errors: string[] = [];

    try {
      const universe = await marketDataService.fetchUniverse();
      const jobs = universe.items.flatMap((market) => config.timeframes.map((timeframe) => ({ market, timeframe })));

      storageService.updateUniverseState({
        fetchedAt: new Date().toISOString(),
        totalSymbols: universe.totalSymbols,
        eligibleSymbols: universe.eligibleSymbols,
        analyzedSymbols: universe.items.length,
        topSymbols: universe.items.slice(0, 12).map((item) => item.symbol),
        minTurnoverUsd: config.minTurnover24hUsd,
        maxSymbolsToAnalyze: config.maxSymbolsToAnalyze
      });

      await runWithConcurrency(jobs, 4, async ({ market, timeframe }) => {
        try {
          await analysisService.analyze(market, timeframe);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализатора';
          errors.push(`${market.symbol}/${timeframe}: ${message}`);
          console.error(`Ошибка анализа для ${market.symbol}/${timeframe}:`, error);
        }
      });

      const current = storageService.getAnalyzerState();
      storageService.updateAnalyzerState({
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        runCount: current.runCount + 1,
        lastError: errors.length > 0 ? errors.slice(0, 20).join(' | ') : null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализа рынка';
      const current = storageService.getAnalyzerState();
      storageService.updateAnalyzerState({
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        runCount: current.runCount + 1,
        lastError: message
      });
      console.error('Ошибка при обновлении рынка:', error);
    } finally {
      this.running = false;
    }
  }
}

export const schedulerService = new SchedulerService();
