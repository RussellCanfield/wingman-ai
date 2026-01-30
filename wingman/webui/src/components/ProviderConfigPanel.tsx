import React, { useMemo, useState } from "react";
import type { ProviderStatus } from "../types";

type ProviderConfigPanelProps = {
	providers: ProviderStatus[];
	loading: boolean;
	credentialsPath?: string;
	updatedAt?: string;
	onRefresh: () => void;
	onSaveToken: (providerName: string, token: string) => Promise<boolean>;
	onClearToken: (providerName: string) => Promise<boolean>;
};

export const ProviderConfigPanel: React.FC<ProviderConfigPanelProps> = ({
	providers,
	loading,
	credentialsPath,
	updatedAt,
	onRefresh,
	onSaveToken,
	onClearToken,
}) => {
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState<Record<string, boolean>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});

	const sortedProviders = useMemo(() => {
		return [...providers].sort((a, b) => a.label.localeCompare(b.label));
	}, [providers]);

	const handleDraftChange = (providerName: string, value: string) => {
		setDrafts((prev) => ({ ...prev, [providerName]: value }));
		setErrors((prev) => ({ ...prev, [providerName]: "" }));
	};

	const handleSave = async (providerName: string) => {
		const token = (drafts[providerName] || "").trim();
		if (!token) {
			setErrors((prev) => ({
				...prev,
				[providerName]: "Token is required.",
			}));
			return;
		}
		setBusy((prev) => ({ ...prev, [providerName]: true }));
		const ok = await onSaveToken(providerName, token);
		setBusy((prev) => ({ ...prev, [providerName]: false }));
		if (ok) {
			setDrafts((prev) => ({ ...prev, [providerName]: "" }));
		}
	};

	const handleClear = async (providerName: string) => {
		setBusy((prev) => ({ ...prev, [providerName]: true }));
		await onClearToken(providerName);
		setBusy((prev) => ({ ...prev, [providerName]: false }));
	};

	return (
		<section className="panel-card animate-rise space-y-4 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="text-lg font-semibold">LLM Providers</h3>
					<p className="text-xs text-slate-400">
						Manage API keys for model providers used by your agents.
					</p>
				</div>
				<button className="button-ghost" type="button" onClick={onRefresh}>
					Refresh
				</button>
			</div>

			{loading ? (
				<div className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
					Loading provider status...
				</div>
			) : null}

			{sortedProviders.length === 0 ? (
				<div className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
					No providers configured.
				</div>
			) : (
				<div className="space-y-3">
					{sortedProviders.map((provider) => {
						const statusLabel =
							provider.source === "missing" ? "Missing" : "Configured";
						const statusTone =
							provider.source === "missing"
								? "border-rose-400/50 bg-rose-500/15 text-rose-200"
								: "border-sky-400/60 bg-sky-500/10 text-sky-300";
						const sourceLabel =
							provider.source === "env"
								? `Env (${provider.envVar || provider.envVars[0] || "set"})`
								: provider.source === "credentials"
									? "Stored credentials"
									: "No credentials saved";

						return (
							<details
								key={provider.name}
								open={provider.source === "missing"}
								className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2"
							>
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
									<div>
										<div className="text-sm font-semibold text-slate-100">
											{provider.label}
										</div>
										<div className="text-xs text-slate-400">
											{sourceLabel}
										</div>
									</div>
									<span
										className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${statusTone}`}
									>
										{statusLabel}
									</span>
								</summary>
								<div className="mt-4 space-y-3">
									<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
										{provider.type === "oauth" ? "Access Token" : "API Key"}
									</label>
									<input
										type="password"
										className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm focus:shadow-glow"
										placeholder={`Paste ${provider.label} ${
											provider.type === "oauth" ? "token" : "API key"
										}`}
										value={drafts[provider.name] || ""}
										onChange={(event) =>
											handleDraftChange(provider.name, event.target.value)
										}
										autoComplete="off"
									/>
									{errors[provider.name] ? (
										<p className="text-xs text-rose-500">
											{errors[provider.name]}
										</p>
									) : null}
									<div className="flex flex-wrap gap-2">
										<button
											className="button-primary"
											type="button"
											disabled={busy[provider.name]}
											onClick={() => handleSave(provider.name)}
										>
											Save
										</button>
										<button
											className="button-secondary"
											type="button"
											disabled={busy[provider.name]}
											onClick={() => handleClear(provider.name)}
										>
											Clear
										</button>
									</div>
									<div className="text-xs text-slate-400">
										Env: {provider.envVars.join(", ")}
									</div>
								</div>
							</details>
						);
					})}
				</div>
			)}

			<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
				<div>Credentials file: {credentialsPath || "--"}</div>
				<div>Last updated: {updatedAt || "--"}</div>
			</div>
		</section>
	);
};
