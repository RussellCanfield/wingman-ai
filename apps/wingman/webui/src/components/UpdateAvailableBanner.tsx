import type React from "react";
import type { AppUpdateNotice } from "../types";

type UpdateAvailableBannerProps = {
	notice: AppUpdateNotice;
	offsetClass?: string;
};

export const UpdateAvailableBanner: React.FC<UpdateAvailableBannerProps> = ({
	notice,
	offsetClass = "top-0",
}) => {
	return (
		<div
			className={`pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4 ${offsetClass}`}
		>
			<aside
				aria-live="polite"
				aria-label="Wingman update available"
				className="pointer-events-auto relative mt-3 w-full max-w-[min(92vw,780px)] overflow-hidden rounded-[22px] border border-amber-300/30 bg-[linear-gradient(135deg,rgba(120,53,15,0.92),rgba(30,41,59,0.96))] text-amber-50 shadow-[0_24px_80px_rgba(120,53,15,0.28)] backdrop-blur-2xl"
			>
				<div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/85 to-transparent" />
				<div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_54%)] opacity-80" />
				<div className="relative flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
					<span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
						Update Available
					</span>
					<p className="text-sm font-medium text-amber-50">
						Wingman {notice.currentVersion} to {notice.latestVersion}
					</p>
					<code className="rounded-[14px] border border-white/10 bg-slate-950/35 px-3 py-1 text-[11px] font-medium text-amber-100/95 break-all">
						{notice.command}
					</code>
				</div>
			</aside>
		</div>
	);
};
