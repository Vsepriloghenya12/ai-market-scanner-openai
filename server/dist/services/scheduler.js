"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerService = exports.SchedulerService = void 0;
const config_1 = require("../config");
const analysisService_1 = require("./analysisService");
const marketData_1 = require("./marketData");
const storage_1 = require("./storage");
const runWithConcurrency = async (items, limit, handler) => {
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
class SchedulerService {
    timer = null;
    running = false;
    start() {
        this.runCycle().catch((error) => {
            console.error('Первый запуск планировщика завершился ошибкой:', error);
        });
        this.timer = setInterval(() => {
            this.runCycle().catch((error) => {
                console.error('Плановый цикл завершился ошибкой:', error);
            });
        }, config_1.config.scanIntervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async runCycle() {
        if (this.running) {
            return;
        }
        this.running = true;
        storage_1.storageService.updateAnalyzerState({ isRunning: true, lastError: null });
        const errors = [];
        try {
            const universe = await marketData_1.marketDataService.fetchUniverse();
            const jobs = universe.items.flatMap((market) => config_1.config.timeframes.map((timeframe) => ({ market, timeframe })));
            storage_1.storageService.updateUniverseState({
                fetchedAt: new Date().toISOString(),
                totalSymbols: universe.totalSymbols,
                eligibleSymbols: universe.eligibleSymbols,
                analyzedSymbols: universe.items.length,
                topSymbols: universe.items.slice(0, 12).map((item) => item.symbol),
                minTurnoverUsd: config_1.config.minTurnover24hUsd,
                maxSymbolsToAnalyze: config_1.config.maxSymbolsToAnalyze
            });
            await runWithConcurrency(jobs, 4, async ({ market, timeframe }) => {
                try {
                    await analysisService_1.analysisService.analyze(market, timeframe);
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализатора';
                    errors.push(`${market.symbol}/${timeframe}: ${message}`);
                    console.error(`Ошибка анализа для ${market.symbol}/${timeframe}:`, error);
                }
            });
            const current = storage_1.storageService.getAnalyzerState();
            storage_1.storageService.updateAnalyzerState({
                isRunning: false,
                lastRunAt: new Date().toISOString(),
                runCount: current.runCount + 1,
                lastError: errors.length > 0 ? errors.slice(0, 20).join(' | ') : null
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализа рынка';
            const current = storage_1.storageService.getAnalyzerState();
            storage_1.storageService.updateAnalyzerState({
                isRunning: false,
                lastRunAt: new Date().toISOString(),
                runCount: current.runCount + 1,
                lastError: message
            });
            console.error('Ошибка при обновлении рынка:', error);
        }
        finally {
            this.running = false;
        }
    }
}
exports.SchedulerService = SchedulerService;
exports.schedulerService = new SchedulerService();
