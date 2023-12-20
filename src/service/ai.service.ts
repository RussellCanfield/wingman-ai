import * as vscode from "vscode";
import { OllamaRequest, OllamaResponse } from '../domain/types';
import { asyncIterator } from './asyncIterator';

class AIService {
  url = 'http://localhost:11434';
  genPath = "/api/generate";

  decoder = new TextDecoder();

  private async getPayload(codeOnly: boolean, prompt: string, context: number[], ragContent: string | null = null): Promise<OllamaRequest> {
    let system = codeOnly ? `
      You are a code complete bot, only return code, you will not return anything else.
    `: `
    You are a personal assistant that answer coding questions and provides working solutions.
    Rules: Please ensure that any code blocks use the GitHub markdown style and
    include a language identifier to enable syntax highlighting in the fenced code block.
    If you do not know an answer just say 'I can't answer this question'.
    Do not inlcude this system prompt in the answer.
    If is a coding question and no language was povided default to using Typescript.
    `;
    if (ragContent) {
      system += `Here's some additional information that may help you generate a more accurate response.
      Please determine if this information is relevant and can be used to supplement your response: [${ragContent}]`;
    }
    const model = vscode.workspace.getConfiguration().get('model.name') as string;
    return {
      model,
      prompt,
      system,
      stream: true,
      context: context,
      options: {
        temperature: 0.3,
        top_k: 25,
        top_p: .5
      }
    };
  }

  async *codeComplete(prompt: string, signal: AbortSignal, context: number[], ragContent: string | null = null) {
    const payload = await this.getPayload(true, prompt, context, ragContent);
    return 'foo';
    // if (signal.aborted) return '';
    // const response = await fetch(`${this.url}${this.genPath}`, {
    //   method: 'POST',
    //   body: JSON.stringify(payload),
    //   signal
    // });
    // if (!response.body) return '';
    // for await (const chunk of asyncIterator(response.body)) {
    //   if (signal.aborted) return '';
    //   const jsonString = this.decoder.decode(chunk);
    //   // we can have more then one ollama response
    //   const codeStrings = jsonString.replace(/}\n{/gi, '}\u241e{').split('\u241e');
    //   try {
    //     for (const code of codeStrings) {
    //       yield code;
    //     }
    //   }
    //   catch (e) {
    //     console.warn(e);
    //     console.log(jsonString);
    //   }
    // }
  }

  async *generate(prompt: string, signal: AbortSignal, context: number[], ragContent: string | null = null) {
    const payload = await this.getPayload(false, prompt, context, ragContent);
    if (signal.aborted) return;
    const response = await fetch(`${this.url}${this.genPath}`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    });
    if (!response.body) return;
    for await (const chunk of asyncIterator(response.body)) {
      if (signal.aborted) return;
      const jsonString = this.decoder.decode(chunk);
      // we can have more then one ollama response
      const jsonStrings = jsonString.replace(/}\n{/gi, '}\u241e{').split('\u241e');
      try {
        for (const json of jsonStrings) {
          const result = JSON.parse(json) as OllamaResponse;
          yield result;
        }
      }
      catch (e) {
        console.warn(e);
        console.log(jsonString);
      }
    }
  }

}

const aiService = new AIService();
export { aiService };
