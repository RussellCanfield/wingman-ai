import React from "react";

type DataTableColumn = {
	key: string;
	label: string;
	align?: "left" | "center" | "right";
	width?: string;
};

export type DataTableProps = {
	title: string;
	subtitle?: string;
	columns: DataTableColumn[];
	rows: Array<Record<string, string | number>>;
	striped?: boolean;
};

const alignClass = (align?: DataTableColumn["align"]) => {
	if (align === "center") return "text-center";
	if (align === "right") return "text-right";
	return "text-left";
};

export const DataTable: React.FC<DataTableProps> = ({
	title,
	subtitle,
	columns,
	rows,
	striped = false,
}) => {
	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
			<div>
				<p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
				{subtitle ? (
					<h4 className="mt-1 text-lg font-semibold text-slate-100">{subtitle}</h4>
				) : null}
			</div>
			<div className="mt-4 overflow-x-auto">
				<table className="min-w-full text-sm">
					<thead>
						<tr className="border-b border-white/10 text-slate-400">
							{columns.map((column) => (
								<th
									key={column.key}
									className={`pb-2 pr-4 font-semibold uppercase tracking-[0.18em] ${alignClass(
										column.align,
									)}`}
									style={column.width ? { width: column.width } : undefined}
								>
									{column.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="py-4 text-center text-slate-400"
								>
									No data available
								</td>
							</tr>
						) : (
							rows.map((row, rowIndex) => (
								<tr
									key={`row-${rowIndex}`}
									className={
										striped && rowIndex % 2 === 1
											? "bg-white/5"
											: ""
									}
								>
									{columns.map((column) => (
										<td
											key={`${rowIndex}-${column.key}`}
											className={`py-3 pr-4 text-slate-100 ${alignClass(
												column.align,
											)}`}
										>
											{row[column.key] ?? "-"}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default DataTable;
