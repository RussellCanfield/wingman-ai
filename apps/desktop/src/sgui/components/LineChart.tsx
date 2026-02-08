import React, { useMemo, useState } from "react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart as RechartsLineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { TooltipContentProps, TooltipPayloadEntry } from "recharts";
import {
	buildSeriesDataset,
	chartPalette,
	formatMetricValue,
	type AxisScale,
	type ChartSeries,
} from "./chartUtils";

export type LineChartProps = {
	title: string;
	subtitle?: string;
	series: ChartSeries[];
	yLabel?: string;
	xLabel?: string;
	yScale?: AxisScale;
	xScale?: AxisScale;
	showLegend?: boolean;
	showMarkers?: boolean;
};

const ChartTooltip: React.FC<Partial<TooltipContentProps<number, string>>> = ({
	active,
	payload,
	label,
}) => {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow-xl">
			<div className="text-slate-400">{label}</div>
			<div className="mt-2 space-y-1">
				{payload.map((item: TooltipPayloadEntry<number, string>) => {
					const seriesName =
						typeof item.name === "string" || typeof item.name === "number"
							? item.name
							: typeof item.dataKey === "string" || typeof item.dataKey === "number"
								? item.dataKey
								: "Series";
					return (
						<div
							key={item.dataKey?.toString()}
							className="flex items-center justify-between gap-3"
						>
							<span className="flex items-center gap-2">
								<span
									className="h-2 w-2 rounded-full"
									style={{ backgroundColor: item.color ?? "#38bdf8" }}
								/>
								<span>{seriesName}</span>
							</span>
							<span className="font-semibold text-slate-100">
								{formatMetricValue(Number(item.value))}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export const LineChart: React.FC<LineChartProps> = ({
	title,
	subtitle,
	series,
	yLabel,
	xLabel,
	yScale,
	xScale,
	showLegend = true,
	showMarkers = true,
}) => {
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const { data } = useMemo(() => buildSeriesDataset(series), [series]);
	const hasData = data.length > 0;

	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
					{subtitle ? (
						<h4 className="mt-1 text-lg font-semibold text-slate-100">{subtitle}</h4>
					) : null}
				</div>
			</div>

			{hasData ? (
				<div className="mt-4 w-full pb-2">
					<div className="h-56 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<RechartsLineChart
								data={data}
								margin={{ top: 8, right: 16, left: 0, bottom: 18 }}
							>
								<CartesianGrid
									stroke="rgba(148, 163, 184, 0.15)"
									strokeDasharray="4 6"
								/>
								<XAxis
									dataKey="label"
									tick={{ fill: "rgba(148, 163, 184, 0.8)", fontSize: 12 }}
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									minTickGap={16}
									scale={xScale}
								/>
								<YAxis
									tick={{ fill: "rgba(148, 163, 184, 0.8)", fontSize: 12 }}
									axisLine={false}
									tickLine={false}
									tickMargin={10}
									width={40}
									scale={yScale}
								/>
								<Tooltip
									content={<ChartTooltip />}
									cursor={{ stroke: "rgba(148, 163, 184, 0.4)", strokeDasharray: "3 4" }}
								/>
								{showLegend ? (
									<Legend
										verticalAlign="top"
										align="right"
										wrapperStyle={{
											color: "rgba(226, 232, 240, 0.8)",
											fontSize: 12,
										}}
										onMouseEnter={(payload) =>
											setActiveKey(payload.dataKey?.toString() ?? null)
										}
										onMouseLeave={() => setActiveKey(null)}
									/>
								) : null}
								{series.map((line, index) => {
									const color = line.color ?? chartPalette[index % chartPalette.length];
									const isActive = !activeKey || activeKey === line.name;
									return (
										<Line
											key={line.name}
											type="monotone"
											dataKey={line.name}
											stroke={color}
											strokeWidth={isActive ? 2.6 : 1.6}
											dot={showMarkers ? { r: 3 } : false}
											activeDot={{ r: 5 }}
											opacity={isActive ? 1 : 0.3}
											isAnimationActive={false}
										/>
									);
								})}
							</RechartsLineChart>
						</ResponsiveContainer>
					</div>
					{(xLabel || yLabel) && (
						<div className="mt-3 flex items-center justify-between text-xs text-slate-400">
							<span>{yLabel ?? ""}</span>
							<span>{xLabel ?? ""}</span>
						</div>
					)}
				</div>
			) : (
				<div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
					No data available.
				</div>
			)}
		</div>
	);
};

export default LineChart;
