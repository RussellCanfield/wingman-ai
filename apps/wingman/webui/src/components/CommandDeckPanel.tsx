import React from "react";

type CommandDeckPanelProps = {
	wsUrl: string;
	token: string;
	password: string;
	connecting: boolean;
	connected: boolean;
	authHint: string;
	autoConnect: boolean;
	autoConnectStatus?: string;
	onAutoConnectChange: (value: boolean) => void;
	onWsUrlChange: (value: string) => void;
	onTokenChange: (value: string) => void;
	onPasswordChange: (value: string) => void;
	onConnect: () => void;
	onDisconnect: () => void;
	onRefresh: () => void;
	deviceId: string;
	onResetDevice: () => void;
};

export const CommandDeckPanel: React.FC<CommandDeckPanelProps> = ({
	wsUrl,
	token,
	password,
	connecting,
	connected,
	authHint,
	autoConnect,
	autoConnectStatus,
	onAutoConnectChange,
	onWsUrlChange,
	onTokenChange,
	onPasswordChange,
	onConnect,
	onDisconnect,
	onRefresh,
	deviceId,
	onResetDevice,
}) => {
	const statusLabel = connected ? "Connected" : connecting ? "Connecting" : "Disconnected";

	return (
		<aside className="panel-card animate-rise space-y-6 p-5">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">Command Deck</h2>
				<p className="text-xs uppercase tracking-[0.2em] text-slate-400">Connection + identity</p>
				<div className="flex items-center gap-2 text-xs text-slate-400">
					<span className="pill">status: {statusLabel}</span>
				</div>
			</div>

			<div className="space-y-3">
				<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">WebSocket URL</label>
				<input
					className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(0,0,0,0.03)] focus:shadow-glow"
					value={wsUrl}
					onChange={(event) => onWsUrlChange(event.target.value)}
				/>
				<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Token (optional)</label>
				<input
					type="password"
					className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm focus:shadow-glow"
					value={token}
					onChange={(event) => onTokenChange(event.target.value)}
					autoComplete="off"
				/>
				<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Password (optional)</label>
				<input
					type="password"
					className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm focus:shadow-glow"
					value={password}
					onChange={(event) => onPasswordChange(event.target.value)}
					autoComplete="off"
				/>
				<div className="flex items-center justify-between rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
					<span>Auto-connect</span>
					<button
						type="button"
						className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
							autoConnect
								? "border-sky-500/50 bg-sky-500/15 text-sky-300"
								: "border-white/10 bg-slate-950/50 text-slate-400"
						}`}
						onClick={() => onAutoConnectChange(!autoConnect)}
					>
						{autoConnect ? "On" : "Off"}
					</button>
				</div>
				{autoConnectStatus ? (
					<div className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
						{autoConnectStatus}
					</div>
				) : null}
				<div className="flex flex-wrap gap-2 pt-2">
					<button className="button-primary" onClick={onConnect} disabled={connecting} type="button">
						Connect
					</button>
					<button className="button-secondary" onClick={onDisconnect} type="button">
						Disconnect
					</button>
					<button className="button-ghost" onClick={onRefresh} type="button">
						Refresh
					</button>
				</div>
				<p className="text-xs text-slate-400">{authHint}</p>
			</div>

			<div className="space-y-3">
				<h3 className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Identity</h3>
				<div className="flex items-center gap-2 text-sm text-slate-300">
					<span>Device</span>
					<span className="pill">{deviceId || "--"}</span>
					<button className="button-secondary" onClick={onResetDevice} type="button">
						Reset
					</button>
				</div>
				<div className="flex items-center gap-2 text-sm text-slate-300">
					<span>Routing</span>
					<span className="pill">webui / channel / {deviceId || "--"}</span>
				</div>
			</div>
		</aside>
	);
};
