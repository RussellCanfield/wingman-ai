export type ChartSeriesPoint = {
	label: string;
	value: number;
};

export type ChartSeries = {
	name: string;
	color?: string;
	data: ChartSeriesPoint[];
};

export type AxisScale =
	| "auto"
	| "linear"
	| "pow"
	| "sqrt"
	| "log"
	| "time"
	| "band"
	| "point"
	| "ordinal";

export const chartPalette = [
	"#38bdf8",
	"#a855f7",
	"#34d399",
	"#fbbf24",
	"#f97316",
	"#22d3ee",
	"#f472b6",
];

export const formatMetricValue = (value: number) => {
	if (!Number.isFinite(value)) return "-";
	if (Math.abs(value) >= 1000) return value.toLocaleString();
	return Number.isInteger(value) ? value.toString() : value.toFixed(2);
};

export const buildSeriesDataset = (series: ChartSeries[]) => {
	if (series.length === 0) return { labels: [] as string[], data: [] as Array<Record<string, string | number>> };

	const labelOrder = new Map<string, number>();
	series.forEach((line) => {
		line.data.forEach((point) => {
			if (!labelOrder.has(point.label)) {
				labelOrder.set(point.label, labelOrder.size);
			}
		});
	});

	const labels = [...labelOrder.keys()];
	const seriesMaps = series.map((line) =>
		line.data.reduce<Record<string, number>>((acc, point) => {
			acc[point.label] = point.value;
			return acc;
		}, {}),
	);

	const data = labels.map((label) => {
		const row: Record<string, string | number> = { label };
		series.forEach((line, index) => {
			const value = seriesMaps[index]?.[label];
			if (value !== undefined) row[line.name] = value;
		});
		return row;
	});

	return { labels, data };
};
