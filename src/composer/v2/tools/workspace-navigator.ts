import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type FileTarget, type UserIntent } from "../types/tools";
import { promises as fs } from 'fs';
import path from 'path';
import { PlanExecuteState } from "../types";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { ChatMessage } from "@langchain/core/messages";
import { getGitignorePatterns } from "../../../server/files/utils";
import { minimatch } from "minimatch";
import { FileMetadata } from "@shared/types/v2/Message";
import { formatMessages } from "../../utils";

interface DirectoryContent {
  type: 'file' | 'directory';
  name: string;
  path: string;
  depth: number;
}

export class WorkspaceNavigator {
  private INITIAL_SCAN_DEPTH = 10;

  constructor(
    private readonly rerankModel: BaseChatModel,
    private readonly workspace: string
  ) { }

  navigateWorkspace = async (
    state: PlanExecuteState
  ): Promise<Partial<PlanExecuteState>> => {
    const message = formatMessages(state.messages);

    let greeting = '';
    for await (const chunk of this.generateGreeting(message)) {
      greeting += chunk;
      await dispatchCustomEvent("composer-greeting", {
        greeting
      });
    }

    const intent = await this.analyzeRequest(message);

    let updatedState: Partial<PlanExecuteState> = {
      userIntent: intent
    };

    const question = intent.targets.find(t =>
      t.type === 'QUESTION'
    );

    if (!question && (!intent || !intent.targets.length)) {
      updatedState = {
        error: 'I am unable to find any files related to your request, please try again.'
      }
      await dispatchCustomEvent("composer-error", updatedState);
      return updatedState;
    }

    const files: FileMetadata[] = intent.targets.map(f => ({
      path: f.path!
    }));

    const questionMsg = question ? question.description : intent.task;

    return {
      userIntent: { ...intent },
      messages: [...state.messages, new ChatMessage(questionMsg, "assistant")],
      files,
      greeting
    };
  };

  private async *generateGreeting(question: string) {
    const stream = await this.rerankModel.stream(`You are a helpful AI coding assistant.
Acknowledge the user's request with a brief, natural greeting. Be friendly but professional.
Mention that you will create an implementation plan but do not generate one yet.
Do not detail what an implementation plan is.
Do not ask a question, make a statement.
Do not include phrases like "Sure," or "Here is".
Do not start with a greeting like "Hi" or "Hello" or "Thanks for your request" - just state you'll be helpful.
Ignore any existing assistant message about an Implementation Plan, this is from a previous interaction.
Focus on the latest message interaction.
  
Previous conversation and latest request:
${question}`);

    for await (const chunk of stream) {
      yield chunk.content.toString();
    }
  }

  private async analyzeRequest(question: string): Promise<UserIntent> {
    const MAX_ITEMS = 1500;
    const BATCH_SIZE = 1000;

    const createPrompt = (fileTargets: string, previousTargets: FileTarget[] = []) => `You are a senior software architect and technical lead.
The provided user request is related to writing software.
You will work autonomously when possible, without overburdening the user with questions.
Analyze this request and identify what files or folders need to be found or created.

Consider:
1. The type of component being discussed (controller, model, utility, etc.)
2. Common directory structures for this type of component
3. Related files that might need modification
4. If the request is unclear and you are not able to infer direction or intent, ask a clarifying question.
5. Start with the provided File Targets before generating new ones, if you feel like there is no match then generate one.
6. Focus on the core objective and what files appear to be the most relevant, be selective!

Question Guidelines:
1. Do not over burden the user, work with autonomy where possible.
2. In the response use type "QUESTION" and put the clarifying question in the description field.

Workspace path:
${this.workspace}

${previousTargets.length > 0 ? `Previous Targets:\n${JSON.stringify(previousTargets, null, 2)}\n\n` : ''}
File Targets:
${fileTargets}

------

Formatting guidelines:
1. JSON Structure:
    - Use double quotes for properties and strings
    - No trailing commas
    - Proper escaping of special characters
    - camelCase property names
    - Encode newlines as \n

Return a JSON object with the following properties:
{
    "task": "A markdown-formatted response that:
            1. Starts with '### Implementation Plan'
            2. Includes a brief overview of what needs to be done
            3. Lists the key changes in bullet points, bold each file name or directory referenced.
            4. Ends with '**Would you like me to proceed with these changes?**'",
    "targets": ["array of possible file targets"]
}

Schema for "targets" JSON property, where each target has:
- type: "CREATE" or "MODIFY" or "QUESTION"
- description: Specific description of what to look for
- path: Expected file path if known
- folderPath: Expected folder path if known

User request: ${question}`;

    // Get initial directory scan
    const allContents = await this.scanDirectory(this.workspace, this.INITIAL_SCAN_DEPTH);

    // Limit the results
    const limitedContents = allContents.slice(0, MAX_ITEMS);
    const batches: Array<typeof limitedContents> = [];

    // Split into batches
    for (let i = 0; i < limitedContents.length; i += BATCH_SIZE) {
      batches.push(limitedContents.slice(i, i + BATCH_SIZE));
    }

    let accumulatedTargets: FileTarget[] = [];
    let finalTask = '';

    for (const batch of batches) {
      const fileTargets = batch
        .map(c => `Name:${c.name}\nType:${c.type}\nPath:${c.path}`)
        .join('\n\n');

      const prompt = createPrompt(fileTargets, accumulatedTargets);
      const result = await this.rerankModel.invoke(prompt);
      const batchResult = JSON.parse(result.content.toString()) as UserIntent;

      accumulatedTargets = [
        ...accumulatedTargets,
        ...batchResult.targets.filter(newTarget =>
          !accumulatedTargets.some(existing =>
            existing.path === newTarget.path &&
            existing.type === newTarget.type
          )
        )
      ];

      finalTask = batchResult.task;
    }

    return {
      task: finalTask,
      targets: accumulatedTargets
    };
  }

  private async scanDirectory(dir: string, maxDepth: number): Promise<DirectoryContent[]> {
    const contents: DirectoryContent[] = [];
    const excludePatterns = await getGitignorePatterns(this.workspace);

    const systemDirs = [
      '.git',
      '.vscode',
      '.idea',
      'node_modules',
      'dist',
      'build'
    ];

    async function scan(currentPath: string, currentDepth: number) {
      if (currentDepth > maxDepth) return;

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dir, fullPath);

        if (systemDirs.includes(entry.name)) continue;

        // Check if path matches exclude patterns using minimatch
        if (excludePatterns) {
          const isExcluded = minimatch(relativePath, excludePatterns, {
            dot: true,
            matchBase: true
          });
          if (isExcluded) continue;
        }

        if (entry.isDirectory()) {
          contents.push({
            type: 'directory',
            name: entry.name,
            path: relativePath,
            depth: currentDepth
          });

          await scan(fullPath, currentDepth + 1);
        } else {
          contents.push({
            type: 'file',
            name: entry.name,
            path: relativePath,
            depth: currentDepth
          });
        }
      }
    }

    await scan(dir, 0);
    return contents;
  }
}