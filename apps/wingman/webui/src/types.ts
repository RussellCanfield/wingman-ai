export type ControlUiAgent = {
	id: string;
	name?: string;
	default?: boolean;
};

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

export type PromptTrainingConfig = {
	enabled?: boolean;
	instructionsPath?: string;
};

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type AgentSubAgent = {
	id: string;
	displayName: string;
	description?: string;
	tools: string[];
	model?: string;
	reasoningEffort?: ReasoningEffort;
	prompt?: string;
	promptTraining?: PromptTrainingConfig | boolean;
	promptRefinement?: PromptTrainingConfig | boolean;
};

export type AgentSummary = {
	id: string;
	displayName: string;
	description?: string;
	tools: string[];
	model?: string;
	reasoningEffort?: ReasoningEffort;
	voice?: AgentVoiceConfig;
	promptTraining?: PromptTrainingConfig | boolean;
	promptRefinement?: PromptTrainingConfig | boolean;
	subAgents?: AgentSubAgent[];
};

export type AgentDetail = {
	id: string;
	displayName: string;
	description?: string;
	tools: string[];
	model?: string;
	reasoningEffort?: ReasoningEffort;
	voice?: AgentVoiceConfig;
	promptTraining?: PromptTrainingConfig | boolean;
	promptRefinement?: PromptTrainingConfig | boolean;
	subAgents?: AgentSubAgent[];
	prompt: string;
};

export type AgentsResponse = {
	agents: AgentSummary[];
	tools: string[];
	builtInTools?: string[];
};

export type ControlUiConfig = {
	gatewayHost: string;
	gatewayPort: number;
	requireAuth: boolean;
	defaultAgentId?: string;
	outputRoot?: string;
	dynamicUiEnabled?: boolean;
	voice?: VoiceConfig;
	agents: ControlUiAgent[];
};

export type GatewayMessage = {
	type: string;
	id?: string;
	ok?: boolean;
	payload?: any;
	client?: { instanceId: string; clientType: string; version?: string };
	auth?: { token?: string; password?: string };
	timestamp?: number;
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

export type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	attachments?: ChatAttachment[];
	toolEvents?: ToolEvent[];
	thinkingEvents?: ThinkingEvent[];
	uiBlocks?: UiBlock[];
	uiTextFallback?: string;
	createdAt: number;
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
	args?: Record<string, any>;
	status: "running" | "completed" | "error";
	output?: any;
	ui?: UiRenderSpec;
	uiOnly?: boolean;
	textFallback?: string;
	error?: string;
	timestamp?: number;
	startedAt?: number;
	completedAt?: number;
};

export type UiBlock = {
	id: string;
	spec: UiRenderSpec;
	uiOnly?: boolean;
	textFallback?: string;
};

export type UiRenderSpec = {
	registry?: string;
	layout?: UiLayoutSpec;
	components: UiComponentSpec[];
};

export type UiComponentSpec = {
	component: string;
	props: Record<string, unknown>;
};

export type UiLayoutSpec = {
	type: "stack" | "row" | "grid";
	gap?: number;
	columns?: number;
	align?: "start" | "center" | "end" | "stretch";
};

export type ThinkingEvent = {
	id: string;
	node?: string;
	content: string;
	updatedAt: number;
};

export type Thread = {
	id: string;
	name: string;
	agentId: string;
	messages: ChatMessage[];
	toolEvents?: ToolEvent[];
	thinkingEvents?: ThinkingEvent[];
	createdAt: number;
	updatedAt?: number;
	messageCount?: number;
	lastMessagePreview?: string;
	messagesLoaded?: boolean;
	workdir?: string | null;
};

export type Routine = {
	id: string;
	name: string;
	agentId: string;
	cron: string;
	prompt: string;
	sessionId?: string;
	createdAt: number;
	lastRunAt?: number;
	enabled: boolean;
};

export type Webhook = {
	id: string;
	name: string;
	agentId: string;
	secret: string;
	enabled: boolean;
	eventLabel?: string;
	preset?: string;
	sessionId?: string;
	createdAt: number;
	lastTriggeredAt?: number;
};

export type GatewayHealth = {
	status?: string;
	stats?: { uptime?: number };
};

export type GatewayStats = {
	nodes?: { totalNodes?: number };
	groups?: { totalGroups?: number };
};

export type FsRootResponse = {
	roots: string[];
};

export type FsEntry = {
	name: string;
	path: string;
};

export type FsListResponse = {
	path: string;
	parent?: string | null;
	entries: FsEntry[];
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
