export const calculateEma = (
	values: number[],
	period: number,
): number | null => {
	if (period <= 0 || values.length < period) {
		return null;
	}

	let ema = 0;
	for (let i = 0; i < period; i += 1) {
		ema += values[i];
	}
	ema /= period;

	const multiplier = 2 / (period + 1);
	for (let i = period; i < values.length; i += 1) {
		ema = values[i] * multiplier + ema * (1 - multiplier);
	}

	return ema;
};

export const calculateRsi = (
	values: number[],
	period: number,
): number | null => {
	if (period <= 0 || values.length < period + 1) {
		return null;
	}

	let gains = 0;
	let losses = 0;
	for (let i = 1; i <= period; i += 1) {
		const delta = values[i] - values[i - 1];
		if (delta >= 0) {
			gains += delta;
		} else {
			losses -= delta;
		}
	}

	let avgGain = gains / period;
	let avgLoss = losses / period;

	for (let i = period + 1; i < values.length; i += 1) {
		const delta = values[i] - values[i - 1];
		const gain = delta > 0 ? delta : 0;
		const loss = delta < 0 ? -delta : 0;
		avgGain = (avgGain * (period - 1) + gain) / period;
		avgLoss = (avgLoss * (period - 1) + loss) / period;
	}

	if (avgLoss === 0) {
		return 100;
	}

	const rs = avgGain / avgLoss;
	return 100 - 100 / (1 + rs);
};

export const calculateAtr = (
	highs: number[],
	lows: number[],
	closes: number[],
	period: number,
): number | null => {
	if (
		period <= 0 ||
		highs.length < period + 1 ||
		lows.length < period + 1 ||
		closes.length < period + 1
	) {
		return null;
	}

	let atr = 0;
	for (let i = 1; i <= period; i += 1) {
		const high = highs[i];
		const low = lows[i];
		const prevClose = closes[i - 1];
		const tr = Math.max(
			high - low,
			Math.abs(high - prevClose),
			Math.abs(low - prevClose),
		);
		atr += tr;
	}
	atr /= period;

	for (let i = period + 1; i < highs.length; i += 1) {
		const high = highs[i];
		const low = lows[i];
		const prevClose = closes[i - 1];
		const tr = Math.max(
			high - low,
			Math.abs(high - prevClose),
			Math.abs(low - prevClose),
		);
		atr = (atr * (period - 1) + tr) / period;
	}

	return atr;
};

export const buildTechnicalSnapshot = ({
	closes,
	highs,
	lows,
}: {
	closes: number[];
	highs: number[];
	lows: number[];
}) => {
	const lastClose = closes.at(-1) ?? null;
	const ema20 = calculateEma(closes, 20);
	const ema50 = calculateEma(closes, 50);
	const ema200 = calculateEma(closes, 200);
	const rsi14 = calculateRsi(closes, 14);
	const atr14 = calculateAtr(highs, lows, closes, 14);

	return {
		lastClose,
		ema20,
		ema50,
		ema200,
		rsi14,
		atr14,
	};
};
