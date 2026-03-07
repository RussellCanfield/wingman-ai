import type React from "react";
import { CommandDeckPanel } from "../components/CommandDeckPanel";
import { EventLogPanel } from "../components/EventLogPanel";
import { ProviderConfigPanel } from "../components/ProviderConfigPanel";
import { VoiceConfigPanel } from "../components/VoiceConfigPanel";
import type {
	GatewayHealth,
	GatewayStats,
	ProviderStatus,
	VoiceConfig,
} from "../types";

type CommandDeckPageProps = {
	agentId: string;
	activeThreadName?: string;
	wsUrl: string;
	token: string;
	password: string;
	connecting: boolean;
	connected: boolean;
	statusLabel: string;
	health: GatewayHealth;
	stats: GatewayStats;
	authHint: string;
	autoConnect: boolean;
	autoConnectStatus?: string;
	onAutoConnectChange: (value: boolean) => void;
	deviceId: string;
	eventLog: string[];
	providers: ProviderStatus[];
	providersLoading: boolean;
	providersUpdatedAt?: string;
	credentialsPath?: string;
	voiceConfig?: VoiceConfig;
	onWsUrlChange: (value: string) => void;
	onTokenChange: (value: string) => void;
	onPasswordChange: (value: string) => void;
	onConnect: () => void;
	onDisconnect: () => void;
	onRefresh: () => void;
	onResetDevice: () => void;
	onRefreshProviders: () => void;
	onSaveProviderToken: (
		providerName: string,
		token: string,
	) => Promise<boolean>;
	onClearProviderToken: (providerName: string) => Promise<boolean>;
	onSaveVoiceConfig: (voice: Partial<VoiceConfig>) => Promise<boolean>;
};

export const CommandDeckPage: React.FC<CommandDeckPageProps> = ({
	agentId,
	activeThreadName,
	wsUrl,
	token,
	password,
	connecting,
	connected,
	statusLabel,
	health,
	stats,
	authHint,
	autoConnect,
	autoConnectStatus,
	onAutoConnectChange,
	deviceId,
	eventLog,
	providers,
	providersLoading,
	providersUpdatedAt,
	credentialsPath,
	voiceConfig,
	onWsUrlChange,
	onTokenChange,
	onPasswordChange,
	onConnect,
	onDisconnect,
	onRefresh,
	onResetDevice,
	onRefreshProviders,
	onSaveProviderToken,
	onClearProviderToken,
	onSaveVoiceConfig,
}) => {
	const runtimeIndicatorClass = connected
		? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
		: connecting
			? "border-sky-400/40 bg-sky-500/10 text-sky-100"
			: "border-slate-500/40 bg-slate-900/70 text-slate-300";
	const runtimeDotClass = connected
		? "bg-emerald-400"
		: connecting
			? "bg-sky-400 animate-pulseSoft"
			: "bg-slate-500";

	return (
		<section className="space-y-6">
			<section className="panel-card animate-rise space-y-5 p-5">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.2em] text-slate-400">
							Gateway Runtime
						</p>
						<h2 className="text-lg font-semibold">Status Overview</h2>
						<p className="text-sm text-slate-300">
							Live gateway health, runtime capacity, and current routing
							context.
						</p>
					</div>
					<div
						className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${runtimeIndicatorClass}`}
					>
						<span className={`h-2 w-2 rounded-full ${runtimeDotClass}`} />
						{statusLabel}
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					<div className="stat-card p-4">
						<p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
							Health
						</p>
						<strong className="mt-2 block text-lg text-slate-100">
							{health.status || "--"}
						</strong>
					</div>
					<div className="stat-card p-4">
						<p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
							Nodes
						</p>
						<strong className="mt-2 block text-lg text-slate-100">
							{stats.nodes?.totalNodes ?? "--"}
						</strong>
					</div>
					<div className="stat-card p-4">
						<p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
							Groups
						</p>
						<strong className="mt-2 block text-lg text-slate-100">
							{stats.groups?.totalGroups ?? "--"}
						</strong>
					</div>
				</div>

				<div className="flex flex-wrap gap-2 text-xs text-slate-300">
					<span className="pill">agent: {agentId}</span>
					<span className="pill">thread: {activeThreadName || "--"}</span>
					<span className="pill">device: {deviceId || "--"}</span>
				</div>
			</section>

			<section className="grid gap-6 lg:grid-cols-[360px_1fr]">
				<CommandDeckPanel
					wsUrl={wsUrl}
					token={token}
					password={password}
					connecting={connecting}
					connected={connected}
					authHint={authHint}
					autoConnect={autoConnect}
					autoConnectStatus={autoConnectStatus}
					onAutoConnectChange={onAutoConnectChange}
					deviceId={deviceId}
					onWsUrlChange={onWsUrlChange}
					onTokenChange={onTokenChange}
					onPasswordChange={onPasswordChange}
					onConnect={onConnect}
					onDisconnect={onDisconnect}
					onRefresh={onRefresh}
					onResetDevice={onResetDevice}
				/>
				<div className="space-y-6">
					<EventLogPanel eventLog={eventLog} />
					<ProviderConfigPanel
						providers={providers}
						loading={providersLoading}
						credentialsPath={credentialsPath}
						updatedAt={providersUpdatedAt}
						onRefresh={onRefreshProviders}
						onSaveToken={onSaveProviderToken}
						onClearToken={onClearProviderToken}
					/>
					<VoiceConfigPanel
						voiceConfig={voiceConfig}
						onSave={onSaveVoiceConfig}
					/>
					<section className="panel-card animate-rise space-y-3 p-5">
						<h3 className="text-lg font-semibold">Security Notes</h3>
						<p className="text-sm text-slate-300">
							Keep your gateway bound to localhost unless you are tunneling
							through a trusted network such as Tailscale or SSH. Tokens remain
							the safest option for remote access.
						</p>
						<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
							Device ID: <span className="font-mono">{deviceId || "--"}</span>
						</div>
					</section>
				</div>
			</section>
		</section>
	);
};
