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
import { ProjectDetailsHandler } from "../../../server/project-details";

interface DirectoryContent {
  type: 'file' | 'directory';
  name: string;
  path: string;
  depth: number;
}

export class WorkspaceNavigator {
  private INITIAL_SCAN_DEPTH = 10;
  private buffer = '';

  private readonly DELIMITERS = {
    TARGETS_START: '===TARGETS_START===',
    TARGETS_END: '===TARGETS_END===',
    TARGET_START: '---TARGET---',
    TARGET_END: '---END_TARGET---',
    TASK_START: '===TASK_START===',
    TASK_END: '===TASK_END==='
  } as const;

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

    const projectDetailsHandler = new ProjectDetailsHandler(this.workspace);
    const projectDetails = await projectDetailsHandler.retrieveProjectDetails();
    const intent = await this.analyzeRequest(message, state.files, projectDetails?.description);

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
      greeting,
      projectDetails: projectDetails?.description
    };
  };

  private async *generateGreeting(question: string) {
    const stream = await this.rerankModel.stream(`You are a helpful AI coding assistant.
Your role is to provide a brief, natural acknowledgment of the user's coding request.
Keep the response under 20 words and focus on acknowledging their specific request type.
Mention you'll analyze their request but don't elaborate on next steps.

Previous conversation and latest request:
${question}`);

    for await (const chunk of stream) {
      yield chunk.content.toString();
    }
  }

  private createAnalyzePrompt(question: string, fileTargets: string, files?: FileMetadata[], projectDetails?: string,) {
    return `You are a senior software architect and technical lead.
The provided user request is related to writing software.
You will work autonomously when possible, without overburdening the user with questions.
Analyze this request and identify what files or folders need to be found or created.

Consider:
1. The type of component being discussed (controller, model, utility, etc.)
2. Common directory structures for this type of component
3. Related files that might need modification
4. Required dependencies or packages that need to be installed
5. If the request is unclear and you are not able to infer direction or intent, ask a clarifying question
6. Focus on the core objective and what files appear to be the most relevant, be selective!

Question Guidelines:
1. Work with autonomy where possible
2. Use type "QUESTION" for clarifying questions

Workspace path:
${this.workspace}

${projectDetails ? `Project details:\n${projectDetails}` : ''}

Recent files:
${files?.map(f => `Path: ${f.path}`).join('\n')}

Available files:
${fileTargets}

-----

Format guidelines:
- Type can either be MODIFY | CREATE

Output Format Example:
===TASK_START===
### Implementation Plan

[2-3 sentence overview]

Key Changes:
- [List specific files or components to modify always include the file name]
- [Include creation of new files if needed]

**Would you like me to proceed with these changes?**
===TASK_END===

===TARGETS_START===
---TARGET---
Type: MODIFY
Description: Update authentication logic
Path: /src/auth/service.ts
---END_TARGET---
---TARGET---
Type: CREATE
Description: Add new middleware
Path: /src/middleware/auth.ts
---END_TARGET---
===TARGETS_END===

------

User request: ${question}`;
  }

  private async parseStreamingResponse(chunk: string): Promise<Partial<UserIntent>> {
    this.buffer += chunk;
    const updates: Partial<UserIntent> = {};

    // Parse task section if complete
    if (this.buffer.includes(this.DELIMITERS.TASK_START) && this.buffer.includes(this.DELIMITERS.TASK_END)) {
      const taskContent = this.buffer.substring(
        this.buffer.indexOf(this.DELIMITERS.TASK_START) + this.DELIMITERS.TASK_START.length,
        this.buffer.indexOf(this.DELIMITERS.TASK_END)
      ).trim();

      if (taskContent) {
        updates.task = taskContent;
        // Remove processed task content
        this.buffer = this.buffer.substring(this.buffer.indexOf(this.DELIMITERS.TASK_END) + this.DELIMITERS.TASK_END.length);
      }
    }

    // Parse targets section if complete
    if (this.buffer.includes(this.DELIMITERS.TARGETS_START) && this.buffer.includes(this.DELIMITERS.TARGETS_END)) {
      const targetsContent = this.buffer.substring(
        this.buffer.indexOf(this.DELIMITERS.TARGETS_START) + this.DELIMITERS.TARGETS_START.length,
        this.buffer.indexOf(this.DELIMITERS.TARGETS_END)
      );

      const targets: FileTarget[] = targetsContent
        .split(this.DELIMITERS.TARGET_START)
        .filter(block => block.trim())
        .map(block => {
          const content = block.split(this.DELIMITERS.TARGET_END)[0].trim();
          const typeMatch = content.match(/Type: (.*?)(?:\n|$)/);
          const descMatch = content.match(/Description: (.*?)(?:\n|$)/);
          const pathMatch = content.match(/Path: (.*?)(?:\n|$)/);
          const folderMatch = content.match(/FolderPath: (.*?)(?:\n|$)/);

          return {
            type: typeMatch?.[1] as FileTarget['type'],
            description: descMatch?.[1] || '',
            path: pathMatch?.[1],
            folderPath: folderMatch?.[1]
          };
        })
        .filter(target => target.type && target.description);

      if (targets.length) {
        updates.targets = targets;
        // Remove processed targets content
        this.buffer = this.buffer.substring(this.buffer.indexOf(this.DELIMITERS.TARGETS_END) + this.DELIMITERS.TARGETS_END.length);
      }
    }

    return updates;
  }

  private async analyzeRequest(question: string, files?: FileMetadata[], projectDetails?: string): Promise<UserIntent> {

    const allContents = await this.scanDirectory(this.workspace, this.INITIAL_SCAN_DEPTH);

    const fileTargets = allContents
      .slice(0, 1200)
      .map(c => `Name: ${c.name}\nType: ${c.type}\nPath: ${c.path}`)
      .join('\n\n');

    const prompt = this.createAnalyzePrompt(question, fileTargets, files, projectDetails);

    let result: UserIntent = {
      task: '',
      targets: []
    };

    // Stream the response and parse incrementally
    for await (const chunk of await this.rerankModel.stream(prompt)) {
      const updates = await this.parseStreamingResponse(chunk.content.toString());

      if (updates.task) {
        result.task = updates.task;
      }

      if (updates.targets?.length) {
        result.targets = updates.targets;
      }

      // Emit progress events if needed
      await dispatchCustomEvent('composer-analyze-progress', {
        task: result.task,
        targets: result.targets
      });
    }

    if (!result.task || !result.targets.length) {
      result.task = '### Implementation Plan\nUnable to determine implementation plan from request.\n\n**Would you like to try again with more details?**';
      result.targets = [{
        type: 'QUESTION',
        description: 'Could you provide more details about what you\'d like to accomplish?'
      }];
    }

    return result;
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