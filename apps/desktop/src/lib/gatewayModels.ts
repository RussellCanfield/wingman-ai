export type GatewaySettings = {
	url: string;
	uiUrl: string;
	token: string;
	password: string;
	agentId: string;
	sessionKey: string;
};

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type VoiceProvider = "web_speech" | "elevenlabs";
export type VoicePolicy = "off" | "manual" | "auto";

export type WebSpeechOptions = {
	voiceName?: string;
	lang?: string;
	rate?: number;
	pitch?: number;
	volume?: number;
};

export type ElevenLabsOptions = {
	voiceId?: string;
	modelId?: string;
	stability?: number;
	similarityBoost?: number;
	style?: number;
	speakerBoost?: boolean;
	speed?: number;
	outputFormat?: string;
	optimizeStreamingLatency?: number;
};

export type VoiceConfig = {
	provider: VoiceProvider;
	defaultPolicy?: VoicePolicy;
	webSpeech?: WebSpeechOptions;
	elevenlabs?: ElevenLabsOptions;
};

export type AgentVoiceConfig = {
	provider?: VoiceProvider;
	webSpeech?: WebSpeechOptions;
	elevenlabs?: ElevenLabsOptions;
};

export type ProviderStatus = {
	name: string;
	label: string;
	type: "api-key" | "oauth";
	envVars: string[];
	category?: "model" | "voice";
	source: "env" | "credentials" | "missing";
	envVar?: string;
	requiresAuth?: boolean;
};

export type ProviderStatusResponse = {
	providers: ProviderStatus[];
	credentialsPath?: string;
	updatedAt?: string;
};

export type GatewaySession = {
	id: string;
	name: string;
	agentId: string;
	createdAt: number;
	updatedAt?: number;
	messageCount?: number;
	lastMessagePreview?: string;
	workdir?: string | null;
};

export type ChatAttachment = {
	id: string;
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
};

export type AssistantTimelineTextBlock = {
	id: string;
	kind: "text";
	order: number;
	text: string;
};

export type AssistantTimelineToolBlock = {
	id: string;
	kind: "tool";
	order: number;
	toolEventId: string;
};

export type AssistantTimelineBlock =
	| AssistantTimelineTextBlock
	| AssistantTimelineToolBlock;

export type ContextWindowUsage = {
	inputTokens: number;
	estimatedInputTokens?: number;
	outputTokens: number;
	totalTokens: number;
	thresholdTokens?: number;
	percentOfThreshold?: number;
	summarized?: boolean;
	updatedAt: number;
};

export type ToolEvent = {
	id: string;
	name: string;
	node?: string;
	actor?: string;
	runId?: string;
	parentRunIds?: string[];
	delegatedByTaskId?: string;
	delegatedSubagentType?: string;
	status: "running" | "completed" | "error";
	args?: Record<string, any>;
	output?: any;
	error?: string;
	timestamp?: number;
	ui?: UiRenderSpec;
	uiOnly?: boolean;
	textFallback?: string;
	startedAt?: number;
	completedAt?: number;
	streamOrder?: number;
};

export type UiLayoutSpec = {
	type: "stack" | "row" | "grid";
	gap?: number;
	columns?: number;
	align?: "start" | "center" | "end" | "stretch";
};

export type UiComponentSpec = {
	component: string;
	props: Record<string, unknown>;
};

export type UiRenderSpec = {
	registry?: string;
	layout?: UiLayoutSpec;
	components: UiComponentSpec[];
};

export type ThinkingEvent = {
	id: string;
	node?: string;
	content: string;
	updatedAt: number;
};

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	attachments?: ChatAttachment[];
	toolEvents?: ToolEvent[];
	thinkingEvents?: ThinkingEvent[];
	inlineThinkBlocks?: string[];
	activityTimeline?: AssistantTimelineBlock[];
	uiBlocks?: Array<{
		id: string;
		spec: UiRenderSpec;
		uiOnly?: boolean;
		textFallback?: string;
	}>;
	uiTextFallback?: string;
	contextUsage?: ContextWindowUsage;
	createdAt: number;
};

export type SessionThread = {
	id: string;
	name: string;
	agentId: string;
	messages: ChatMessage[];
	createdAt: number;
	updatedAt?: number;
	messageCount?: number;
	lastMessagePreview?: string;
	messagesLoaded?: boolean;
	workdir?: string | null;
};

export type AgentSummary = {
	id: string;
	displayName: string;
	description?: string;
	tools: string[];
	model?: string;
	voice?: AgentVoiceConfig;
	promptTraining?: PromptTrainingConfig;
	promptRefinement?: PromptTrainingConfig;
	subAgents?: SubAgentPayload[];
};

export type PromptTrainingConfig = boolean | Record<string, unknown>;

export type SubAgentPayload = {
	id: string;
	displayName?: string;
	description: string;
	prompt: string;
	tools: string[];
	model?: string;
	promptTraining?: PromptTrainingConfig;
	promptRefinement?: PromptTrainingConfig;
};

export type AgentDetail = {
	id: string;
	displayName: string;
	description?: string;
	tools: string[];
	model?: string;
	prompt: string;
	voice?: AgentVoiceConfig;
	promptTraining?: PromptTrainingConfig;
	promptRefinement?: PromptTrainingConfig;
	subAgents?: SubAgentPayload[];
};

export type AgentsResponse = {
	agents: AgentSummary[];
	tools: string[];
	builtInTools?: string[];
};

export type GatewayConfig = {
	gatewayHost?: string;
	gatewayPort?: number;
	requireAuth?: boolean;
	defaultAgentId?: string;
	dynamicUiEnabled?: boolean;
};

export type GatewayHealth = {
	status?: string;
	stats?: {
		uptime?: number;
	};
};

export type GatewayStats = {
	nodes?: {
		totalNodes?: number;
	};
	groups?: {
		totalGroups?: number;
	};
};

export type GatewayNodeRecord = {
	clientId: string;
	name: string;
	enabled: boolean;
	connected: boolean;
	nodeIds: string[];
	capabilities?: string[];
	createdAt?: number;
	updatedAt?: number;
	lastSeenAt?: number;
};

export type GatewayNodesResponse = {
	nodes: GatewayNodeRecord[];
};

export type NodeInvokePayload = {
	tool: "system.notify" | "system.run";
	args?: Record<string, unknown>;
	timeoutMs?: number;
};

export type GatewayMessage = {
	type: string;
	id?: string;
	ok?: boolean;
	clientId?: string;
	nodeId?: string;
	targetNodeId?: string;
	payload?: unknown;
	client?: { instanceId: string; clientType: string; version?: string };
	auth?: { token?: string; password?: string };
	timestamp?: number;
};

export type AgentRequestPayload = {
	agentId?: string;
	content?: string;
	attachments?: ChatAttachment[];
	sessionKey?: string;
	queueIfBusy?: boolean;
	routing?: {
		channel: string;
		peer?: { kind: "channel" | "group" | "dm"; id: string };
	};
};

export type SmsPolicy = {
	target: string;
	paused: boolean;
	pausedUntil: number | null;
	stopEnabled: boolean;
	alertMode: "off" | "important-only" | "all";
	quietHours?: {
		enabled: boolean;
		startMinute: number;
		endMinute: number;
		timezone?: string;
	} | null;
	pauseExpiresInMs?: number | null;
};

export type SmsInboundRequest = {
	target: string;
	text: string;
	agentId?: string;
	accountId?: string;
	sessionKey?: string;
	threadId?: string;
	queueIfBusy?: boolean;
};

export type SmsCommandResolution = {
	kind: "command";
	handled: true;
	responseText: string;
	command: {
		name: "pause" | "resume" | "status" | "help" | "stop";
	};
	policy: SmsPolicy;
};

export type SmsStoppedResolution = {
	kind: "stopped";
	responseText: string;
	policy: SmsPolicy;
};

export type SmsAgentResolution = {
	kind: "agent";
	target: string;
	policy: SmsPolicy;
	request: AgentRequestPayload;
};

export type SmsInboundResolution =
	| SmsCommandResolution
	| SmsStoppedResolution
	| SmsAgentResolution;
