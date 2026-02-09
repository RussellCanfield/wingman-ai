import { z } from "zod";
import type {
	GatewayMessage,
	RegisterPayload,
	JoinGroupPayload,
	BroadcastPayload,
	DirectPayload,
} from "./types.js";

/**
 * Message type enum for validation
 */
export const MessageTypeSchema = z.enum([
	"connect",
	"res",
	"req:agent",
	"req:agent:cancel",
	"event:agent",
	"session_subscribe",
	"session_unsubscribe",
	"register",
	"registered",
	"unregister",
	"join_group",
	"leave_group",
	"broadcast",
	"direct",
	"ping",
	"pong",
	"error",
	"ack",
]);

/**
 * Base gateway message schema
 */
export const GatewayMessageSchema = z.object({
	type: MessageTypeSchema,
	id: z.string().optional(),
	client: z
		.object({
			instanceId: z.string().min(1),
			clientType: z.string().min(1),
			version: z.string().optional(),
		})
		.optional(),
	auth: z
		.object({
			token: z.string().optional(),
			password: z.string().optional(),
			deviceId: z.string().optional(),
		})
		.optional(),
	ok: z.boolean().optional(),
	clientId: z.string().optional(),
	nodeId: z.string().optional(),
	groupId: z.string().optional(),
	roomId: z.string().optional(),
	targetNodeId: z.string().optional(),
	payload: z.unknown().optional(),
	timestamp: z.number(),
	messageId: z.string().optional(),
});

/**
 * Registration payload schema
 */
export const RegisterPayloadSchema = z.object({
	name: z.string().min(1).max(100),
	capabilities: z.array(z.string()).optional(),
	token: z.string().optional(),
});

/**
 * Join group payload schema
 */
export const JoinGroupPayloadSchema = z.object({
	groupId: z.string().optional(),
	groupName: z.string().min(1).max(100).optional(),
	createIfNotExists: z.boolean().optional(),
	description: z.string().max(500).optional(),
});

/**
 * Broadcast payload schema
 */
export const BroadcastPayloadSchema = z.object({
	groupId: z.string().min(1),
	message: z.unknown(),
});

/**
 * Direct message payload schema
 */
export const DirectPayloadSchema = z.object({
	targetNodeId: z.string().min(1),
	message: z.unknown(),
});

/**
 * Error payload schema
 */
export const ErrorPayloadSchema = z.object({
	code: z.string().min(1),
	message: z.string().min(1),
	details: z.unknown().optional(),
});

/**
 * Validate a gateway message
 */
export function validateGatewayMessage(
	data: unknown,
): { success: true; data: GatewayMessage } | { success: false; error: string } {
	try {
		const result = GatewayMessageSchema.safeParse(data);
		if (!result.success) {
			return {
				success: false,
				error: `Invalid message format: ${result.error.message}`,
			};
		}
		return { success: true, data: result.data as GatewayMessage };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown validation error",
		};
	}
}

/**
 * Validate registration payload
 */
export function validateRegisterPayload(
	data: unknown,
):
	| { success: true; data: RegisterPayload }
	| { success: false; error: string } {
	try {
		const result = RegisterPayloadSchema.safeParse(data);
		if (!result.success) {
			return {
				success: false,
				error: `Invalid register payload: ${result.error.message}`,
			};
		}
		return { success: true, data: result.data };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown validation error",
		};
	}
}

/**
 * Validate join group payload
 */
export function validateJoinGroupPayload(
	data: unknown,
):
	| { success: true; data: JoinGroupPayload }
	| { success: false; error: string } {
	try {
		const result = JoinGroupPayloadSchema.safeParse(data);
		if (!result.success) {
			return {
				success: false,
				error: `Invalid join group payload: ${result.error.message}`,
			};
		}
		return { success: true, data: result.data };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown validation error",
		};
	}
}

/**
 * Validate broadcast payload
 */
export function validateBroadcastPayload(
	data: unknown,
):
	| { success: true; data: BroadcastPayload }
	| { success: false; error: string } {
	try {
		const result = BroadcastPayloadSchema.safeParse(data);
		if (!result.success) {
			return {
				success: false,
				error: `Invalid broadcast payload: ${result.error.message}`,
			};
		}
		return { success: true, data: result.data };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown validation error",
		};
	}
}

/**
 * Validate direct message payload
 */
export function validateDirectPayload(
	data: unknown,
): { success: true; data: DirectPayload } | { success: false; error: string } {
	try {
		const result = DirectPayloadSchema.safeParse(data);
		if (!result.success) {
			return {
				success: false,
				error: `Invalid direct payload: ${result.error.message}`,
			};
		}
		return { success: true, data: result.data };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown validation error",
		};
	}
}
