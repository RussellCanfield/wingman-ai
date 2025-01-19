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
    private readonly chatModel: BaseChatModel,
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
    const [intent, scannedFiles] = await this.analyzeRequest(message, state.files, state.image, projectDetails?.description);

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
      projectDetails: projectDetails?.description,
      scannedFiles
    };
  };

  private async *generateGreeting(question: string) {
    const stream = await this.chatModel.stream(`You are a helpful AI coding assistant.
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
7. Include any files that manage dependencies, if new dependencies are included.
8. Directories are for determining file paths, you will not be creating or modifying directories - so do not include them in your output.

Question Guidelines:
1. Work with autonomy where possible
2. Use type "QUESTION" for clarifying questions

Workspace path:
${this.workspace}

${projectDetails ? `Project details:\n${projectDetails}` : ''}

Available workspace files and directories:
${fileTargets}

User provided/recently used files - consider these higher priority:
${files?.map(f => `Path: ${f.path}`).join('\n')}

-----

STRICT OUTPUT FORMAT REQUIREMENTS:

1. Your response MUST contain exactly two sections:
    - Implementation Plan (wrapped in ===TASK_START=== and ===TASK_END===)
    - Targets List (wrapped in ===TARGETS_START=== and ===TARGETS_END===)

2. Implementation Plan section MUST follow this exact structure for initial requests:
    ===TASK_START===
    ### Implementation Plan
    
    [Exactly 2-3 sentences describing the approach]
    
    Key Changes:
    - [Bullet points listing specific files/components]
    - [Include file names and paths]
    
    **Would you like me to proceed with these changes?**
    ===TASK_END===

    For follow-up requests, use this structure:
    ===TASK_START===
    ### Updated Plan
    
    [One sentence describing what changed from previous plan]
    
    Modified Changes:
    - [Only list changes that differ from previous plan]
    
    **Would you like me to proceed with these changes?**
    ===TASK_END===

3. Targets List section MUST follow this exact structure:
    ===TARGETS_START===
    ---TARGET---
    Type: [MODIFY or CREATE only]
    Description: [One line description]
    Path: [Workspace relative file path]
    ---END_TARGET---
    [Repeat for each target]
    ===TARGETS_END===

VALIDATION RULES:
- Each target MUST have exactly 3 fields: Type, Description, and Path
- Type MUST be either MODIFY or CREATE
- Paths MUST be full file paths
- Description MUST be one line only
- No extra sections or formatting allowed
- No explanatory text outside the defined sections
- Implementation Plan must be concise and actionable

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

          return {
            type: typeMatch?.[1] as FileTarget['type'],
            description: descMatch?.[1] || '',
            path: filePath,
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

  private async analyzeRequest(question: string, files?: FileMetadata[], image?: ComposerImage, projectDetails?: string): Promise<[UserIntent, DirectoryContent[]]> {
    const allContents = await scanDirectory(this.workspace, this.INITIAL_SCAN_DEPTH);

    const fileTargets = allContents
      .slice(0, 1200)
      .map(c => `Name: ${c.name}\nType: ${c.type}\nPath: ${c.path}`)
      .join('\n\n');

    const prompt = this.createAnalyzePrompt(question, fileTargets, files, projectDetails);

    let result: UserIntent = {
      task: '',
      targets: []
    };

    // Try with image first if provided, then fallback to text-only
    await this.streamResponse(prompt, result, image).catch(async error => {
      if (error instanceof Error && error.message.includes('does not support image input')) {
        // Retry without image
        await this.streamResponse(prompt, result);
      } else {
        throw error; // Re-throw non-image related errors
      }
    });

    if (!result.task || !result.targets.length) {
      result.task = '### Implementation Plan\nUnable to determine implementation plan from request.\n\n**Would you like to try again with more details?**';
      result.targets = [{
        type: 'QUESTION',
        description: 'Could you provide more details about what you\'d like to accomplish?'
      }];
    }

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