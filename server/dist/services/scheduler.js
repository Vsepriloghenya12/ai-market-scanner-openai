"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerService = exports.SchedulerService = void 0;
const config_1 = require("../config");
const analysisService_1 = require("./analysisService");
const storage_1 = require("./storage");
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
            for (const symbol of config_1.config.symbols) {
                for (const timeframe of config_1.config.timeframes) {
                    try {
                        await analysisService_1.analysisService.analyze(symbol, timeframe);
                    }
                    catch (error) {
                        const message = error instanceof Error ? error.message : 'Неизвестная ошибка анализатора';
                        errors.push(`${symbol}/${timeframe}: ${message}`);
                        console.error(`Ошибка анализа для ${symbol}/${timeframe}:`, error);
                    }
                }
            }
            const current = storage_1.storageService.getAnalyzerState();
            storage_1.storageService.updateAnalyzerState({
                isRunning: false,
                lastRunAt: new Date().toISOString(),
                runCount: current.runCount + 1,
                lastError: errors.length > 0 ? errors.join(' | ') : null
            });
        }
        finally {
            this.running = false;
        }
    }
}
exports.SchedulerService = SchedulerService;
exports.schedulerService = new SchedulerService();
