import React from "react";
import { CommandDeckPanel } from "../components/CommandDeckPanel";
import { EventLogPanel } from "../components/EventLogPanel";
import { ProviderConfigPanel } from "../components/ProviderConfigPanel";
import { VoiceConfigPanel } from "../components/VoiceConfigPanel";
import type { ProviderStatus, VoiceConfig } from "../types";

type CommandDeckPageProps = {
	wsUrl: string;
	token: string;
	password: string;
	connecting: boolean;
	connected: boolean;
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
	onSaveProviderToken: (providerName: string, token: string) => Promise<boolean>;
	onClearProviderToken: (providerName: string) => Promise<boolean>;
	onSaveVoiceConfig: (voice: Partial<VoiceConfig>) => Promise<boolean>;
};

export const CommandDeckPage: React.FC<CommandDeckPageProps> = ({
	wsUrl,
	token,
	password,
	connecting,
	connected,
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
	return (
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
				<VoiceConfigPanel voiceConfig={voiceConfig} onSave={onSaveVoiceConfig} />
				<section className="panel-card animate-rise space-y-3 p-5">
					<h3 className="text-lg font-semibold">Security Notes</h3>
					<p className="text-sm text-slate-300">
						Keep your gateway bound to localhost unless you are tunneling through a trusted network such as
						Tailscale or SSH. Tokens remain the safest option for remote access.
					</p>
					<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
						Device ID: <span className="font-mono">{deviceId || "--"}</span>
					</div>
				</section>
			</div>
		</section>
	);
};
