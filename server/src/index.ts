import { createApp } from './app';
import { config } from './config';
import { schedulerService } from './services/scheduler';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Сервер сканера рынка с ИИ запущен на порту ${config.port}`);
  console.log(`Отслеживаемые инструменты: ${config.symbols.join(', ')}`);
  console.log(`Отслеживаемые таймфреймы: ${config.timeframes.join(', ')}`);
  schedulerService.start();
});

const shutdown = () => {
  schedulerService.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
