import type { GatewayHttpContext } from "./types.js";
import {
	deleteProviderCredentials,
	getCredentialsPath,
	readCredentialsFile,
	resolveProviderToken,
	saveProviderToken,
} from "@/providers/credentials.js";
import { getProviderSpec, listProviderSpecs } from "@/providers/registry.js";

export const handleProvidersApi = async (
	_ctx: GatewayHttpContext,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/providers") {
		if (req.method === "GET") {
			const credentials = readCredentialsFile();
			const providers = listProviderSpecs().map((provider) => {
				const resolved = resolveProviderToken(provider.name);
				return {
					name: provider.name,
					label: provider.label,
					type: provider.type,
					envVars: provider.envVars,
					category: provider.category,
					source: resolved.source,
					envVar: resolved.envVar,
					requiresAuth: provider.requiresAuth,
				};
			});

			return new Response(
				JSON.stringify(
					{
						providers,
						credentialsPath: getCredentialsPath(),
						updatedAt: credentials?.updatedAt,
					},
					null,
					2,
				),
				{ headers: { "Content-Type": "application/json" } },
			);
		}

		return new Response("Method Not Allowed", { status: 405 });
	}

	const providerMatch = url.pathname.match(/^\/api\/providers\/([^/]+)$/);
	if (!providerMatch) {
		return null;
	}

	const providerName = decodeURIComponent(providerMatch[1]);
	const provider = getProviderSpec(providerName);
	if (!provider) {
		return new Response("Unknown provider", { status: 404 });
	}

	if (req.method === "POST") {
		const body = (await req.json()) as { token?: string; apiKey?: string };
		const token = (body?.token || body?.apiKey || "").trim();
		if (!token) {
			return new Response("Token required", { status: 400 });
		}
		saveProviderToken(provider.name, token);
		const resolved = resolveProviderToken(provider.name);
		return new Response(
			JSON.stringify(
				{
					name: provider.name,
					label: provider.label,
					type: provider.type,
					envVars: provider.envVars,
					category: provider.category,
					source: resolved.source,
					envVar: resolved.envVar,
					requiresAuth: provider.requiresAuth,
				},
				null,
				2,
			),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	if (req.method === "DELETE") {
		deleteProviderCredentials(provider.name);
		const resolved = resolveProviderToken(provider.name);
		return new Response(
			JSON.stringify(
				{
					name: provider.name,
					label: provider.label,
					type: provider.type,
					envVars: provider.envVars,
					category: provider.category,
					source: resolved.source,
					envVar: resolved.envVar,
					requiresAuth: provider.requiresAuth,
				},
				null,
				2,
			),
			{ headers: { "Content-Type": "application/json" } },
		);
	}

	return new Response("Method Not Allowed", { status: 405 });
};
