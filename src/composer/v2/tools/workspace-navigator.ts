import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type FileTarget, type UserIntent } from "../types/tools";
import { PlanExecuteState } from "../types";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { ChatMessage, HumanMessage, MessageContentImageUrl, MessageContentText, SystemMessage } from "@langchain/core/messages";
import { FileMetadata } from "@shared/types/v2/Message";
import { DirectoryContent, formatMessages, scanDirectory } from "../../utils";
import { ProjectDetailsHandler } from "../../../server/project-details";
import path from "path";
import { ComposerImage } from "@shared/types/v2/Composer";
import { VectorQuery } from "../../../server/query";
import { CodeGraph } from "../../../server/files/graph";
import { Store } from "../../../store/vector";

interface GreetingResult {
  content: string;
  stopped: boolean;
}

export class WorkspaceNavigator {
  private INITIAL_SCAN_DEPTH = 10;
  private buffer = '';
  private vectorQuery = new VectorQuery();

  private readonly DELIMITERS = {
    TARGETS_START: '===TARGETS_START===',
    TARGETS_END: '===TARGETS_END===',
    TARGET_START: '---TARGET---',
    TARGET_END: '---END_TARGET---',
    TASK_START: '===TASK_START===',
    TASK_END: '===TASK_END==='
  } as const;

  constructor(
    private readonly chatModel: BaseChatModel,
    private readonly workspace: string,
    private readonly codeGraph: CodeGraph,
    private readonly vectorStore: Store
  ) { }

  navigateWorkspace = async (
    state: PlanExecuteState
  ) => {
    const message = formatMessages(state.messages);
    const projectDetailsHandler = new ProjectDetailsHandler(this.workspace);
    const projectDetails = await projectDetailsHandler.retrieveProjectDetails();

    const [intent, scannedFiles] = await this.analyzeRequest(message, state.files?.filter(f => f.path !== undefined), state.image, projectDetails?.description);

    if (!intent.targets?.length) {
      return {
        messages: [...state.messages, new ChatMessage(intent.task, "assistant")],
      }
    }

    const files: FileMetadata[] = intent.targets.map(f => ({
      path: f.path!
    }));

    return {
      userIntent: { ...intent },
      messages: [...state.messages, new ChatMessage(intent.task, "assistant")],
      files,
      greeting: "",
      projectDetails: projectDetails?.description,
      scannedFiles
    };
  };

  private async parseStreamingResponse(chunk: string): Promise<Partial<UserIntent>> {
    this.buffer += chunk;
    const updates: Partial<UserIntent> = {};

    // Parse task section if we have a start delimiter
    if (this.buffer.includes(this.DELIMITERS.TASK_START)) {
      const taskStartIndex = this.buffer.indexOf(this.DELIMITERS.TASK_START) + this.DELIMITERS.TASK_START.length;
      let taskContent: string;

      // Check if we've hit the targets section or task end
      if (this.buffer.includes(this.DELIMITERS.TARGETS_START)) {
        // Extract everything between task start and targets start
        taskContent = this.buffer.substring(
          taskStartIndex,
          this.buffer.indexOf(this.DELIMITERS.TARGETS_START)
        ).trim();
      } else if (this.buffer.includes(this.DELIMITERS.TASK_END)) {
        // Extract everything between task start and task end
        taskContent = this.buffer.substring(
          taskStartIndex,
          this.buffer.indexOf(this.DELIMITERS.TASK_END)
        ).trim();
      } else {
        // Still receiving task content
        taskContent = this.buffer.substring(taskStartIndex).trim();
      }

      if (taskContent) {
        // Remove any trailing delimiters and rejection template
        taskContent = taskContent
          .replace(this.DELIMITERS.TASK_END, '')
          .replace(/\[If user responds with rejection\][\s\S]*$/, '') // Remove rejection template
          .trim();

        updates.task = taskContent;
        // Only dispatch if we have actual content
        if (taskContent.length > 0) {
          await dispatchCustomEvent("composer-greeting", { greeting: taskContent });
        }
      }

      // Clean up buffer after processing
      if (this.buffer.includes(this.DELIMITERS.TARGETS_START)) {
        this.buffer = this.buffer.substring(this.buffer.indexOf(this.DELIMITERS.TARGETS_START));
      } else if (this.buffer.includes(this.DELIMITERS.TASK_END)) {
        this.buffer = this.buffer.substring(this.buffer.indexOf(this.DELIMITERS.TASK_END) + this.DELIMITERS.TASK_END.length);
      }
    }

    // Rest of the targets parsing logic remains the same
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

          let filePath: string | undefined;
          if (pathMatch?.[1]) {
            const rawPath = pathMatch[1].trim();

            // First normalize the paths to handle any platform-specific separators
            const normalizedWorkspace = path.normalize(this.workspace);
            const normalizedPath = path.normalize(rawPath);

            // If the path is already relative, resolve it against workspace
            const absolutePath = path.isAbsolute(normalizedPath)
              ? normalizedPath
              : path.resolve(normalizedWorkspace, normalizedPath);

            // Get the relative path from workspace to the target file
            filePath = path
              .relative(normalizedWorkspace, absolutePath)
              // Normalize to forward slashes for consistency
              .split(path.sep)
              .join('/');
          }

          const type = typeMatch?.[1] as "CREATE" | "MODIFY" | "QUESTION";
          if (!type || !["CREATE", "MODIFY", "QUESTION"].includes(type)) {
            return null;
          }

          return {
            type,
            description: descMatch?.[1] || "",
            path: filePath,
            folderPath: folderMatch?.[1]
          } satisfies FileTarget;
        })
        .filter(target => target !== null);

      if (targets.length) {
        updates.targets = targets;
      }

      // Remove processed targets content
      this.buffer = this.buffer.substring(this.buffer.indexOf(this.DELIMITERS.TARGETS_END) + this.DELIMITERS.TARGETS_END.length);
    }

    return updates;
  }

  private async analyzeRequest(question: string, files?: FileMetadata[], image?: ComposerImage, projectDetails?: string): Promise<[UserIntent, DirectoryContent[]]> {
    const allContents = await scanDirectory(this.workspace, this.INITIAL_SCAN_DEPTH);
    const contextFiles = await this.vectorQuery.retrieveDocumentsWithRelatedCodeFiles(question, this.codeGraph, this.vectorStore, this.workspace, 10);

    const fileTargets = allContents
      .slice(0, 1200)
      .map(c => `Name: ${c.name}\nType: ${c.type}\nPath: ${c.path}`)
      .join('\n\n');

    const prompt = `You are a senior full-stack software architect and technical lead.
  The provided user request is related to writing software.
  Your role is to analyze requests and provide clear, actionable responses.
  
  Response Guidelines:
  1. Start with a brief, natural acknowledgment (under 20 words)
  2. If the user expressed rejection/dissatisfaction:
      - Acknowledge the rejection
      - Ask what specific aspects they'd like to change
      - Do not include an implementation plan
  3. For non-rejection scenarios:
      - Provide a clear implementation plan
      - Work autonomously when possible
      - Include specific file paths and changes
  4. Ask clarifying questions only when absolutely necessary
  
  Technical Analysis Considerations:
  1. Component type (controller, model, utility, etc.)
  2. Common directory structures
  3. Related files needing modification
  4. Required dependencies
  5. Core objectives and most relevant files
  6. Dependency management files if needed
  
  Workspace path:
  ${this.workspace}
  
  ${projectDetails ? `Project details:\n${projectDetails}` : ''}
  
  Available workspace files and directories:
  ${fileTargets}
  
  -----
  
  Treat the following files with higher priority:
  ${[...Array.from(contextFiles.keys()), ...files ?? []].map(file => {
      const f = typeof file === 'object' && file !== null && 'path' in file ?
        path.relative(this.workspace, (file as FileMetadata).path) : path.relative(this.workspace, file);

      return `Path: ${path.relative(this.workspace, f)}`
    }).join('\n') ?? "None provided."}
  
  -----
  
  STRICT OUTPUT FORMAT:
  ===TASK_START===
  [Brief acknowledgment of request]
  
  [For rejection scenarios only - ask how you should proceed]
  
  [For non-rejection scenarios only]
  ### Implementation Plan
  
  [2-3 sentences describing approach]
  
  Key Changes:
  - [Bullet points listing specific files/components]
  - [Include file names and paths]
  
  **Would you like me to proceed with these changes?**
  ===TASK_END===
  
  ===TARGETS_START===
  [Internal targets list - not shown to user]
  ---TARGET---
  Type: [MODIFY or CREATE only]
  Description: [One line description]
  Path: [Workspace relative file path]
  ---END_TARGET---
  ===TARGETS_END===
    
  Previous conversation and latest message:
  ${question}`;

    let result: UserIntent = {
      task: '',
      targets: []
    };

    await this.streamResponse(prompt, result, image).catch(async error => {
      if (error instanceof Error && error.message.includes('does not support image input')) {
        await this.streamResponse(prompt, result);
      } else {
        throw error;
      }
    });

    // if (!result.task || !result.targets.length) {
    //   result.task = '### Implementation Plan\nI need more details about what you\'d like to accomplish. Could you elaborate?\n\n**How would you like to proceed?**';
    //   result.targets = [{
    //     type: 'QUESTION',
    //     description: 'Could you provide more specific details about your request?'
    //   }];
    // }

    return [result, allContents];
  }

  private async streamResponse(prompt: string, result: UserIntent, image?: ComposerImage) {
    const msgs: Array<MessageContentText | MessageContentImageUrl> = [
      {
        type: "text",
        text: prompt
      }
    ];

    if (image) {
      msgs.push({
        type: "image_url",
        image_url: {
          url: image.data,
        },
      });
    }

    for await (const chunk of await this.chatModel.stream([
      new HumanMessage({
        content: msgs,
      }),
    ])) {
      const updates = await this.parseStreamingResponse(chunk.content.toString());

      if (updates.task) {
        result.task = updates.task;
      }

      if (updates.targets?.length) {
        result.targets = updates.targets;
      }
    }
  }
}