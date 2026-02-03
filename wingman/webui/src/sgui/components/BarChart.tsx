import React, { useMemo, useState } from "react";
import {
	Bar,
	BarChart as RechartsBarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import { chartPalette, formatMetricValue, type AxisScale } from "./chartUtils";

type BarDatum = {
	label: string;
	value: number;
	helper?: string;
	color?: string;
};

export type BarChartProps = {
	title: string;
	subtitle?: string;
	unit?: string;
	bars: BarDatum[];
	yScale?: AxisScale;
	xScale?: AxisScale;
};

const ChartTooltip: React.FC<TooltipProps<number, string> & { unit?: string }> = ({
	active,
	payload,
	label,
	unit,
}) => {
	if (!active || !payload?.length) return null;
	const data = payload[0];
	const helper = data?.payload?.helper as string | undefined;
	return (
		<div className="rounded-lg border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow-xl">
			<div className="text-slate-400">{label}</div>
			<div className="mt-2 flex items-center justify-between gap-3">
				<span className="font-semibold text-slate-100">
					{formatMetricValue(Number(data?.value ?? 0))}
					{unit ?? ""}
				</span>
			</div>
			{helper ? <div className="mt-1 text-slate-400">{helper}</div> : null}
		</div>
	);
};

export const BarChart: React.FC<BarChartProps> = ({
	title,
	subtitle,
	unit,
	bars,
	yScale,
	xScale,
}) => {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const data = useMemo(
		() =>
			bars.map((bar) => ({
				label: bar.label,
				value: bar.value,
				helper: bar.helper,
				color: bar.color,
			})),
		[bars],
	);
	const hasData = data.length > 0;

	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
			<div>
				<p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
				{subtitle ? (
					<h4 className="mt-1 text-lg font-semibold text-slate-100">{subtitle}</h4>
				) : null}
			</div>

			{hasData ? (
				<div className="mt-4 w-full pb-2">
					<div className="h-56 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<RechartsBarChart
								data={data}
								margin={{ top: 8, right: 16, left: 0, bottom: 18 }}
								onMouseMove={(state) =>
									setActiveIndex(
										typeof state.activeTooltipIndex === "number"
											? state.activeTooltipIndex
											: null,
									)
								}
								onMouseLeave={() => setActiveIndex(null)}
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
									content={(props) => <ChartTooltip {...props} unit={unit} />}
									cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
								/>
								<Bar
									dataKey="value"
									radius={[6, 6, 0, 0]}
									isAnimationActive={false}
								>
									{data.map((bar, index) => {
										const color = bar.color ?? chartPalette[index % chartPalette.length];
										const dimmed = activeIndex !== null && activeIndex !== index;
										return (
											<Cell
												key={`${bar.label}-${index}`}
												fill={color}
												fillOpacity={dimmed ? 0.35 : 0.9}
											/>
										);
									})}
								</Bar>
							</RechartsBarChart>
						</ResponsiveContainer>
					</div>
					{unit ? (
						<div className="mt-3 text-xs text-slate-400">Unit: {unit.trim()}</div>
					) : null}
				</div>
			) : (
				<div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
					No data available.
				</div>
			)}
		</div>
	);
};

export default BarChart;
