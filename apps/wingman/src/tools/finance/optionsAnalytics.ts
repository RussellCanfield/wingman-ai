export type OptionLegInput = {
	type: "call" | "put";
	side: "buy" | "sell";
	strike: number;
	premium: number;
	qty?: number;
	contractMultiplier?: number;
	impliedVol?: number;
};

export type OptionsAnalysisInput = {
	underlyingPrice: number;
	legs: OptionLegInput[];
	daysToExpiry?: number;
	riskFreeRate?: number;
	dividendYield?: number;
};

export type OptionsGreeks = {
	status: "ok" | "partial" | "insufficient-data";
	delta?: number;
	gamma?: number;
	vega?: number;
	theta?: number;
	legsComputed: number;
	legsMissing: number;
};

export type OptionsAnalysisResult = {
	underlyingPrice: number;
	netPremium: number;
	netDebit: number;
	netCredit: number;
	maxProfit: { usd: number | null; unbounded: boolean };
	maxLoss: { usd: number | null; unbounded: boolean };
	bestCasePayoff: number | null;
	worstCasePayoff: number | null;
	breakevens: number[];
	greeks: OptionsGreeks;
};

const DEFAULT_MULTIPLIER = 100;

const intrinsicValue = (spot: number, strike: number, type: "call" | "put") => {
	if (type === "call") return Math.max(0, spot - strike);
	return Math.max(0, strike - spot);
};

const toPositionSign = (side: "buy" | "sell") => (side === "buy" ? 1 : -1);

const uniqueSorted = (values: number[]) => {
	const set = new Set<number>();
	for (const value of values) set.add(value);
	return Array.from(set).sort((a, b) => a - b);
};

const roundTo = (value: number, decimals = 6) => {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
};

const erf = (x: number) => {
	const sign = x < 0 ? -1 : 1;
	const absX = Math.abs(x);
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;
	const t = 1 / (1 + p * absX);
	const y =
		1 -
		((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t *
			Math.exp(-absX * absX);
	return sign * y;
};

const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.sqrt(2)));

const normPdf = (x: number) =>
	Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

const computeLegGreeks = (input: {
	spot: number;
	strike: number;
	daysToExpiry: number;
	impliedVol: number;
	riskFreeRate: number;
	dividendYield: number;
	type: "call" | "put";
}) => {
	const { spot, strike, daysToExpiry, impliedVol, riskFreeRate, dividendYield } =
		input;
	const t = daysToExpiry / 365;
	const iv = impliedVol;
	const sqrtT = Math.sqrt(t);
	const d1 =
		(Math.log(spot / strike) +
			(riskFreeRate - dividendYield + 0.5 * iv * iv) * t) /
		(iv * sqrtT);
	const d2 = d1 - iv * sqrtT;
	const expQT = Math.exp(-dividendYield * t);
	const expRT = Math.exp(-riskFreeRate * t);
	const pdf = normPdf(d1);

	const callDelta = expQT * normCdf(d1);
	const putDelta = expQT * (normCdf(d1) - 1);
	const gamma = (expQT * pdf) / (spot * iv * sqrtT);
	const vega = (spot * expQT * pdf * sqrtT) / 100;

	const callTheta =
		(-(spot * expQT * pdf * iv) / (2 * sqrtT) -
			riskFreeRate * strike * expRT * normCdf(d2) +
			dividendYield * spot * expQT * normCdf(d1)) /
		365;
	const putTheta =
		(-(spot * expQT * pdf * iv) / (2 * sqrtT) +
			riskFreeRate * strike * expRT * normCdf(-d2) -
			dividendYield * spot * expQT * normCdf(-d1)) /
		365;

	return {
		delta: input.type === "call" ? callDelta : putDelta,
		gamma,
		vega,
		theta: input.type === "call" ? callTheta : putTheta,
	};
};

export const analyzeOptionStructure = (
	input: OptionsAnalysisInput,
): OptionsAnalysisResult => {
	const riskFreeRate = input.riskFreeRate ?? 0;
	const dividendYield = input.dividendYield ?? 0;
	const legs = input.legs;

	const normalizedLegs = legs.map((leg) => ({
		...leg,
		qty: leg.qty ?? 1,
		contractMultiplier: leg.contractMultiplier ?? DEFAULT_MULTIPLIER,
	}));

	const payoffAt = (spot: number) => {
		return normalizedLegs.reduce((total, leg) => {
			const positionSign = toPositionSign(leg.side);
			const qty = leg.qty ?? 1;
			const multiplier = leg.contractMultiplier ?? DEFAULT_MULTIPLIER;
			const premiumCashflow =
				(leg.side === "buy" ? -1 : 1) * leg.premium * qty * multiplier;
			const intrinsic = intrinsicValue(spot, leg.strike, leg.type);
			return total + positionSign * intrinsic * qty * multiplier + premiumCashflow;
		}, 0);
	};

	const netPremium = normalizedLegs.reduce((total, leg) => {
		const qty = leg.qty ?? 1;
		const multiplier = leg.contractMultiplier ?? DEFAULT_MULTIPLIER;
		const cashflow = (leg.side === "sell" ? 1 : -1) * leg.premium;
		return total + cashflow * qty * multiplier;
	}, 0);

	const netDebit = netPremium < 0 ? -netPremium : 0;
	const netCredit = netPremium > 0 ? netPremium : 0;

	const strikes = uniqueSorted(normalizedLegs.map((leg) => leg.strike));
	const points = [0, ...strikes];
	const payoffs = points.map((spot) => payoffAt(spot));

	const netCallExposure = normalizedLegs.reduce((total, leg) => {
		if (leg.type !== "call") return total;
		const qty = leg.qty ?? 1;
		const multiplier = leg.contractMultiplier ?? DEFAULT_MULTIPLIER;
		return total + toPositionSign(leg.side) * qty * multiplier;
	}, 0);

	const unboundedProfit = netCallExposure > 0;
	const unboundedLoss = netCallExposure < 0;

	const maxPayoff = Math.max(...payoffs);
	const minPayoff = Math.min(...payoffs);

	const bestCasePayoff = unboundedProfit ? null : roundTo(maxPayoff, 4);
	const worstCasePayoff = unboundedLoss ? null : roundTo(minPayoff, 4);

	const maxProfit = {
		usd: unboundedProfit ? null : roundTo(Math.max(0, maxPayoff), 4),
		unbounded: unboundedProfit,
	};

	const maxLoss = {
		usd: unboundedLoss ? null : roundTo(Math.max(0, -minPayoff), 4),
		unbounded: unboundedLoss,
	};

	const breakevens: number[] = [];
	for (let i = 0; i < points.length - 1; i += 1) {
		const a = points[i];
		const b = points[i + 1];
		const fa = payoffs[i];
		const fb = payoffs[i + 1];
		if (fa === 0) {
			breakevens.push(a);
			continue;
		}
		if (fb === 0) {
			breakevens.push(b);
			continue;
		}
		if (fa * fb < 0) {
			const root = a + ((0 - fa) * (b - a)) / (fb - fa);
			breakevens.push(root);
		}
	}

	if (strikes.length > 0 && netCallExposure !== 0) {
		const maxStrike = strikes[strikes.length - 1];
		const payoffAtMaxStrike = payoffAt(maxStrike);
		const slope = netCallExposure;
		if (slope > 0 && payoffAtMaxStrike < 0) {
			breakevens.push(maxStrike - payoffAtMaxStrike / slope);
		} else if (slope < 0 && payoffAtMaxStrike > 0) {
			breakevens.push(maxStrike - payoffAtMaxStrike / slope);
		}
	}

	const dedupedBreakevens = uniqueSorted(
		breakevens
			.filter((value) => Number.isFinite(value))
			.map((value) => roundTo(value, 4)),
	);

	let legsComputed = 0;
	let legsMissing = 0;
	let delta = 0;
	let gamma = 0;
	let vega = 0;
	let theta = 0;

	for (const leg of normalizedLegs) {
		if (
			input.daysToExpiry === undefined ||
			leg.impliedVol === undefined ||
			!Number.isFinite(leg.impliedVol) ||
			leg.impliedVol <= 0
		) {
			legsMissing += 1;
			continue;
		}

		legsComputed += 1;
		const { delta: legDelta, gamma: legGamma, vega: legVega, theta: legTheta } =
			computeLegGreeks({
				spot: input.underlyingPrice,
				strike: leg.strike,
				daysToExpiry: input.daysToExpiry,
				impliedVol: leg.impliedVol,
				riskFreeRate,
				dividendYield,
				type: leg.type,
			});

		const positionSign = toPositionSign(leg.side);
		const qty = leg.qty ?? 1;
		const multiplier = leg.contractMultiplier ?? DEFAULT_MULTIPLIER;
		delta += positionSign * legDelta * qty * multiplier;
		gamma += positionSign * legGamma * qty * multiplier;
		vega += positionSign * legVega * qty * multiplier;
		theta += positionSign * legTheta * qty * multiplier;
	}

	let greeksStatus: OptionsGreeks["status"] = "insufficient-data";
	if (legsComputed > 0 && legsMissing === 0) greeksStatus = "ok";
	else if (legsComputed > 0) greeksStatus = "partial";

	const greeks: OptionsGreeks = {
		status: greeksStatus,
		legsComputed,
		legsMissing,
	};

	if (legsComputed > 0) {
		greeks.delta = roundTo(delta, 6);
		greeks.gamma = roundTo(gamma, 6);
		greeks.vega = roundTo(vega, 6);
		greeks.theta = roundTo(theta, 6);
	}

	return {
		underlyingPrice: input.underlyingPrice,
		netPremium: roundTo(netPremium, 4),
		netDebit: roundTo(netDebit, 4),
		netCredit: roundTo(netCredit, 4),
		maxProfit,
		maxLoss,
		bestCasePayoff,
		worstCasePayoff,
		breakevens: dedupedBreakevens,
		greeks,
	};
};
