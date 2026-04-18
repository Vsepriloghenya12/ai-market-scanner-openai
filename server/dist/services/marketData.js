"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketDataService = exports.MarketDataService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const bybitClient = axios_1.default.create({
    baseURL: 'https://api.bybit.com',
    timeout: 15_000
});
class MarketDataService {
    async fetchCandles(symbol, interval, limit = 200) {
        const response = await bybitClient.get('/v5/market/kline', {
            params: {
                category: config_1.config.bybitCategory,
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
exports.MarketDataService = MarketDataService;
exports.marketDataService = new MarketDataService();
