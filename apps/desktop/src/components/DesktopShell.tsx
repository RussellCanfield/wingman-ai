import type React from "react";
import { CloseIcon, MenuIcon } from "./DesktopIcons.js";

type DesktopShellProps = {
	sidebar: React.ReactNode;
	children: React.ReactNode;
	mobileMenuOpen: boolean;
	onToggleMobileMenu: () => void;
	onCloseMobileMenu: () => void;
	statusBadge?: React.ReactNode;
};

export function DesktopShell({
	sidebar,
	children,
	mobileMenuOpen,
	onToggleMobileMenu,
	onCloseMobileMenu,
	statusBadge,
}: DesktopShellProps): React.JSX.Element {
	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_92%_94%,rgba(14,165,233,0.18),transparent_36%)]" />
			<div className="mx-auto flex min-h-screen w-full max-w-[1580px] flex-col px-4 py-4 lg:px-5 lg:py-5">
				<div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
					<div className="min-w-0 flex-1">{statusBadge}</div>
					<button
						type="button"
						className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-slate-900/85 text-slate-100 transition hover:border-sky-400/45 hover:bg-slate-800/90 hover:text-sky-100"
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
						onClick={onToggleMobileMenu}
					>
						{mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
					</button>
				</div>

				<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
					<aside className="hidden min-h-0 lg:block">{sidebar}</aside>
					<main className="min-h-0">{children}</main>
				</div>
			</div>

			{mobileMenuOpen ? (
				<div className="fixed inset-0 z-40 lg:hidden">
					<button
						type="button"
						className="absolute inset-0 bg-black/55"
						aria-label="Close menu"
						onClick={onCloseMobileMenu}
					/>
					<div className="absolute left-0 top-0 h-full w-[86vw] max-w-[340px] border-r border-white/10 bg-slate-950/95 p-4 backdrop-blur">
						{sidebar}
					</div>
				</div>
			) : null}
		</div>
	);
}
