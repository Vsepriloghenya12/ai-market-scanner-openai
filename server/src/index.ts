import { createApp } from './app';
import { config } from './config';
import { schedulerService } from './services/scheduler';

const app = createApp();

const host = '0.0.0.0';

app.listen(config.port, host, () => {
  console.log(`Сервер сканера рынка с ИИ запущен на ${host}:${config.port}`);
  console.log(`Отслеживаемые инструменты: ${config.symbols.join(', ')}`);
  console.log(`Отслеживаемые таймфреймы: ${config.timeframes.join(', ')}`);

  setTimeout(() => {
    schedulerService.start();
  }, 3000);
});

const shutdown = () => {
  schedulerService.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
