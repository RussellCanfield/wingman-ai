export type ControlUiAgent = {
    id: string;
    name?: string;
    default?: boolean;
};
export type AgentSummary = {
    id: string;
    displayName: string;
    description?: string;
    tools: string[];
    model?: string;
    subAgents?: Array<{
        id: string;
        displayName: string;
        description?: string;
        tools: string[];
        model?: string;
    }>;
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
    agents: ControlUiAgent[];
};
export type GatewayMessage = {
    type: string;
    id?: string;
    ok?: boolean;
    payload?: any;
    client?: {
        instanceId: string;
        clientType: string;
        version?: string;
    };
    auth?: {
        token?: string;
        password?: string;
    };
    timestamp?: number;
};
export type ChatAttachment = {
    id: string;
    kind: "image";
    dataUrl: string;
    name?: string;
    mimeType?: string;
    size?: number;
};
export type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    attachments?: ChatAttachment[];
    createdAt: number;
};
export type ToolEvent = {
    id: string;
    name: string;
    args?: Record<string, any>;
    status: "running" | "completed" | "error";
    output?: any;
    error?: string;
    startedAt?: number;
    completedAt?: number;
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
    createdAt: number;
    lastRunAt?: number;
    enabled: boolean;
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
    source: "env" | "credentials" | "missing";
    envVar?: string;
};
export type ProviderStatusResponse = {
    providers: ProviderStatus[];
    credentialsPath?: string;
    updatedAt?: string;
};
