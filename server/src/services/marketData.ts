import axios from 'axios';
import { config } from '../config';
import { Candle } from '../types';

interface BybitKlineResponse {
  retCode: number;
  retMsg: string;
  result?: {
    list: string[][];
  };
}

const bybitClient = axios.create({
  baseURL: 'https://api.bybit.com',
  timeout: 15_000
});

export class MarketDataService {
  public async fetchCandles(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
    const response = await bybitClient.get<BybitKlineResponse>('/v5/market/kline', {
      params: {
        category: config.bybitCategory,
        symbol,
        interval,
        limit
      }
    });

    const payload = response.data;

    if (payload.retCode !== 0 || !payload.result?.list) {
      throw new Error(`Ошибка Bybit для ${symbol}/${interval}: ${payload.retMsg}`);
    }

    return payload.result.list
      .map((item) => ({
        timestamp: Number(item[0]),
        open: Number(item[1]),
        high: Number(item[2]),
        low: Number(item[3]),
        close: Number(item[4]),
        volume: Number(item[5])
      }))
      .sort((left, right) => left.timestamp - right.timestamp);
  }
}

export const marketDataService = new MarketDataService();
