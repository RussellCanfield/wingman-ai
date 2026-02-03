import React, { useEffect, useMemo, useState } from "react";
import type { VoiceConfig } from "../types";

type VoiceConfigPanelProps = {
	voiceConfig?: VoiceConfig;
	onSave: (voice: Partial<VoiceConfig>) => Promise<boolean>;
};

const toNumber = (value: string): number | undefined => {
	if (!value.trim()) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

export const VoiceConfigPanel: React.FC<VoiceConfigPanelProps> = ({
	voiceConfig,
	onSave,
}) => {
	const [provider, setProvider] = useState("web_speech");
	const [defaultPolicy, setDefaultPolicy] = useState("off");
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
	const [saving, setSaving] = useState(false);

	const providerLabel = useMemo(() => {
		return provider === "elevenlabs" ? "ElevenLabs" : "Web Speech";
	}, [provider]);

	useEffect(() => {
		if (!voiceConfig) return;
		setProvider(voiceConfig.provider || "web_speech");
		setDefaultPolicy(voiceConfig.defaultPolicy || "off");
		setVoiceName(voiceConfig.webSpeech?.voiceName || "");
		setVoiceLang(voiceConfig.webSpeech?.lang || "");
		setVoiceRate(
			voiceConfig.webSpeech?.rate !== undefined
				? String(voiceConfig.webSpeech.rate)
				: "",
		);
		setVoicePitch(
			voiceConfig.webSpeech?.pitch !== undefined
				? String(voiceConfig.webSpeech.pitch)
				: "",
		);
		setVoiceVolume(
			voiceConfig.webSpeech?.volume !== undefined
				? String(voiceConfig.webSpeech.volume)
				: "",
		);
		setElevenVoiceId(voiceConfig.elevenlabs?.voiceId || "");
		setElevenModelId(voiceConfig.elevenlabs?.modelId || "");
		setElevenStability(
			voiceConfig.elevenlabs?.stability !== undefined
				? String(voiceConfig.elevenlabs.stability)
				: "",
		);
		setElevenSimilarity(
			voiceConfig.elevenlabs?.similarityBoost !== undefined
				? String(voiceConfig.elevenlabs.similarityBoost)
				: "",
		);
		setElevenStyle(
			voiceConfig.elevenlabs?.style !== undefined
				? String(voiceConfig.elevenlabs.style)
				: "",
		);
		setElevenSpeed(
			voiceConfig.elevenlabs?.speed !== undefined
				? String(voiceConfig.elevenlabs.speed)
				: "",
		);
		setElevenOutputFormat(voiceConfig.elevenlabs?.outputFormat || "");
		setElevenOptimizeLatency(
			voiceConfig.elevenlabs?.optimizeStreamingLatency !== undefined
				? String(voiceConfig.elevenlabs.optimizeStreamingLatency)
				: "",
		);
		setElevenSpeakerBoost(voiceConfig.elevenlabs?.speakerBoost ?? null);
	}, [voiceConfig]);

	const handleSave = async () => {
		setSaving(true);
		const payload: Partial<VoiceConfig> = {
			provider: provider as VoiceConfig["provider"],
			defaultPolicy: defaultPolicy as VoiceConfig["defaultPolicy"],
			webSpeech: {
				voiceName: voiceName.trim() || undefined,
				lang: voiceLang.trim() || undefined,
				rate: toNumber(voiceRate),
				pitch: toNumber(voicePitch),
				volume: toNumber(voiceVolume),
			},
			elevenlabs: {
				voiceId: elevenVoiceId.trim() || undefined,
				modelId: elevenModelId.trim() || undefined,
				stability: toNumber(elevenStability),
				similarityBoost: toNumber(elevenSimilarity),
				style: toNumber(elevenStyle),
				speed: toNumber(elevenSpeed),
				outputFormat: elevenOutputFormat.trim() || undefined,
				optimizeStreamingLatency: toNumber(elevenOptimizeLatency),
				speakerBoost: elevenSpeakerBoost ?? undefined,
			},
		};
		const ok = await onSave(payload);
		setSaving(false);
		return ok;
	};

	return (
		<section className="panel-card animate-rise space-y-4 p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="text-lg font-semibold">Voice Provider</h3>
					<p className="text-xs text-slate-400">
						Configure the default TTS provider and voice settings for the gateway.
					</p>
				</div>
				<button className="button-primary" type="button" onClick={handleSave} disabled={saving}>
					{saving ? "Saving..." : "Save"}
				</button>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Provider</label>
					<select
						className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
						value={provider}
						onChange={(event) => setProvider(event.target.value)}
					>
						<option value="web_speech">Web Speech (Browser)</option>
						<option value="elevenlabs">ElevenLabs</option>
					</select>
				</div>
				<div className="space-y-2">
					<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Default Policy</label>
					<select
						className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
						value={defaultPolicy}
						onChange={(event) => setDefaultPolicy(event.target.value)}
					>
						<option value="off">Off</option>
						<option value="auto">Auto speak</option>
						<option value="manual">Manual only</option>
					</select>
				</div>
			</div>

			{provider === "web_speech" ? (
				<div className="space-y-3">
					<div className="text-xs uppercase tracking-[0.2em] text-slate-400">
						Web Speech Defaults
					</div>
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
				</div>
			) : (
				<div className="space-y-3">
					<div className="text-xs uppercase tracking-[0.2em] text-slate-400">
						{providerLabel} Defaults
					</div>
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
							placeholder="Output format (mp3_44100_128)"
							value={elevenOutputFormat}
							onChange={(event) => setElevenOutputFormat(event.target.value)}
						/>
						<input
							className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
							placeholder="Optimize latency (0-4)"
							value={elevenOptimizeLatency}
							onChange={(event) => setElevenOptimizeLatency(event.target.value)}
						/>
					</div>
					<label className="flex items-center gap-2 text-xs text-slate-300">
						<input
							type="checkbox"
							checked={elevenSpeakerBoost ?? false}
							onChange={(event) => setElevenSpeakerBoost(event.target.checked)}
						/>
						Use speaker boost
					</label>
				</div>
			)}

			<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
				Provider: <span className="font-semibold">{providerLabel}</span>
			</div>
		</section>
	);
};
