import { config } from '../config';
import { analysisService } from './analysisService';
import { storageService } from './storage';

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
      for (const symbol of config.symbols) {
        for (const timeframe of config.timeframes) {
          try {
            await analysisService.analyze(symbol, timeframe);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализатора';
            errors.push(`${symbol}/${timeframe}: ${message}`);
            console.error(`Ошибка анализа для ${symbol}/${timeframe}:`, error);
          }
        }
      }

      const current = storageService.getAnalyzerState();
      storageService.updateAnalyzerState({
        isRunning: false,
        lastRunAt: new Date().toISOString(),
        runCount: current.runCount + 1,
        lastError: errors.length > 0 ? errors.join(' | ') : null
      });
    } finally {
      this.running = false;
    }
  }
}

export const schedulerService = new SchedulerService();
