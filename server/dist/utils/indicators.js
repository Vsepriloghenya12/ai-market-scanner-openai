"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateSignal = exports.buildIndicatorSnapshot = exports.calculateVolatilityPct = exports.calculateADX = exports.calculateATR = exports.calculateRSI = exports.calculateEMA = void 0;
const config_1 = require("../config");
const average = (values) => {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};
const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, value));
};
const max = (values) => {
    return values.length > 0 ? Math.max(...values) : 0;
};
const min = (values) => {
    return values.length > 0 ? Math.min(...values) : 0;
};
const calculateEMA = (values, period) => {
    if (values.length === 0) {
        return 0;
    }
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    for (let index = 1; index < values.length; index += 1) {
        ema = (values[index] - ema) * multiplier + ema;
    }
    return ema;
};
exports.calculateEMA = calculateEMA;
const calculateRSI = (values, period) => {
    if (values.length <= period) {
        return 50;
    }
    let gains = 0;
    let losses = 0;
    for (let index = values.length - period; index < values.length; index += 1) {
        const prev = values[index - 1];
        const current = values[index];
        const delta = current - prev;
        if (delta >= 0) {
            gains += delta;
        }
        else {
            losses += Math.abs(delta);
        }
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) {
        return 100;
    }
    const relativeStrength = avgGain / avgLoss;
    return 100 - 100 / (1 + relativeStrength);
};
exports.calculateRSI = calculateRSI;
const calculateATR = (candles, period) => {
    if (candles.length <= period) {
        return 0;
    }
    const trueRanges = [];
    for (let index = 1; index < candles.length; index += 1) {
        const current = candles[index];
        const previous = candles[index - 1];
        const highLow = current.high - current.low;
        const highClose = Math.abs(current.high - previous.close);
        const lowClose = Math.abs(current.low - previous.close);
        trueRanges.push(Math.max(highLow, highClose, lowClose));
    }
    return average(trueRanges.slice(-period));
};
exports.calculateATR = calculateATR;
const calculateADX = (candles, period) => {
    if (candles.length <= period + 1) {
        return 0;
    }
    const trueRanges = [];
    const plusDMs = [];
    const minusDMs = [];
    for (let index = 1; index < candles.length; index += 1) {
        const current = candles[index];
        const previous = candles[index - 1];
        const upMove = current.high - previous.high;
        const downMove = previous.low - current.low;
        plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
        const highLow = current.high - current.low;
        const highClose = Math.abs(current.high - previous.close);
        const lowClose = Math.abs(current.low - previous.close);
        trueRanges.push(Math.max(highLow, highClose, lowClose));
    }
    if (trueRanges.length <= period) {
        return 0;
    }
    let smoothedTR = trueRanges.slice(0, period).reduce((sum, value) => sum + value, 0);
    let smoothedPlusDM = plusDMs.slice(0, period).reduce((sum, value) => sum + value, 0);
    let smoothedMinusDM = minusDMs.slice(0, period).reduce((sum, value) => sum + value, 0);
    const dxValues = [];
    for (let index = period; index < trueRanges.length; index += 1) {
        smoothedTR = smoothedTR - smoothedTR / period + trueRanges[index];
        smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[index];
        smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[index];
        if (smoothedTR === 0) {
            dxValues.push(0);
            continue;
        }
        const plusDI = (100 * smoothedPlusDM) / smoothedTR;
        const minusDI = (100 * smoothedMinusDM) / smoothedTR;
        const diSum = plusDI + minusDI;
        if (diSum === 0) {
            dxValues.push(0);
            continue;
        }
        const dx = (100 * Math.abs(plusDI - minusDI)) / diSum;
        dxValues.push(dx);
    }
    if (dxValues.length === 0) {
        return 0;
    }
    if (dxValues.length <= period) {
        return average(dxValues);
    }
    let adx = average(dxValues.slice(0, period));
    for (let index = period; index < dxValues.length; index += 1) {
        adx = ((adx * (period - 1)) + dxValues[index]) / period;
    }
    return adx;
};
exports.calculateADX = calculateADX;
const calculateVolatilityPct = (values, lookback = 20) => {
    const sliced = values.slice(-(lookback + 1));
    if (sliced.length < 2) {
        return 0;
    }
    const returns = sliced.slice(1).map((value, index) => (value - sliced[index]) / sliced[index]);
    const mean = average(returns);
    const variance = average(returns.map((item) => (item - mean) ** 2));
    return Math.sqrt(variance) * 100;
};
exports.calculateVolatilityPct = calculateVolatilityPct;
const buildIndicatorSnapshot = (candles) => {
    const closes = candles.map((candle) => candle.close);
    const highs = candles.map((candle) => candle.high);
    const lows = candles.map((candle) => candle.low);
    const volumes = candles.map((candle) => candle.volume);
    const lastClose = closes.at(-1) ?? 0;
    const previousClose = closes.at(-11) ?? closes.at(-2) ?? lastClose;
    const momentumPct = previousClose === 0 ? 0 : ((lastClose - previousClose) / previousClose) * 100;
    const volumeBaseline = average(volumes.slice(-21, -1));
    const lastVolume = volumes.at(-1) ?? 0;
    const volumeRatio = volumeBaseline > 0 ? lastVolume / volumeBaseline : 1;
    const previousHighs = highs.slice(-21, -1);
    const previousLows = lows.slice(-21, -1);
    const emaFast = (0, exports.calculateEMA)(closes.slice(-80), 20);
    const emaMedium = (0, exports.calculateEMA)(closes.slice(-140), 50);
    const emaTrend = (0, exports.calculateEMA)(closes, 200);
    const trendGapPct = lastClose === 0 ? 0 : ((emaFast - emaTrend) / lastClose) * 100;
    return {
        emaFast,
        emaMedium,
        emaTrend,
        rsi: (0, exports.calculateRSI)(closes, 14),
        atr: (0, exports.calculateATR)(candles, 14),
        adx: (0, exports.calculateADX)(candles, 14),
        momentumPct,
        volatilityPct: (0, exports.calculateVolatilityPct)(closes, 20),
        volumeRatio,
        swingHigh20: max(previousHighs),
        swingLow20: min(previousLows),
        trendGapPct
    };
};
exports.buildIndicatorSnapshot = buildIndicatorSnapshot;
const buildTradePlan = (signal, price, indicators) => {
    const riskAmountUsd = config_1.config.accountSizeUsd * (config_1.config.riskPerTradePct / 100);
    const minimumRiskDistance = Math.max(indicators.atr * 1.2, price * 0.004);
    if (riskAmountUsd <= 0 || minimumRiskDistance <= 0 || price <= 0) {
        return null;
    }
    if (signal === 'BUY') {
        const stopCandidates = [
            price - minimumRiskDistance,
            indicators.emaMedium - indicators.atr * 0.35,
            indicators.swingLow20 - indicators.atr * 0.15
        ].filter((value) => Number.isFinite(value) && value < price);
        const stopLoss = stopCandidates.length > 0 ? Math.min(...stopCandidates) : price - minimumRiskDistance;
        const riskDistance = price - stopLoss;
        if (riskDistance <= 0) {
            return null;
        }
        const suggestedPositionUnits = riskAmountUsd / riskDistance;
        return {
            entry: price,
            stopLoss,
            takeProfit1: price + riskDistance * 1.5,
            takeProfit2: price + riskDistance * 2.5,
            riskRewardRatio: 2.5,
            riskAmountUsd,
            suggestedPositionUnits,
            invalidation: 'Сценарий отменяется, если цена закрепляется ниже EMA50 и локального минимума.'
        };
    }
    const stopCandidates = [
        price + minimumRiskDistance,
        indicators.emaMedium + indicators.atr * 0.35,
        indicators.swingHigh20 + indicators.atr * 0.15
    ].filter((value) => Number.isFinite(value) && value > price);
    const stopLoss = stopCandidates.length > 0 ? Math.max(...stopCandidates) : price + minimumRiskDistance;
    const riskDistance = stopLoss - price;
    if (riskDistance <= 0) {
        return null;
    }
    const suggestedPositionUnits = riskAmountUsd / riskDistance;
    return {
        entry: price,
        stopLoss,
        takeProfit1: price - riskDistance * 1.5,
        takeProfit2: price - riskDistance * 2.5,
        riskRewardRatio: 2.5,
        riskAmountUsd,
        suggestedPositionUnits,
        invalidation: 'Сценарий отменяется, если цена закрепляется выше EMA50 и локального максимума.'
    };
};
const evaluateSignal = (price, indicators) => {
    const longReasons = [];
    const shortReasons = [];
    const commonReasons = [];
    let longScore = 0;
    let shortScore = 0;
    let regime = 'RANGE';
    const bullishTrend = price > indicators.emaTrend &&
        indicators.emaFast > indicators.emaMedium &&
        indicators.emaMedium > indicators.emaTrend;
    const bearishTrend = price < indicators.emaTrend &&
        indicators.emaFast < indicators.emaMedium &&
        indicators.emaMedium < indicators.emaTrend;
    const trendStrong = indicators.adx >= 18;
    const volumeConfirmed = indicators.volumeRatio >= 1.05;
    const tooVolatile = indicators.volatilityPct > 3.8;
    const longRsiOk = indicators.rsi >= 52 && indicators.rsi <= 68;
    const shortRsiOk = indicators.rsi >= 32 && indicators.rsi <= 48;
    const longMomentumOk = indicators.momentumPct >= 0.35;
    const shortMomentumOk = indicators.momentumPct <= -0.35;
    const longBreakout = indicators.swingHigh20 > 0 && price > indicators.swingHigh20 * 1.001;
    const shortBreakdown = indicators.swingLow20 > 0 && price < indicators.swingLow20 * 0.999;
    const longExtended = (indicators.atr > 0 && (price - indicators.emaFast) / indicators.atr > 1.8) || indicators.rsi >= 74;
    const shortExtended = (indicators.atr > 0 && (indicators.emaFast - price) / indicators.atr > 1.8) || indicators.rsi <= 26;
    if (bullishTrend) {
        regime = 'BULL';
        longScore += 2.5;
        longReasons.push('EMA20 > EMA50 > EMA200 и цена выше EMA200 — тренд восходящий.');
    }
    else if (bearishTrend) {
        regime = 'BEAR';
        shortScore += 2.5;
        shortReasons.push('EMA20 < EMA50 < EMA200 и цена ниже EMA200 — тренд нисходящий.');
    }
    else {
        commonReasons.push('Структура рынка смешанная: фильтр старшего тренда не подтверждён.');
        longScore -= 0.5;
        shortScore -= 0.5;
    }
    if (trendStrong) {
        if (bullishTrend) {
            longScore += 1.0;
            longReasons.push('ADX подтверждает направленное движение, а не боковик.');
        }
        if (bearishTrend) {
            shortScore += 1.0;
            shortReasons.push('ADX подтверждает направленное движение, а не боковик.');
        }
    }
    else {
        commonReasons.push('ADX ниже рабочего порога — рынок шумный, confidence снижен.');
        longScore -= 0.7;
        shortScore -= 0.7;
    }
    if (longMomentumOk) {
        longScore += 0.9;
        longReasons.push('Импульс положительный, движение не затухает.');
    }
    if (shortMomentumOk) {
        shortScore += 0.9;
        shortReasons.push('Импульс отрицательный, снижение подтверждается.');
    }
    if (longRsiOk) {
        longScore += 0.8;
        longReasons.push('RSI находится в рабочей зоне продолжения роста.');
    }
    else if (indicators.rsi > 74) {
        longScore -= 0.6;
        longReasons.push('RSI слишком высок: вход в лонг может быть запоздалым.');
    }
    if (shortRsiOk) {
        shortScore += 0.8;
        shortReasons.push('RSI находится в рабочей зоне продолжения снижения.');
    }
    else if (indicators.rsi < 26) {
        shortScore -= 0.6;
        shortReasons.push('RSI слишком низок: вход в шорт может быть запоздалым.');
    }
    if (volumeConfirmed) {
        if (bullishTrend || longMomentumOk) {
            longScore += 0.6;
            longReasons.push('Объём выше среднего — участники рынка поддерживают движение.');
        }
        if (bearishTrend || shortMomentumOk) {
            shortScore += 0.6;
            shortReasons.push('Объём выше среднего — снижение идёт с подтверждением.');
        }
    }
    else {
        commonReasons.push('Объём без явного всплеска, пробой может оказаться слабым.');
    }
    if (longBreakout) {
        longScore += 0.8;
        longReasons.push('Цена обновляет максимум последних 20 свечей.');
    }
    if (shortBreakdown) {
        shortScore += 0.8;
        shortReasons.push('Цена обновляет минимум последних 20 свечей.');
    }
    if (tooVolatile) {
        longScore -= 0.8;
        shortScore -= 0.8;
        commonReasons.push('Волатильность выше комфортной: размер позиции нужно уменьшать.');
    }
    if (longExtended) {
        longScore -= 1.0;
        longReasons.push('Лонг перегрет: цена слишком далеко ушла от EMA20/ATR.');
    }
    if (shortExtended) {
        shortScore -= 1.0;
        shortReasons.push('Шорт перегрет: цена слишком далеко ушла от EMA20/ATR.');
    }
    let signal = 'HOLD';
    let score = 0;
    let reason = commonReasons;
    let setup = 'NONE';
    if (longScore >= 4.4 && longScore - shortScore >= 1.0) {
        signal = 'BUY';
        score = longScore;
        reason = [...longReasons, ...commonReasons];
        setup = longBreakout ? 'TREND_BREAKOUT' : 'TREND_PULLBACK';
    }
    else if (shortScore >= 4.4 && shortScore - longScore >= 1.0) {
        signal = 'SELL';
        score = -shortScore;
        reason = [...shortReasons, ...commonReasons];
        setup = 'BREAKDOWN';
    }
    else {
        score = longScore >= shortScore ? longScore : -shortScore;
        reason = longScore >= shortScore ? [...longReasons, ...commonReasons] : [...shortReasons, ...commonReasons];
    }
    const dominantScore = signal === 'BUY' ? longScore : signal === 'SELL' ? shortScore : Math.max(longScore, shortScore);
    const confidence = clamp(0.32 + dominantScore / 8.5, 0.2, 0.93);
    const actionable = signal !== 'HOLD' &&
        trendStrong &&
        confidence >= config_1.config.minConfidenceActionable &&
        !tooVolatile;
    const tradePlan = actionable && signal !== 'HOLD' ? buildTradePlan(signal, price, indicators) : null;
    return {
        signal: actionable ? signal : 'HOLD',
        confidence,
        score,
        reason,
        regime,
        setup: actionable ? setup : 'NONE',
        actionable,
        tradePlan
    };
};
exports.evaluateSignal = evaluateSignal;
