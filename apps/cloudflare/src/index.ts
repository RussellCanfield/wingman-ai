import { getSandbox } from "@cloudflare/sandbox";
import { resolveSandboxName } from "./sandbox-name";

export { Sandbox } from "@cloudflare/sandbox";
export { resolveSandboxName } from "./sandbox-name";

type Env = {
	Sandbox: Parameters<typeof getSandbox>[0];
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const sandbox = getSandbox(env.Sandbox, resolveSandboxName(request));
		return sandbox.fetch(request);
	},
};
