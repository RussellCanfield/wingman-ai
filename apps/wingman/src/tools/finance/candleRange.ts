const SECONDS_PER_DAY = 24 * 60 * 60;

export const DEFAULT_CANDLE_MAX_DAYS_INTRADAY = 30;
export const DEFAULT_CANDLE_MAX_DAYS_DAILY = 365;

export interface CandleRangeOptions {
	from?: number;
	to?: number;
	lookbackDays?: number;
	resolution?: string;
	now?: Date;
	maxIntradayDays?: number;
	maxDailyDays?: number;
}

export interface CandleRangeResult {
	from: number;
	to: number;
	maxLookbackDays: number;
	requestedLookbackDays: number;
	capped: boolean;
	isIntraday: boolean;
}

export const isIntradayResolution = (resolution?: string): boolean => {
	if (!resolution) return false;
	const normalized = resolution.trim().toUpperCase();
	return /^\d+$/.test(normalized);
};

const toUnixSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

export const resolveCandleRange = ({
	from,
	to,
	lookbackDays,
	resolution,
	now = new Date(),
	maxIntradayDays = DEFAULT_CANDLE_MAX_DAYS_INTRADAY,
	maxDailyDays = DEFAULT_CANDLE_MAX_DAYS_DAILY,
}: CandleRangeOptions): CandleRangeResult => {
	const end = typeof to === "number" ? to : toUnixSeconds(now);
	const isIntraday = isIntradayResolution(resolution);
	const maxLookbackDays = isIntraday ? maxIntradayDays : maxDailyDays;
	const requestedLookbackDays = Math.max(1, lookbackDays ?? maxLookbackDays);
	let start =
		typeof from === "number"
			? from
			: end - requestedLookbackDays * SECONDS_PER_DAY;

	const maxSeconds = maxLookbackDays * SECONDS_PER_DAY;
	const capped = end - start > maxSeconds;
	if (capped) {
		start = end - maxSeconds;
	}

	return {
		from: start,
		to: end,
		maxLookbackDays,
		requestedLookbackDays,
		capped,
		isIntraday,
	};
};
