import type {
	TerminalBenchAdapter,
	TerminalBenchAdapterConfig,
} from "../types.js";
import { CommandAdapter } from "./commandAdapter.js";
import { WingmanCliAdapter } from "./wingmanCliAdapter.js";

export function createAdapter(
	config: TerminalBenchAdapterConfig,
): TerminalBenchAdapter {
	if (config.type === "command") {
		return new CommandAdapter(config);
	}
	return new WingmanCliAdapter(config);
}
