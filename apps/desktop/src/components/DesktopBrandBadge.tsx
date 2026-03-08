import type React from "react";
import { WingmanMark } from "./DesktopIcons.js";

type DesktopBrandBadgeProps = {
	label?: string;
	className?: string;
};

export function DesktopBrandBadge({
	label = "Wingman",
	className = "",
}: DesktopBrandBadgeProps): React.JSX.Element {
	return (
		<span
			className={`inline-flex items-center gap-2 rounded-full border border-white/25 bg-slate-950/45 px-3 py-1 text-xs text-slate-100 ${className}`.trim()}
		>
			<WingmanMark className="h-4 w-4 shrink-0" />
			<span>{label}</span>
		</span>
	);
}
