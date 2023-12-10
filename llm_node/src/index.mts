import promptSync from "prompt-sync";
import { fileURLToPath } from "url";
import path from "path";
import { LlamaModel, LlamaContext, LlamaChatSession } from "node-llama-cpp";

const prompt = promptSync({ sigint: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const model = new LlamaModel({
	modelPath: path.join(
		__dirname,
		"models",
		"deepseek-coder-1.3b-instruct.Q4_0.gguf"
	),
});
const context = new LlamaContext({ model });
const session = new LlamaChatSession({ context });

while (true) {
	const input = prompt({});

	console.log("Received: ", input);

	await session.prompt(input, {
		onToken(chunk: any) {
			process.stdout.write(context.decode(chunk));
		},
	});
}
