"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const scheduler_1 = require("./services/scheduler");
const app = (0, app_1.createApp)();
const host = '0.0.0.0';
app.listen(config_1.config.port, host, () => {
    console.log(`Сервер сканера рынка с ИИ запущен на ${host}:${config_1.config.port}`);
    console.log(`Отслеживаемые инструменты: ${config_1.config.symbols.join(', ')}`);
    console.log(`Отслеживаемые таймфреймы: ${config_1.config.timeframes.join(', ')}`);
    setTimeout(() => {
        scheduler_1.schedulerService.start();
    }, 3000);
});
const shutdown = () => {
    scheduler_1.schedulerService.stop();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
