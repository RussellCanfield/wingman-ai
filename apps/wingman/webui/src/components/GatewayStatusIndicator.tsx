import type React from "react";

type GatewayStatusIndicatorProps = {
	connected: boolean;
	connecting: boolean;
};

export const GatewayStatusIndicator: React.FC<GatewayStatusIndicatorProps> = ({
	connected,
	connecting,
}) => {
	const statusLabel = connected
		? "Online"
		: connecting
			? "Connecting"
			: "Offline";
	const chromeClass = connected
		? "border-emerald-400/35 bg-[linear-gradient(180deg,rgba(5,150,105,0.18),rgba(2,6,23,0.92))] text-emerald-50 shadow-[0_18px_60px_rgba(5,150,105,0.2)]"
		: connecting
			? "border-sky-400/35 bg-[linear-gradient(180deg,rgba(14,165,233,0.18),rgba(2,6,23,0.92))] text-sky-50 shadow-[0_18px_60px_rgba(14,165,233,0.18)]"
			: "border-slate-500/40 bg-[linear-gradient(180deg,rgba(51,65,85,0.28),rgba(2,6,23,0.94))] text-slate-100 shadow-[0_18px_60px_rgba(15,23,42,0.35)]";
	const ringClass = connected
		? "border-emerald-300/30 bg-emerald-500/10"
		: connecting
			? "border-sky-300/30 bg-sky-500/10"
			: "border-slate-400/25 bg-slate-500/10";
	const dotClass = connected
		? "bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.75)]"
		: connecting
			? "bg-sky-300 animate-pulseSoft shadow-[0_0_18px_rgba(56,189,248,0.75)]"
			: "bg-slate-400";

	return (
		<div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4">
			<output
				aria-live="polite"
				aria-label={`Gateway ${statusLabel}`}
				className={`pointer-events-auto relative overflow-hidden rounded-b-[18px] border-x border-b px-3 py-1.5 backdrop-blur-2xl ${chromeClass}`}
			>
				<div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
				<div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_48%)] opacity-70" />
				<div className="absolute left-1/2 top-full h-2 w-px -translate-x-1/2 bg-gradient-to-b from-white/45 to-transparent" />
				<div className="relative flex items-center gap-2">
					<span
						className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${ringClass}`}
					>
						<span className={`h-2 w-2 rounded-full ${dotClass}`} />
					</span>
					<p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]">
						<span className="text-slate-300/70">Gateway</span>
						<span>{statusLabel}</span>
					</p>
				</div>
			</output>
		</div>
	);
};
