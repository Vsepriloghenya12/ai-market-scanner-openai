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
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const max = (values) => (values.length > 0 ? Math.max(...values) : 0);
const min = (values) => (values.length > 0 ? Math.min(...values) : 0);
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
const buildTradePlan = (recommendation, price, indicators, setup) => {
    const riskAmountUsd = config_1.config.accountSizeUsd * (config_1.config.riskPerTradePct / 100);
    const baseRisk = Math.max(indicators.atr * 1.15, price * 0.006);
    if (riskAmountUsd <= 0 || baseRisk <= 0 || price <= 0) {
        return null;
    }
    if (recommendation === 'BUY_NOW') {
        const stopCandidates = [
            price - baseRisk,
            indicators.emaMedium - indicators.atr * 0.3,
            indicators.swingLow20 - indicators.atr * 0.15
        ].filter((value) => Number.isFinite(value) && value < price);
        const stopLoss = stopCandidates.length > 0 ? Math.min(...stopCandidates) : price - baseRisk;
        const riskDistance = price - stopLoss;
        if (riskDistance <= 0) {
            return null;
        }
        const entryPadding = Math.max(indicators.atr * 0.2, price * 0.0025);
        return {
            entry: price,
            entryMin: Math.max(price - entryPadding, 0),
            entryMax: price + entryPadding,
            triggerPrice: setup === 'BREAKOUT' ? indicators.swingHigh20 * 1.001 : null,
            stopLoss,
            takeProfit1: price + riskDistance * 1.5,
            takeProfit2: price + riskDistance * 2.5,
            riskRewardRatio: 2.5,
            riskAmountUsd,
            suggestedPositionUnits: riskAmountUsd / riskDistance,
            invalidation: 'Сценарий ломается, если цена уходит ниже стопа и теряет EMA50.',
            entryComment: setup === 'BREAKOUT'
                ? 'Вход по подтверждённому пробою. Не покупать, если цена резко улетела выше зоны входа.'
                : 'Вход после здорового отката. Лучше брать ближе к зоне входа, а не после резкого пампа.',
            exitComment: 'На первой цели можно зафиксировать часть позиции, на второй — остаток.'
        };
    }
    if (recommendation === 'WAIT') {
        const triggerPrice = setup === 'BREAKOUT' ? indicators.swingHigh20 * 1.001 : indicators.emaFast;
        const entry = triggerPrice > 0 ? triggerPrice : price;
        const stopLoss = Math.min(indicators.swingLow20 - indicators.atr * 0.15, entry - baseRisk);
        const riskDistance = entry - stopLoss;
        if (riskDistance <= 0) {
            return null;
        }
        const entryPadding = Math.max(indicators.atr * 0.2, entry * 0.0025);
        return {
            entry,
            entryMin: Math.max(entry - entryPadding, 0),
            entryMax: entry + entryPadding,
            triggerPrice,
            stopLoss,
            takeProfit1: entry + riskDistance * 1.5,
            takeProfit2: entry + riskDistance * 2.5,
            riskRewardRatio: 2.5,
            riskAmountUsd,
            suggestedPositionUnits: riskAmountUsd / riskDistance,
            invalidation: 'Если цена продолжает слабеть и теряет EMA50, идея отменяется.',
            entryComment: 'Пока не покупать. Нужно дождаться, пока цена подтвердит вход и не сорвётся обратно.',
            exitComment: 'Если после входа цена дойдёт до первой цели, часть позиции можно закрыть.'
        };
    }
    return null;
};
const evaluateSignal = (price, indicators, market) => {
    const reasons = [];
    let score = 0;
    let regime = 'RANGE';
    let setup = 'NONE';
    const bullishTrend = price > indicators.emaTrend &&
        indicators.emaFast > indicators.emaMedium &&
        indicators.emaMedium > indicators.emaTrend;
    const bearishTrend = price < indicators.emaTrend &&
        indicators.emaFast < indicators.emaMedium &&
        indicators.emaMedium < indicators.emaTrend;
    const trendStrong = indicators.adx >= 18;
    const volumeConfirmed = indicators.volumeRatio >= 1.08;
    const entryVolumeConfirmed = indicators.volumeRatio >= 1.2;
    const highVolatility = indicators.volatilityPct > 4.2;
    const longMomentumOk = indicators.momentumPct >= 0.45;
    const breakout = indicators.swingHigh20 > 0 && price >= indicators.swingHigh20 * 0.999;
    const breakoutConfirmed = indicators.swingHigh20 > 0 && price >= indicators.swingHigh20 * 1.001;
    const pullback = bullishTrend &&
        price >= indicators.emaFast &&
        price <= indicators.emaFast + Math.max(indicators.atr * 0.35, price * 0.0035);
    const pullbackConfirmed = pullback && indicators.adx >= 22 && indicators.rsi >= 55;
    const euphoricBreakout = breakout && (indicators.momentumPct >= 6 || indicators.trendGapPct >= 8);
    const tooExtended = (indicators.atr > 0 && (price - indicators.emaFast) / indicators.atr > 2) ||
        indicators.rsi >= 74 ||
        euphoricBreakout;
    const liquidityOk = market.turnover24hUsd >= config_1.config.minTurnover24hUsd;
    const spreadOk = market.spreadPct <= config_1.config.maxSpreadPct;
    if (bullishTrend) {
        regime = 'BULL';
        score += 2.6;
        reasons.push('Тренд вверх: EMA20 выше EMA50, EMA50 выше EMA200, цена держится выше EMA200.');
    }
    else if (bearishTrend) {
        regime = 'BEAR';
        score -= 2.8;
        reasons.push('Тренд вниз: для нового long это плохой фон.');
    }
    else {
        reasons.push('Старший тренд ещё не даёт чистый long-сценарий.');
    }
    if (trendStrong) {
        score += 0.9;
        reasons.push('ADX подтверждает, что рынок движется, а не стоит в боковике.');
    }
    else {
        score -= 0.6;
        reasons.push('Тренд слабый: сейчас больше шума, чем импульса.');
    }
    if (longMomentumOk) {
        score += 0.7;
        reasons.push('Импульс положительный: движение вверх не затухло.');
    }
    else {
        score -= 0.9;
        reasons.push('Импульс слабый: рынок пока не показывает уверенного продолжения роста, поэтому вход только после подтверждения.');
    }
    if (entryVolumeConfirmed) {
        score += 0.6;
        reasons.push('Объём выше среднего: рост поддержан участниками рынка.');
    }
    else if (volumeConfirmed) {
        score += 0.25;
        reasons.push('Объём немного выше среднего, но для немедленного входа подтверждение ещё слабое.');
    }
    else {
        reasons.push('Объём без всплеска: пробой может оказаться ложным.');
    }
    if (breakout) {
        score += 0.8;
        setup = 'BREAKOUT';
        reasons.push('Цена давит в максимум последних 20 свечей — рынок близок к пробою.');
    }
    else if (pullback) {
        score += 0.55;
        setup = 'PULLBACK';
        reasons.push('Цена держится рядом с EMA20: это может быть аккуратный вход после отката.');
    }
    if (indicators.rsi >= 53 && indicators.rsi <= 68) {
        score += 0.55;
        reasons.push('RSI в рабочей зоне для продолжения роста.');
    }
    else if (indicators.rsi > 74) {
        score -= 0.95;
        reasons.push('RSI слишком высокий: покупать сейчас опасно, движение может быть перегретым.');
    }
    else if (indicators.rsi < 48) {
        score -= 0.4;
        reasons.push('RSI пока слабоват для сильного long-продолжения.');
    }
    if (!liquidityOk) {
        score -= 1.2;
        reasons.push('Оборот монеты низкий для надёжной идеи по фьючерсам.');
    }
    if (!spreadOk) {
        score -= 1.0;
        reasons.push('Спред слишком широкий: вход может оказаться дорогим.');
    }
    if (highVolatility) {
        score -= 0.8;
        reasons.push('Волатильность слишком высокая: риск выбивания по стопу повышен.');
    }
    if (euphoricBreakout) {
        score -= 1.2;
        reasons.push('Пробой уже слишком горячий: движение вертикальное, и вход сейчас похож на погоню за свечой.');
    }
    if (tooExtended) {
        score -= 1.0;
        reasons.push('Цена уже сильно улетела от своей базы: лучше не догонять свечу.');
    }
    const confidence = clamp(0.34 + score / 8.6, 0.15, 0.95);
    const entrySetupConfirmed = (setup === 'BREAKOUT' && breakoutConfirmed) || (setup === 'PULLBACK' && pullbackConfirmed);
    let signal = 'HOLD';
    let recommendation = 'WAIT';
    let headline = 'Пока лучше подождать';
    let shortText = 'Идея на рост ещё не готова. Система предлагает наблюдать и ждать подтверждения.';
    const actionable = bullishTrend &&
        trendStrong &&
        longMomentumOk &&
        entryVolumeConfirmed &&
        entrySetupConfirmed &&
        !highVolatility &&
        !tooExtended &&
        confidence >= config_1.config.minConfidenceActionable &&
        (breakout || pullback);
    if (actionable) {
        signal = 'BUY';
        recommendation = 'BUY_NOW';
        headline = 'Купить фьючерс long сейчас';
        shortText =
            setup === 'BREAKOUT'
                ? 'Монета выглядит сильнее рынка и уже подтверждает пробой. Это одна из лучших long-идей сейчас.'
                : 'Монета держит восходящий тренд и даёт аккуратный вход после отката. Это рабочая long-идея.';
    }
    else if (bearishTrend || confidence < 0.36) {
        signal = 'SELL';
        recommendation = 'EXIT';
        setup = bearishTrend ? 'BREAKDOWN' : 'NONE';
        headline = 'Не покупать. Если long уже открыт — думать о выходе';
        shortText =
            'Система не видит здесь здоровой точки входа в рост. Новую покупку лучше не открывать, а старый long контролировать жёстче.';
    }
    else {
        signal = bullishTrend ? 'BUY' : 'HOLD';
        recommendation = 'WAIT';
        headline = 'Ждать подтверждения';
        shortText =
            setup === 'BREAKOUT'
                ? 'Монета интересная, но лучше дождаться уверенного закрепления выше триггера.'
                : 'Потенциал роста есть, но точка входа ещё не стала чистой. Пока безопаснее ждать.';
    }
    const tradePlan = buildTradePlan(recommendation, price, indicators, setup);
    return {
        signal,
        recommendation,
        confidence,
        score,
        reason: reasons,
        regime,
        setup,
        actionable,
        tradePlan,
        headline,
        shortText
    };
};
exports.evaluateSignal = evaluateSignal;
