import type { GatewayHttpContext } from "./types.js";
import { AgentLoader } from "@/agent/config/agentLoader.js";
import { resolveProviderToken } from "@/providers/credentials.js";
import { resolveVoiceConfig } from "@/voice/config.js";
import {
	VoiceConfigUpdateSchema,
	type AgentVoiceConfig,
	type ElevenLabsOptions,
} from "@/types/voice.js";
import { WingmanConfigSchema } from "@/cli/config/schema.js";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

const buildElevenLabsPayload = (
	text: string,
	options: ElevenLabsOptions,
): Record<string, unknown> => {
	const payload: Record<string, unknown> = { text };
	if (options.modelId) {
		payload.model_id = options.modelId;
	}
	const voiceSettings: Record<string, unknown> = {};
	if (typeof options.stability === "number") {
		voiceSettings.stability = options.stability;
	}
	if (typeof options.similarityBoost === "number") {
		voiceSettings.similarity_boost = options.similarityBoost;
	}
	if (typeof options.style === "number") {
		voiceSettings.style = options.style;
	}
	if (typeof options.speakerBoost === "boolean") {
		voiceSettings.use_speaker_boost = options.speakerBoost;
	}
	if (typeof options.speed === "number") {
		voiceSettings.speed = options.speed;
	}
	if (Object.keys(voiceSettings).length > 0) {
		payload.voice_settings = voiceSettings;
	}
	return payload;
};

const resolveAgentVoiceConfig = (
	ctx: GatewayHttpContext,
	agentId?: string,
): AgentVoiceConfig | undefined => {
	if (!agentId) return undefined;
	const loader = new AgentLoader(ctx.configDir, ctx.workspace, ctx.getWingmanConfig());
	const configs = loader.loadAllAgentConfigs();
	const match = configs.find((agent) => agent.name === agentId);
	return match?.voice;
};

export const handleVoiceApi = async (
	ctx: GatewayHttpContext,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/voice") {
		if (req.method === "GET") {
			const config = ctx.getWingmanConfig();
			return new Response(
				JSON.stringify({ voice: config.voice }, null, 2),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		if (req.method === "PUT") {
			const payload = (await req.json()) as Record<string, unknown>;
			const updateResult = VoiceConfigUpdateSchema.safeParse(payload);
			if (!updateResult.success) {
				return new Response("Invalid voice configuration", { status: 400 });
			}
			const update = updateResult.data;
			const current = ctx.getWingmanConfig();
			const nextVoice = {
				...(current.voice || {}),
				...update,
				webSpeech: {
					...(current.voice?.webSpeech || {}),
					...(update.webSpeech || {}),
				},
				elevenlabs: {
					...(current.voice?.elevenlabs || {}),
					...(update.elevenlabs || {}),
				},
			};
			const nextConfig = WingmanConfigSchema.parse({
				...current,
				voice: nextVoice,
			});
			ctx.setWingmanConfig(nextConfig);
			ctx.persistWingmanConfig();
			return new Response(
				JSON.stringify({ voice: nextConfig.voice }, null, 2),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response("Method Not Allowed", { status: 405 });
	}

	if (url.pathname === "/api/voice/speak") {
		if (req.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}
		const body = (await req.json()) as {
			text?: string;
			agentId?: string;
		};
		const text = String(body?.text ?? "").trim();
		if (!text) {
			return new Response("Text is required", { status: 400 });
		}
		const agentId =
			typeof body?.agentId === "string" && body.agentId.trim()
				? body.agentId.trim()
				: undefined;

		const config = ctx.getWingmanConfig();
		const agentVoice = resolveAgentVoiceConfig(ctx, agentId);
		const resolved = resolveVoiceConfig(config.voice, agentVoice);

		if (resolved.provider !== "elevenlabs") {
			return new Response("Voice provider is not supported by the gateway", {
				status: 400,
			});
		}

		const token = resolveProviderToken("elevenlabs").token;
		if (!token) {
			return new Response("ElevenLabs API key is not configured", {
				status: 400,
			});
		}

		const voiceId = resolved.elevenlabs.voiceId;
		if (!voiceId) {
			return new Response("ElevenLabs voiceId is required", {
				status: 400,
			});
		}

		const query = new URLSearchParams();
		if (resolved.elevenlabs.outputFormat) {
			query.set("output_format", resolved.elevenlabs.outputFormat);
		}
		if (typeof resolved.elevenlabs.optimizeStreamingLatency === "number") {
			query.set(
				"optimize_streaming_latency",
				String(resolved.elevenlabs.optimizeStreamingLatency),
			);
		}

		const endpoint = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}${query.toString() ? `?${query.toString()}` : ""}`;
		const elevenPayload = buildElevenLabsPayload(text, resolved.elevenlabs);

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"xi-api-key": token,
				Accept: "audio/mpeg",
			},
			body: JSON.stringify(elevenPayload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			return new Response(errorText || "ElevenLabs request failed", {
				status: response.status,
			});
		}

		const audioBuffer = await response.arrayBuffer();
		const contentType = response.headers.get("content-type") || "audio/mpeg";
		return new Response(audioBuffer, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "no-store",
			},
		});
	}

	return null;
};
