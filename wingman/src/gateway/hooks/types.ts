import { z } from "zod";
import type { RoutingInfo } from "../types.js";

export const HookDeliverSchema = z.object({
	agentId: z.string().min(1),
	sessionKey: z.string().optional(),
	message: z.string().optional(),
});

export const HookEntrySchema = z.object({
	enabled: z.boolean().default(true),
	deliver: HookDeliverSchema.optional(),
});

export const InternalHooksConfigSchema = z.object({
	enabled: z.boolean().default(false),
	entries: z.record(z.string(), HookEntrySchema).optional(),
	load: z
		.object({
			extraDirs: z.array(z.string()).optional(),
		})
		.optional(),
});

export type InternalHooksConfig = z.infer<typeof InternalHooksConfigSchema>;
export type HookEntryConfig = z.infer<typeof HookEntrySchema>;
export type HookDeliverConfig = z.infer<typeof HookDeliverSchema>;

export type HookEvent = {
	type: "gateway" | "session" | "message" | "command";
	action: string;
	timestamp: Date;
	agentId?: string;
	sessionKey?: string;
	routing?: RoutingInfo;
	payload?: Record<string, any>;
	messages: string[];
};

export type HookHandler = (event: HookEvent) => Promise<void> | void;

export type HookDefinition = {
	name: string;
	description?: string;
	events: string[];
	handler: HookHandler;
	entry?: HookEntryConfig;
};
