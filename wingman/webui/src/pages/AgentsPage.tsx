import React, { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import type {
	AgentDetail,
	AgentSummary,
	AgentVoiceConfig,
	ProviderStatus,
	VoiceProvider,
} from "../types";

type AgentsPageProps = {
	agents: AgentSummary[];
	availableTools: string[];
	builtInTools: string[];
	providers: ProviderStatus[];
	loading: boolean;
	onCreateAgent: (payload: {
		id: string;
		displayName?: string;
		description?: string;
		model?: string;
		tools: string[];
		prompt?: string;
		voice?: AgentVoiceConfig | null;
	}) => Promise<boolean>;
	onUpdateAgent: (agentId: string, payload: {
		displayName?: string;
		description?: string;
		model?: string;
		tools: string[];
		prompt?: string;
		voice?: AgentVoiceConfig | null;
	}) => Promise<boolean>;
	onLoadAgent: (agentId: string) => Promise<AgentDetail | null>;
	onRefresh: () => void;
};

export const AgentsPage: React.FC<AgentsPageProps> = ({
	agents,
	availableTools,
	builtInTools,
	providers,
	loading,
	onCreateAgent,
	onUpdateAgent,
	onLoadAgent,
	onRefresh,
}) => {
	const [id, setId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [description, setDescription] = useState("");
	const [model, setModel] = useState("");
	const [prompt, setPrompt] = useState("");
	const [selectedTools, setSelectedTools] = useState<string[]>([]);
	const [voiceProvider, setVoiceProvider] = useState<"inherit" | VoiceProvider>("inherit");
	const [voiceName, setVoiceName] = useState("");
	const [voiceLang, setVoiceLang] = useState("");
	const [voiceRate, setVoiceRate] = useState("");
	const [voicePitch, setVoicePitch] = useState("");
	const [voiceVolume, setVoiceVolume] = useState("");
	const [elevenVoiceId, setElevenVoiceId] = useState("");
	const [elevenModelId, setElevenModelId] = useState("");
	const [elevenStability, setElevenStability] = useState("");
	const [elevenSimilarity, setElevenSimilarity] = useState("");
	const [elevenStyle, setElevenStyle] = useState("");
	const [elevenSpeed, setElevenSpeed] = useState("");
	const [elevenOutputFormat, setElevenOutputFormat] = useState("");
	const [elevenOptimizeLatency, setElevenOptimizeLatency] = useState("");
	const [elevenSpeakerBoost, setElevenSpeakerBoost] = useState<boolean | null>(null);
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
	const [loadingDetails, setLoadingDetails] = useState(false);
	const [mobilePanel, setMobilePanel] = useState<"editor" | "topology">("editor");

	const graphData = useMemo(() => buildGraph(agents), [agents]);
	const selectedAgent = useMemo(() => {
		if (!selectedAgentId) return null;
		return graphData.lookup[selectedAgentId] || null;
	}, [graphData.lookup, selectedAgentId]);
	const isEditing = Boolean(editingAgentId);
	const configuredProviders = useMemo(
		() =>
			providers.filter(
				(provider) =>
					provider.source !== "missing" && provider.category !== "voice",
			),
		[providers],
	);
	const providerExamples = useMemo(
		() => [
			{ id: "openai", example: "openai:gpt-4o" },
			{ id: "anthropic", example: "anthropic:claude-sonnet-4-5" },
			{ id: "openrouter", example: "openrouter:openai/gpt-4o" },
			{ id: "xai", example: "xai:grok-beta" },
			{ id: "copilot", example: "copilot:gpt-4o" },
			{ id: "lmstudio", example: "lmstudio:llama-3.1-8b" },
			{ id: "ollama", example: "ollama:llama3.2" },
		],
		[],
	);

	const parseNumber = (value: string): number | undefined => {
		if (!value.trim()) return undefined;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	};

	const buildVoicePayload = (): AgentVoiceConfig | null => {
		if (voiceProvider === "inherit") {
			return null;
		}
		const payload: AgentVoiceConfig = {
			provider: voiceProvider as VoiceProvider,
		};
		if (voiceProvider === "web_speech") {
			payload.webSpeech = {
				voiceName: voiceName.trim() || undefined,
				lang: voiceLang.trim() || undefined,
				rate: parseNumber(voiceRate),
				pitch: parseNumber(voicePitch),
				volume: parseNumber(voiceVolume),
			};
		}
		if (voiceProvider === "elevenlabs") {
			payload.elevenlabs = {
				voiceId: elevenVoiceId.trim() || undefined,
				modelId: elevenModelId.trim() || undefined,
				stability: parseNumber(elevenStability),
				similarityBoost: parseNumber(elevenSimilarity),
				style: parseNumber(elevenStyle),
				speed: parseNumber(elevenSpeed),
				outputFormat: elevenOutputFormat.trim() || undefined,
				optimizeStreamingLatency: parseNumber(elevenOptimizeLatency),
				speakerBoost: elevenSpeakerBoost ?? undefined,
			};
		}
		return payload;
	};

	const applyVoiceConfig = (voice?: AgentVoiceConfig) => {
		if (!voice) {
			setVoiceProvider("inherit");
			setVoiceName("");
			setVoiceLang("");
			setVoiceRate("");
			setVoicePitch("");
			setVoiceVolume("");
			setElevenVoiceId("");
			setElevenModelId("");
			setElevenStability("");
			setElevenSimilarity("");
			setElevenStyle("");
			setElevenSpeed("");
			setElevenOutputFormat("");
			setElevenOptimizeLatency("");
		setElevenSpeakerBoost(null);
			return;
		}
		const provider =
			voice.provider ||
			(voice.elevenlabs ? "elevenlabs" : voice.webSpeech ? "web_speech" : "inherit");
		setVoiceProvider(provider as "inherit" | VoiceProvider);
		setVoiceName(voice.webSpeech?.voiceName || "");
		setVoiceLang(voice.webSpeech?.lang || "");
		setVoiceRate(
			voice.webSpeech?.rate !== undefined ? String(voice.webSpeech.rate) : "",
		);
		setVoicePitch(
			voice.webSpeech?.pitch !== undefined ? String(voice.webSpeech.pitch) : "",
		);
		setVoiceVolume(
			voice.webSpeech?.volume !== undefined ? String(voice.webSpeech.volume) : "",
		);
		setElevenVoiceId(voice.elevenlabs?.voiceId || "");
		setElevenModelId(voice.elevenlabs?.modelId || "");
		setElevenStability(
			voice.elevenlabs?.stability !== undefined ? String(voice.elevenlabs.stability) : "",
		);
		setElevenSimilarity(
			voice.elevenlabs?.similarityBoost !== undefined
				? String(voice.elevenlabs.similarityBoost)
				: "",
		);
		setElevenStyle(
			voice.elevenlabs?.style !== undefined ? String(voice.elevenlabs.style) : "",
		);
		setElevenSpeed(
			voice.elevenlabs?.speed !== undefined ? String(voice.elevenlabs.speed) : "",
		);
		setElevenOutputFormat(voice.elevenlabs?.outputFormat || "");
		setElevenOptimizeLatency(
			voice.elevenlabs?.optimizeStreamingLatency !== undefined
				? String(voice.elevenlabs.optimizeStreamingLatency)
				: "",
		);
		setElevenSpeakerBoost(voice.elevenlabs?.speakerBoost ?? null);
	};

	const toggleTool = (tool: string) => {
		setSelectedTools((prev) =>
			prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool],
		);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!id.trim() || !prompt.trim()) return;
		setSubmitting(true);
		const voicePayload = buildVoicePayload();
		const payload = {
			displayName: displayName.trim() || undefined,
			description: description.trim() || undefined,
			model: model.trim() || undefined,
			tools: selectedTools,
			prompt: prompt.trim() || undefined,
			voice: voicePayload,
		};
		const ok = isEditing && editingAgentId
			? await onUpdateAgent(editingAgentId, payload)
			: await onCreateAgent({
				id: id.trim(),
				...payload,
			});
		setSubmitting(false);
		if (ok) {
			setId("");
			setDisplayName("");
			setDescription("");
			setModel("");
			setPrompt("");
			setSelectedTools([]);
			setEditingAgentId(null);
			applyVoiceConfig(undefined);
		}
	};

	const loadAgentForEdit = async () => {
		if (!selectedAgent) return;
		setLoadingDetails(true);
		const detail = await onLoadAgent(selectedAgent.id);
		setLoadingDetails(false);
		if (!detail) return;
		setEditingAgentId(detail.id);
		setId(detail.id);
		setDisplayName(detail.displayName || "");
		setDescription(detail.description || "");
		setModel(detail.model || "");
		setPrompt(detail.prompt || "");
		setSelectedTools(detail.tools || []);
		applyVoiceConfig(detail.voice);
	};

	const resetForm = () => {
		setEditingAgentId(null);
		setId("");
		setDisplayName("");
		setDescription("");
		setModel("");
		setPrompt("");
		setSelectedTools([]);
		applyVoiceConfig(undefined);
	};

	return (
		<section className="space-y-6">
			<div className="flex items-center justify-between gap-3 lg:hidden">
				<div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 p-1 text-xs font-semibold text-slate-300">
					<button
						type="button"
						className={`rounded-full px-3 py-1 transition ${mobilePanel === "editor"
							? "bg-sky-500/20 text-sky-300"
							: "text-slate-400"
							}`}
						onClick={() => setMobilePanel("editor")}
					>
						Editor
					</button>
					<button
						type="button"
						className={`rounded-full px-3 py-1 transition ${mobilePanel === "topology"
							? "bg-sky-500/20 text-sky-300"
							: "text-slate-400"
							}`}
						onClick={() => setMobilePanel("topology")}
					>
						Topology
					</button>
				</div>
			</div>

			<div className="grid gap-6 xl:grid-cols-[minmax(420px,1.4fr)_minmax(360px,1fr)]">
				<aside
					className={`panel-card animate-rise space-y-6 p-5 ${mobilePanel === "topology" ? "hidden lg:block" : ""
						}`}
				>
					<div className="flex items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">Agents</h2>
							<p className="text-xs text-slate-400">Create and inspect agent configs.</p>
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

					<div className="space-y-3">
						<p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
							Built-in Tools (always available)
						</p>
						<div className="flex flex-wrap gap-2">
							{builtInTools.map((tool) => (
								<span key={tool} className="pill">
									{tool}
								</span>
							))}
						</div>
					</div>

					<form className="space-y-4" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
								Agent ID
							</label>
							<input
								className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
								value={id}
								onChange={(event) => setId(event.target.value)}
								placeholder="e.g. design-lead"
								required
								disabled={isEditing}
							/>
							{isEditing ? (
								<p className="text-xs text-slate-400">
									Editing agent <span className="font-mono">{editingAgentId}</span>. Agent
									ID cannot be changed.
								</p>
							) : null}
						</div>
						<div className="space-y-4">
							<div className="space-y-2">
								<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
									Display Name
								</label>
								<input
									className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
									value={displayName}
									onChange={(event) => setDisplayName(event.target.value)}
									placeholder="Agent label"
								/>
							</div>
							<div className="space-y-2">
								<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
									Model
								</label>
								<input
									className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
									value={model}
									onChange={(event) => setModel(event.target.value)}
									placeholder="(Example) provider:model-name"
								/>
								<div className="rounded-xl border border-dashed border-white/10 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-300">
									<div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
										Model Format
									</div>
									<p className="mt-2 text-xs">
										Use <span className="font-mono">provider:model-name</span>. If a
										provider is configured, it will appear below.
									</p>
									{configuredProviders.length > 0 ? (
										<div className="mt-3 space-y-2">
											<div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
												Configured Providers
											</div>
											<div className="grid gap-2">
												{configuredProviders.map((provider) => {
													const example = providerExamples.find(
														(item) => item.id === provider.name,
													)?.example;
													return (
														<div
															key={provider.name}
															className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-[11px]"
														>
															<span className="pill">{provider.label}</span>
															{example ? (
																<span className="font-mono text-slate-300">{example}</span>
															) : (
																<span className="text-slate-400">example coming soon</span>
															)}
														</div>
													);
												})}
											</div>
										</div>
									) : null}
								</div>
							</div>
						</div>
						<div className="space-y-2">
							<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
								Description
							</label>
							<textarea
								className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
								rows={2}
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Short description of the agent."
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
								System Prompt
							</label>
							<textarea
								className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
								rows={4}
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
								placeholder="Required: describe how this agent should behave."
								required
							/>
						</div>
						<div className="space-y-2">
							<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
								Tools
							</label>
							<div className="flex flex-wrap gap-2">
								{availableTools.map((tool) => (
									<button
										key={tool}
										type="button"
										className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${selectedTools.includes(tool)
											? "border-sky-500/50 bg-sky-500/15 text-sky-300"
											: "border-white/10 bg-slate-900/60 text-slate-300"
											}`}
										onClick={() => toggleTool(tool)}
									>
										{tool}
									</button>
								))}
							</div>
						</div>
						<details className="group rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3">
							<summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
								Voice Settings (Optional)
							</summary>
							<div className="mt-4 space-y-3 text-xs text-slate-300">
								<div className="space-y-2">
									<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
										Voice Provider
									</label>
									<select
										className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
										value={voiceProvider}
										onChange={(event) => setVoiceProvider(event.target.value as "inherit" | VoiceProvider)}
									>
										<option value="inherit">Inherit gateway defaults</option>
										<option value="web_speech">Web Speech</option>
										<option value="elevenlabs">ElevenLabs</option>
									</select>
								</div>
								{voiceProvider === "web_speech" ? (
									<div className="grid gap-3 md:grid-cols-2">
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Voice name (optional)"
											value={voiceName}
											onChange={(event) => setVoiceName(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Language (e.g. en-US)"
											value={voiceLang}
											onChange={(event) => setVoiceLang(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Rate (0.1 - 4)"
											value={voiceRate}
											onChange={(event) => setVoiceRate(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Pitch (0 - 2)"
											value={voicePitch}
											onChange={(event) => setVoicePitch(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Volume (0 - 1)"
											value={voiceVolume}
											onChange={(event) => setVoiceVolume(event.target.value)}
										/>
									</div>
								) : null}
								{voiceProvider === "elevenlabs" ? (
									<div className="grid gap-3 md:grid-cols-2">
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Voice ID"
											value={elevenVoiceId}
											onChange={(event) => setElevenVoiceId(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Model ID (optional)"
											value={elevenModelId}
											onChange={(event) => setElevenModelId(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Stability (0 - 1)"
											value={elevenStability}
											onChange={(event) => setElevenStability(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Similarity boost (0 - 1)"
											value={elevenSimilarity}
											onChange={(event) => setElevenSimilarity(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Style (0 - 1)"
											value={elevenStyle}
											onChange={(event) => setElevenStyle(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Speed (0.25 - 4)"
											value={elevenSpeed}
											onChange={(event) => setElevenSpeed(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Output format"
											value={elevenOutputFormat}
											onChange={(event) => setElevenOutputFormat(event.target.value)}
										/>
										<input
											className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
											placeholder="Optimize latency (0-4)"
											value={elevenOptimizeLatency}
											onChange={(event) => setElevenOptimizeLatency(event.target.value)}
										/>
										<label className="flex items-center gap-2 text-xs text-slate-300">
											<input
												type="checkbox"
												checked={elevenSpeakerBoost ?? false}
												onChange={(event) => setElevenSpeakerBoost(event.target.checked)}
											/>
											Use speaker boost
										</label>
									</div>
								) : null}
							</div>
						</details>
						<button className="button-primary w-full" type="submit" disabled={submitting}>
							{submitting
								? isEditing
									? "Updating..."
									: "Creating..."
								: isEditing
									? "Update Agent"
									: "Create Agent"}
						</button>
					</form>
				</aside>

				<section
					className={`space-y-6 ${mobilePanel === "editor" ? "hidden lg:block" : ""
						}`}
				>
					<div className="panel-card animate-rise space-y-4 p-5">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">Agent Topology</h3>
							{loading ? (
								<span className="text-xs text-slate-400">Loading...</span>
							) : null}
						</div>
						<div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
							{selectedAgent ? (
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-3">
										<div>
											<div className="text-sm font-semibold text-slate-100">{selectedAgent.displayName}</div>
											<div className="text-xs text-slate-400">{selectedAgent.id}</div>
										</div>
										<button
											type="button"
											className="button-secondary text-xs"
											onClick={loadAgentForEdit}
											disabled={loadingDetails}
										>
											{loadingDetails ? "Loading..." : "Edit"}
										</button>
									</div>
									{selectedAgent.description ? (
										<p className="text-xs text-slate-300">{selectedAgent.description}</p>
									) : null}
									{selectedAgent.model ? (
										<div className="text-xs text-slate-400">
											Model: <span className="font-mono">{selectedAgent.model}</span>
										</div>
									) : null}
									<div className="flex flex-wrap gap-2">
										{selectedAgent.tools.map((tool) => (
											<span key={tool} className="pill">
												{tool}
											</span>
										))}
									</div>
									{selectedAgent.parentId ? (
										<div className="text-xs text-slate-400">
											Subagent of{" "}
											<span className="font-mono">{selectedAgent.parentId}</span>
										</div>
									) : null}
								</div>
							) : (
								<div className="text-xs text-slate-400">
									Select an agent node to see details.
								</div>
							)}
						</div>
					</div>

					<div className="panel-card animate-rise h-[520px] p-4">
						<ReactFlow
							nodes={graphData.nodes}
							edges={graphData.edges}
							fitView
							onNodeClick={(_, node) => setSelectedAgentId(node.id)}
						>
							<Background />
							<Controls />
							<MiniMap />
						</ReactFlow>
					</div>
				</section>
			</div>
		</section>
	);
};

function buildGraph(agents: AgentSummary[]) {
	const nodes: Array<{ id: string; data: { label: string }; position: { x: number; y: number } }> = [];
	const edges: Array<{ id: string; source: string; target: string }> = [];
	const lookup: Record<string, {
		id: string;
		displayName: string;
		description?: string;
		tools: string[];
		model?: string;
		parentId?: string;
	}> = {};

	const gapX = 220;
	const gapY = 160;
	agents.forEach((agent, index) => {
		const id = `agent-${agent.id}`;
		nodes.push({
			id,
			data: { label: agent.displayName },
			position: { x: (index % 3) * gapX, y: Math.floor(index / 3) * gapY },
		});
		lookup[id] = {
			id: agent.id,
			displayName: agent.displayName,
			description: agent.description,
			tools: agent.tools,
			model: agent.model,
		};

		agent.subAgents?.forEach((subAgent, subIndex) => {
			const subId = `${id}-sub-${subAgent.id}`;
			nodes.push({
				id: subId,
				data: { label: subAgent.displayName },
				position: { x: (index % 3) * gapX + 180, y: Math.floor(index / 3) * gapY + (subIndex + 1) * 80 },
			});
			lookup[subId] = {
				id: subAgent.id,
				displayName: subAgent.displayName,
				description: subAgent.description,
				tools: subAgent.tools,
				model: subAgent.model,
				parentId: agent.id,
			};
			edges.push({
				id: `${id}->${subId}`,
				source: id,
				target: subId,
			});
		});
	});

	return { nodes, edges, lookup };
}
