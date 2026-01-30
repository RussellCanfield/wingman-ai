import React, { useMemo, useState } from "react";
import type { ControlUiAgent, Routine, Thread } from "../types";

type RoutinesPageProps = {
	agents: ControlUiAgent[];
	routines: Routine[];
	threads: Thread[];
	loading: boolean;
	onCreateRoutine: (routine: Omit<Routine, "id" | "createdAt">) => Promise<boolean>;
	onDeleteRoutine: (id: string) => Promise<boolean>;
};

const PRESET_CRONS = [
	{ label: "Every hour", value: "0 * * * *" },
	{ label: "Every day 9am", value: "0 9 * * *" },
	{ label: "Weekdays 9am", value: "0 9 * * 1-5" },
	{ label: "Every Monday 9am", value: "0 9 * * 1" },
];

export const RoutinesPage: React.FC<RoutinesPageProps> = ({
	agents,
	routines,
	threads,
	loading,
	onCreateRoutine,
	onDeleteRoutine,
}) => {
	const [name, setName] = useState("");
	const [cron, setCron] = useState("0 9 * * *");
	const [agentId, setAgentId] = useState(agents[0]?.id || "main");
	const [prompt, setPrompt] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [targetSessionId, setTargetSessionId] = useState("");

	const canSubmit = name.trim() && cron.trim() && prompt.trim();

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSubmit) return;
		const ok = await onCreateRoutine({
			name: name.trim(),
			agentId,
			cron: cron.trim(),
			prompt: prompt.trim(),
			sessionId: targetSessionId || undefined,
			enabled,
		});
		if (!ok) return;
		setName("");
		setCron("0 9 * * *");
		setPrompt("");
		setEnabled(true);
		setTargetSessionId("");
	};

	const agentOptions = useMemo(() => {
		if (agents.length === 0) {
			return [{ id: "main", name: "Main" }];
		}
		return agents;
	}, [agents]);

	const threadOptions = useMemo(() => {
		return threads.map((thread) => ({
			id: thread.id,
			label: `${thread.name} · ${thread.agentId}`,
			agentId: thread.agentId,
		}));
	}, [threads]);

	return (
		<section className="grid gap-6 lg:grid-cols-[360px_1fr]">
			<aside className="panel-card animate-rise space-y-6 p-5">
				<div>
					<h2 className="text-lg font-semibold">Routines</h2>
					<p className="text-xs text-slate-500">
						Schedule recurring runs for any agent using cron.
					</p>
				</div>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Routine Name
						</label>
						<input
							className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Daily status report"
							required
						/>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Schedule (CRON)
						</label>
						<input
							className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							value={cron}
							onChange={(event) => setCron(event.target.value)}
							placeholder="0 9 * * *"
							required
						/>
						<div className="flex flex-wrap gap-2">
							{PRESET_CRONS.map((preset) => (
								<button
									key={preset.value}
									type="button"
									className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs text-slate-600 transition hover:border-emerald-200/60"
									onClick={() => setCron(preset.value)}
								>
									{preset.label}
								</button>
							))}
						</div>
						<p className="text-xs text-slate-500">
							Use standard 5‑field cron syntax. Example:{" "}
							<span className="font-mono">0 9 * * 1-5</span>.
						</p>
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
							<option value="">Create a routine thread</option>
							{threadOptions.map((thread) => (
								<option key={thread.id} value={thread.id}>
									{thread.label}
								</option>
							))}
						</select>
						<p className="text-xs text-slate-500">
							Send routine output to an existing chat.
						</p>
					</div>
					<div className="space-y-2">
						<label className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
							Prompt
						</label>
						<textarea
							className="w-full rounded-xl border border-black/10 bg-white/90 px-3 py-2 text-sm"
							rows={4}
							value={prompt}
							onChange={(event) => setPrompt(event.target.value)}
							placeholder="What should the agent do each run?"
							required
						/>
					</div>
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
					<button className="button-primary w-full" type="submit" disabled={!canSubmit}>
						Create Routine
					</button>
				</form>
			</aside>

			<section className="space-y-6">
				<div className="panel-card animate-rise space-y-4 p-5">
					<h3 className="text-lg font-semibold">Scheduled Runs</h3>
					{loading ? (
						<div className="rounded-xl border border-dashed border-black/15 bg-white/70 px-3 py-2 text-sm text-slate-500">
							Loading routines...
						</div>
					) : routines.length === 0 ? (
						<div className="rounded-xl border border-dashed border-black/15 bg-white/70 px-3 py-2 text-sm text-slate-500">
							No routines created yet.
						</div>
					) : (
						<div className="space-y-3">
							{routines.map((routine) => (
								<div
									key={routine.id}
									className="rounded-2xl border border-black/10 bg-white/80 p-4"
								>
									<div className="flex items-center justify-between gap-3">
										<div>
											<h4 className="text-sm font-semibold text-slate-800">{routine.name}</h4>
											<p className="text-xs text-slate-500">
												Agent: {routine.agentId}
											</p>
										</div>
										<span className="pill">{routine.enabled ? "enabled" : "disabled"}</span>
									</div>
									<div className="mt-3 text-xs text-slate-600">
										<div>
											<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Cron</span>
											<div className="mt-1 font-mono">{routine.cron}</div>
										</div>
										{routine.sessionId ? (
											<div className="mt-2">
												<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
													Target Session
												</span>
												<div className="mt-1">
													{threads.find((thread) => thread.id === routine.sessionId)
														?.name || routine.sessionId}
												</div>
											</div>
										) : null}
										<div className="mt-2">
											<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Prompt</span>
											<div className="mt-1 line-clamp-2">{routine.prompt}</div>
										</div>
									</div>
									<div className="mt-3 flex items-center justify-between text-xs text-slate-500">
										<span>
											Created {new Date(routine.createdAt).toLocaleDateString()}
										</span>
											<button
												type="button"
												className="rounded-full border border-transparent px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-rose-500 transition hover:border-rose-200/60"
												onClick={() => void onDeleteRoutine(routine.id)}
											>
											Delete
										</button>
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
