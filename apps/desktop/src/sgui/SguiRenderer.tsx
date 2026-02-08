import React, { useEffect, useMemo, useState } from "react";
import type { UiComponentSpec, UiLayoutSpec, UiRenderSpec } from "../lib/gatewayModels.js";
import { resolveComponent } from "./registry";

const layoutClass = (layout?: UiLayoutSpec): string => {
	if (!layout) return "flex flex-col";
	if (layout.type === "row") return "flex flex-row flex-wrap";
	if (layout.type === "grid") return "grid";
	return "flex flex-col";
};

const alignClass = (layout?: UiLayoutSpec): string => {
	if (!layout?.align) return "";
	if (layout.type === "grid") return "";
	const map: Record<NonNullable<UiLayoutSpec["align"]>, string> = {
		start: "items-start",
		center: "items-center",
		end: "items-end",
		stretch: "items-stretch",
	};
	return map[layout.align] ?? "";
};

export const SguiRenderer: React.FC<{ ui: UiRenderSpec }> = ({ ui }) => {
	const unsupportedRegistry = ui.registry && ui.registry !== "webui";
	const [resolved, setResolved] = useState<
		Array<{ spec: UiComponentSpec; Component: React.ComponentType<any> | null }>
	>([]);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const entries = await Promise.all(
				ui.components.map(async (spec) => ({
					spec,
					Component: await resolveComponent(spec.component),
				})),
			);
			if (!cancelled) setResolved(entries);
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [ui]);

	const classes = useMemo(() => {
		return `${layoutClass(ui.layout)} ${alignClass(ui.layout)}`.trim();
	}, [ui.layout]);

	const style = useMemo<React.CSSProperties>(() => {
		const gap = ui.layout?.gap ?? 12;
		if (ui.layout?.type === "grid") {
			const columns = ui.layout.columns ?? 2;
			return {
				gap,
				gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
			};
		}
		return { gap };
	}, [ui.layout]);

	if (unsupportedRegistry) {
		return (
			<div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
				Unsupported UI registry: {ui.registry}
			</div>
		);
	}

	return (
		<div className={classes} style={style}>
			{resolved.map(({ spec, Component }) => {
				if (!Component) {
					return (
						<div
							key={spec.component}
							className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
						>
							Unknown UI component: {spec.component}
						</div>
					);
				}
				return (
					<div key={spec.component}>
						<Component {...spec.props} />
					</div>
				);
			})}
		</div>
	);
};

export default SguiRenderer;
