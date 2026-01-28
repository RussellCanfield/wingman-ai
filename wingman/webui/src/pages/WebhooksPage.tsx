import React, { useMemo, useState } from "react";
import type { ControlUiAgent, Thread, Webhook } from "../types";

type WebhooksPageProps = {
	agents: ControlUiAgent[];
	webhooks: Webhook[];
	threads: Thread[];
	loading: boolean;
	baseUrl: string;
	onCreateWebhook: (payload: Omit<Webhook, "createdAt" | "lastTriggeredAt">) => Promise<boolean>;
	onUpdateWebhook: (
		webhookId: string,
		payload: Partial<Omit<Webhook, "id" | "createdAt">>,
	) => Promise<boolean>;
	onDeleteWebhook: (webhookId: string) => Promise<boolean>;
	onTestWebhook: (webhookId: string) => Promise<{ ok: boolean; message?: string }>;
	onRefresh: () => void;
};

const generateSecret = () => {
	const fallback = Math.random().toString(36).slice(2);
	if (!window.crypto?.getRandomValues) return fallback;
	const bytes = new Uint8Array(24);
	window.crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const slugify = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)+/g, "");

const presetOptions = [
	{
		id: "custom",
		name: "Custom",
		description: "Generic JSON payloads.",
	},
	{
		id: "gog-gmail",
		name: "Gmail (gog)",
		description: "Use gogcli Gmail watch payloads.",
	},
];

export const WebhooksPage: React.FC<WebhooksPageProps> = ({
	agents,
	webhooks,
	threads,
	loading,
	baseUrl,
	onCreateWebhook,
	onUpdateWebhook,
	onDeleteWebhook,
	onTestWebhook,
	onRefresh,
}) => {
	const [id, setId] = useState("");
	const [name, setName] = useState("");
	const [agentId, setAgentId] = useState(agents[0]?.id || "main");
	const [secret, setSecret] = useState("");
	const [eventLabel, setEventLabel] = useState("");
	const [preset, setPreset] = useState("custom");
	const [targetSessionId, setTargetSessionId] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [testStatus, setTestStatus] = useState<Record<string, string>>({});

	const agentOptions = useMemo(() => {
		if (agents.length === 0) {
			return [{ id: "main", name: "Main" }];
		}
		return agents;
	}, [agents]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!id.trim() || !name.trim() || !secret.trim()) return;
		setSubmitting(true);
		const payload = {
			id: id.trim(),
			name: name.trim(),
			agentId,
			secret: secret.trim(),
			enabled,
			eventLabel: eventLabel.trim() || undefined,
			preset: preset === "custom" ? undefined : preset,
			sessionId: targetSessionId || undefined,
		};
		const ok = editingId
			? await onUpdateWebhook(editingId, payload)
			: await onCreateWebhook(payload);
		setSubmitting(false);
		if (ok) {
			setId("");
			setName("");
			setSecret("");
			setEventLabel("");
			setEnabled(true);
			setEditingId(null);
		}
	};

	const handleEdit = (webhook: Webhook) => {
		setEditingId(webhook.id);
		setId(webhook.id);
		setName(webhook.name);
		setAgentId(webhook.agentId);
		setSecret(webhook.secret);
		setEventLabel(webhook.eventLabel || "");
		setPreset(webhook.preset || "custom");
		setTargetSessionId(webhook.sessionId || "");
		setEnabled(webhook.enabled);
	};

	const resetForm = () => {
		setEditingId(null);
		setId("");
		setName("");
		setAgentId(agentOptions[0]?.id || "main");
		setSecret("");
		setEventLabel("");
		setPreset("custom");
		setTargetSessionId("");
		setEnabled(true);
	};

	const threadOptions = useMemo(() => {
		return threads.map((thread) => ({
			id: thread.id,
			label: `${thread.name} · ${thread.agentId}`,
			agentId: thread.agentId,
		}));
	}, [threads]);

	const handleTest = async (webhookId: string) => {
		setTestStatus((prev) => ({ ...prev, [webhookId]: "Testing..." }));
		const result = await onTestWebhook(webhookId);
		setTestStatus((prev) => ({
			...prev,
			[webhookId]: result.ok ? "Webhook fired" : result.message || "Test failed",
		}));
	};

	const endpointUrl = id.trim()
		? `${baseUrl.replace(/\/$/, "")}/webhooks/${id.trim()}`
		: "";
	const presetLabelMap = useMemo(() => {
		return presetOptions.reduce<Record<string, string>>((acc, option) => {
			acc[option.id] = option.name;
			return acc;
		}, {});
	}, []);

	return (
		<section className="grid gap-6 xl:grid-cols-[minmax(420px,1fr)_minmax(360px,1fr)]">
			<aside className="panel-card animate-rise space-y-6 p-5">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">Webhooks</h2>
						<p className="text-xs text-slate-500">
							Trigger agents from external systems with a secure endpoint.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button className="button-ghost" type="button" onClick={resetForm}>
							New
						</button>
						<button className="button-ghost" type="button" onClick={onRefresh}>
							Refresh
						</button>
					</div>
				</div>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Webhook Name
						</label>
						<input
							className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							value={name}
							onChange={(event) => {
								setName(event.target.value);
								if (!id) {
									setId(slugify(event.target.value));
								}
							}}
							placeholder="e.g. New Gmail Message"
							required
						/>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Webhook ID
						</label>
						<input
							className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							value={id}
							onChange={(event) => setId(event.target.value)}
							placeholder="gmail-inbox"
							required
							disabled={Boolean(editingId)}
						/>
						{editingId ? (
							<p className="text-xs text-slate-500">
								Webhook ID cannot be changed once created.
							</p>
						) : null}
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Agent
						</label>
						<select
							className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
							value={agentId}
							onChange={(event) => {
								const nextAgent = event.target.value;
								setAgentId(nextAgent);
								if (
									targetSessionId &&
									!threads.some(
										(thread) =>
											thread.id === targetSessionId &&
											thread.agentId === nextAgent,
									)
								) {
									setTargetSessionId("");
								}
							}}
						>
							{agentOptions.map((agent) => (
								<option key={agent.id} value={agent.id}>
									{agent.name || agent.id}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Target Session (optional)
						</label>
						<select
							className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
							value={targetSessionId}
							onChange={(event) => {
								const next = event.target.value;
								setTargetSessionId(next);
								const match = threads.find((thread) => thread.id === next);
								if (match && match.agentId !== agentId) {
									setAgentId(match.agentId);
								}
							}}
						>
							<option value="">Create a new webhook thread</option>
							{threadOptions.map((thread) => (
								<option key={thread.id} value={thread.id}>
									{thread.label}
								</option>
							))}
						</select>
						<p className="text-xs text-slate-500">
							Choose an existing chat to receive webhook output.
						</p>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Secret
						</label>
						<div className="flex gap-2">
							<input
								className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm font-mono"
								value={secret}
								onChange={(event) => setSecret(event.target.value)}
								placeholder="auto-generated secret"
								required
							/>
							<button
								type="button"
								className="button-secondary text-xs"
								onClick={() => setSecret(generateSecret())}
							>
								Generate
							</button>
						</div>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Preset
						</label>
						<select
							className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
							value={preset}
							onChange={(event) => {
								const next = event.target.value;
								setPreset(next);
								if (next === "gog-gmail" && !eventLabel.trim()) {
									setEventLabel("gmail.received");
								}
							}}
						>
							{presetOptions.map((option) => (
								<option key={option.id} value={option.id}>
									{option.name}
								</option>
							))}
						</select>
						<p className="text-xs text-slate-500">
							{presetOptions.find((option) => option.id === preset)?.description}
						</p>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Event Label (optional)
						</label>
						<input
							className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							value={eventLabel}
							onChange={(event) => setEventLabel(event.target.value)}
							placeholder="e.g. email.received"
						/>
					</div>
					{endpointUrl ? (
						<div className="rounded-xl border border-dashed border-black/15 bg-white/70 px-3 py-2 text-xs text-slate-600">
							<div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
								Endpoint
							</div>
							<div className="mt-1 break-all font-mono">{endpointUrl}</div>
						</div>
					) : null}
					{preset === "gog-gmail" && endpointUrl ? (
						<div className="rounded-xl border border-dashed border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800">
							<div className="text-[10px] uppercase tracking-[0.2em] text-emerald-600">
								Gog Gmail Hook
							</div>
							<div className="mt-2 space-y-1 font-mono text-[11px] text-emerald-700">
								<div>gog gmail watch serve \</div>
								<div>  --hook-url {endpointUrl} \</div>
								<div>  --hook-token {secret || "YOUR_SECRET"} \</div>
								<div>  --include-body</div>
							</div>
						</div>
					) : null}
					<div className="flex items-center justify-between rounded-xl border border-dashed border-black/15 bg-white/70 px-3 py-2 text-xs text-slate-600">
						<span>Enabled</span>
						<button
							type="button"
							className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
								enabled
									? "border-emerald-500/40 bg-emerald-100/60 text-emerald-700"
									: "border-black/10 bg-white/70 text-slate-500"
							}`}
							onClick={() => setEnabled(!enabled)}
						>
							{enabled ? "On" : "Off"}
						</button>
					</div>
					<button className="button-primary w-full" type="submit" disabled={submitting}>
						{submitting
							? editingId
								? "Updating..."
								: "Creating..."
							: editingId
								? "Update Webhook"
								: "Create Webhook"}
					</button>
				</form>
			</aside>

			<section className="space-y-6">
				<div className="panel-card animate-rise space-y-4 p-5">
					<div className="flex items-center justify-between">
						<h3 className="text-lg font-semibold">Configured Webhooks</h3>
						{loading ? (
							<span className="text-xs text-slate-500">Loading...</span>
						) : null}
					</div>
					{webhooks.length === 0 ? (
						<div className="rounded-xl border border-dashed border-black/15 bg-white/70 px-3 py-2 text-sm text-slate-500">
							No webhooks configured yet.
						</div>
					) : (
						<div className="space-y-3">
							{webhooks.map((webhook) => (
								<div
									key={webhook.id}
									className="rounded-2xl border border-black/10 bg-white/80 p-4"
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<h4 className="text-sm font-semibold text-slate-800">
												{webhook.name}
											</h4>
											<p className="text-xs text-slate-500">
												Agent: {webhook.agentId}
											</p>
										</div>
										<span className="pill">{webhook.enabled ? "enabled" : "disabled"}</span>
									</div>
									<div className="mt-3 space-y-2 text-xs text-slate-600">
										<div>
											<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
												Endpoint
											</span>
											<div className="mt-1 break-all font-mono">
												{baseUrl.replace(/\/$/, "")}/webhooks/{webhook.id}
											</div>
										</div>
										{webhook.sessionId ? (
											<div>
												<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
													Target Session
												</span>
												<div className="mt-1">
													{threads.find((thread) => thread.id === webhook.sessionId)
														?.name || webhook.sessionId}
												</div>
											</div>
										) : null}
										{webhook.preset ? (
											<div>
												<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
													Preset
												</span>
												<div className="mt-1">
													{presetLabelMap[webhook.preset] || webhook.preset}
												</div>
											</div>
										) : null}
										<div>
											<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
												Secret
											</span>
											<div className="mt-1 font-mono">
												{webhook.secret.slice(0, 6)}•••{webhook.secret.slice(-4)}
											</div>
										</div>
										{webhook.eventLabel ? (
											<div>
												<span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
													Event Label
												</span>
												<div className="mt-1">{webhook.eventLabel}</div>
											</div>
										) : null}
									</div>
									<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
										<div className="flex items-center gap-2">
											<button
												type="button"
												className="button-secondary text-xs"
												onClick={() => handleEdit(webhook)}
											>
												Edit
											</button>
											<button
												type="button"
												className="button-secondary text-xs"
												onClick={() => handleTest(webhook.id)}
											>
												Test
											</button>
											<button
												type="button"
												className="rounded-full border border-transparent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-500 transition hover:border-rose-200/60"
												onClick={() => onDeleteWebhook(webhook.id)}
											>
												Delete
											</button>
										</div>
										<span>{testStatus[webhook.id] || "Ready"}</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</section>
		</section>
	);
};
