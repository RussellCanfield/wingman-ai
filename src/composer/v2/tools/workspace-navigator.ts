import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type FileTarget, type UserIntent } from "../types/tools";
import { PlanExecuteState } from "../types";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { ChatMessage, HumanMessage, MessageContentImageUrl, MessageContentText, SystemMessage } from "@langchain/core/messages";
import { FileMetadata } from "@shared/types/v2/Message";
import { DirectoryContent, formatMessages, scanDirectory } from "../../utils";
import { ProjectDetailsHandler } from "../../../server/project-details";
import path from "path";
import fs, { promises } from "fs";
import { ComposerImage } from "@shared/types/v2/Composer";
import { VectorQuery } from "../../../server/query";
import { CodeGraph } from "../../../server/files/graph";
import { Store } from "../../../store/vector";

export class WorkspaceNavigator {
  private INITIAL_SCAN_DEPTH = 10;
  private buffer = '';
  private vectorQuery = new VectorQuery();

  private readonly DELIMITERS = {
    TARGETS_START: '===TARGETS_START===',
    TARGETS_END: '===TARGETS_END===',
    TARGET_START: '---TARGET---',
    TARGET_END: '---END_TARGET---',
    ACKNOWLEDGEMENT_START: '===ACKNOWLEDGEMENT_START===',
    ACKNOWLEDGEMENT_END: '===ACKNOWLEDGEMENT_END==='
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
    const projectDetailsHandler = new ProjectDetailsHandler(this.workspace);
    const projectDetails = await projectDetailsHandler.retrieveProjectDetails();

    const generateIntent = async () => {
      const message = formatMessages(state.messages);

      const [intent, scannedFiles] = await this.analyzeRequest(message, state.files?.filter(f => f.path !== undefined), state.image, projectDetails?.description);

      const files: FileMetadata[] = intent.targets.map(f => ({
        path: f.path!
      }));

      return { intent, files, scannedFiles };
    }

    let { intent, files, scannedFiles } = await generateIntent();

    // Workaround - Retry once if no task is found
    if (!intent?.task) {
      ({ intent, files, scannedFiles } = await generateIntent());

      // If still no task after retry, return empty state
      if (!intent?.task) {
        return {
          messages: state.messages
        } satisfies Partial<PlanExecuteState>;
      }
    }

    return {
      userIntent: { ...intent },
      messages: [...state.messages, new ChatMessage(intent.task, "assistant")],
      files,
      greeting: "",
      projectDetails: projectDetails?.description,
      scannedFiles
    };
  };

  private async analyzeTargetFiles(question: string, targets: UserIntent["targets"]): Promise<UserIntent["targets"]> {
    if (!targets.length) {
      return [];
    }

    const filteredFiles = targets.filter(f => path.extname(f.path!)?.length > 0 && f.type !== "CREATE");
    const analyzedTargets: UserIntent["targets"] = [];
    let buffer = '';

    for (const target of filteredFiles) {
      const filePath = String(path.isAbsolute(target.path!) ? target.path : path.join(this.workspace, target.path!));

      if (!fs.existsSync(filePath)) {
        continue;
      }

      const fileContents = await promises.readFile(filePath, 'utf-8');
      let currentAnalysis = '';

      const prompt = `Analyze this file in relation to the user's request:
  ${question}
  
  File path: ${target.path}
  File contents:
  ${fileContents}
  
  Provide your analysis as a streaming response in this format:
  
  ===ANALYSIS_START===
  [Stream your analysis token by token, describing file relevance and any needed modifications]
  ===ANALYSIS_END===`;

      for await (const chunk of await this.chatModel.stream([
        new SystemMessage({
          content: "You are a code analysis expert. Analyze files and determine their relevance to user requests."
        }),
        new HumanMessage({
          content: prompt
        })
      ])) {
        const content = chunk.content.toString();
        buffer += content;

        // Check for analysis section markers
        if (buffer.includes('===ANALYSIS_START===')) {
          const startIndex = buffer.indexOf('===ANALYSIS_START===') + '===ANALYSIS_START==='.length;

          // If we have an end marker, extract the complete section
          if (buffer.includes('===ANALYSIS_END===')) {
            const endIndex = buffer.indexOf('===ANALYSIS_END===');
            currentAnalysis = buffer.substring(startIndex, endIndex).trim();

            // Update target with complete analysis
            analyzedTargets.push({
              ...target,
              description: currentAnalysis
            });

            // Dispatch complete analysis
            await dispatchCustomEvent("file-analysis", {
              path: target.path,
              analysis: currentAnalysis,
              status: 'complete'
            });

            // Reset buffer
            buffer = buffer.substring(endIndex + '===ANALYSIS_END==='.length);
            currentAnalysis = '';
          } else {
            // Stream partial analysis
            const partialAnalysis = buffer.substring(startIndex).trim();

            if (partialAnalysis !== currentAnalysis) {
              currentAnalysis = partialAnalysis;

              // Dispatch streaming update
              await dispatchCustomEvent("file-analysis", {
                path: target.path,
                analysis: currentAnalysis,
                status: 'streaming'
              });
            }
          }
        }
      }

      // Clean up any remaining buffer content
      if (buffer.includes('===ANALYSIS_START===') && !buffer.includes('===ANALYSIS_END===')) {
        const startIndex = buffer.indexOf('===ANALYSIS_START===') + '===ANALYSIS_START==='.length;
        const finalAnalysis = buffer.substring(startIndex).trim();

        if (finalAnalysis) {
          analyzedTargets.push({
            ...target,
            description: finalAnalysis
          });

          await dispatchCustomEvent("file-analysis", {
            path: target.path,
            analysis: finalAnalysis,
            status: 'complete'
          });
        }
      }

      // Reset buffer for next file
      buffer = '';
    }

    return analyzedTargets;
  }

  private async parseStreamingResponse(chunk: string): Promise<Partial<UserIntent>> {
    this.buffer += chunk;
    const updates: Partial<UserIntent> = {};

    // Helper to clean the buffer after processing a section
    const cleanBuffer = (endDelimiter: string) => {
      const endIndex = this.buffer.indexOf(endDelimiter) + endDelimiter.length;
      this.buffer = this.buffer.substring(endIndex);
    };

    // Process sections in order of expected appearance
    const processAcknowledgement = () => {
      if (!this.buffer.includes(this.DELIMITERS.ACKNOWLEDGEMENT_START)) {
        return;
      }

      const startIndex = this.buffer.indexOf(this.DELIMITERS.ACKNOWLEDGEMENT_START)
        + this.DELIMITERS.ACKNOWLEDGEMENT_START.length;
      let endIndex = this.buffer.indexOf(this.DELIMITERS.ACKNOWLEDGEMENT_END);

      // If we don't have an end delimiter yet, take everything after start
      if (endIndex === -1) {
        const taskContent = this.buffer.substring(startIndex).trim();
        if (taskContent) {
          updates.task = taskContent;
        }
        return;
      }

      // Extract complete acknowledgement section
      const taskContent = this.buffer
        .substring(startIndex, endIndex)
        .trim();

      if (taskContent) {
        updates.task = taskContent;
        cleanBuffer(this.DELIMITERS.ACKNOWLEDGEMENT_END);
      }
    };

    const processTargets = () => {
      if (!this.buffer.includes(this.DELIMITERS.TARGETS_START)
        || !this.buffer.includes(this.DELIMITERS.TARGETS_END)) {
        return;
      }

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

          if (!pathMatch?.[1]) return null;

          const rawPath = pathMatch[1].trim();
          const normalizedWorkspace = path.normalize(this.workspace);
          const normalizedPath = path.normalize(rawPath);
          const absolutePath = path.isAbsolute(normalizedPath)
            ? normalizedPath
            : path.resolve(normalizedWorkspace, normalizedPath);

          const filePath = path
            .relative(normalizedWorkspace, absolutePath)
            .split(path.sep)
            .join('/');

          const type = typeMatch?.[1] as "CREATE" | "MODIFY";
          if (!type || !["CREATE", "MODIFY"].includes(type)) {
            return null;
          }

          return {
            type,
            description: descMatch?.[1] || "",
            path: filePath,
          } satisfies FileTarget;
        })
        .filter((target) => target !== null);

      if (targets.length) {
        updates.targets = targets;
      }

      cleanBuffer(this.DELIMITERS.TARGETS_END);
    };

    // Process sections in order
    processAcknowledgement();
    processTargets();

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
Your role is to analyze requests and choose the absolute best files that match the user's request.
You must think through this step-by-step and consider the user's current implementation context.
Every response must include an acknowledgement and file targets. This is critical or the application crashes.

File Selection Priority:
1. Active Context (Highest Priority)
    - Recently modified files matching the request
    - User provided files from the conversation
    - Files mentioned in the current implementation plan
    - These files are most likely to be relevant as they represent active work
    - These may not always be the best match, look for conversational shifts

2. Semantic Context (Medium Priority)
    - Files with matching functionality or purpose
    - Shared dependencies with active files
    - Files in similar component categories
    - Only consider if active context files don't fully solve the request

3. Workspace Search (Lower Priority)
    - Only search here if no matches found above
    - Look for files matching the technical requirements
    - Consider common patterns and structures

Technical Analysis Steps:
1. Review the conversation history
    - Note any files already being modified
    - Understand the current implementation plan
    - Look for user preferences or patterns

2. Analyze file relevance
    - Match against active implementation
    - Check technical requirements
    - Consider component relationships

3. Score potential matches
    - Active implementation file: Highest
    - Recently modified related file: High
    - Contextually related file: Medium
    - Pattern/structure match: Low

Workspace path:
${this.workspace}

${projectDetails ? `Project details:\n${projectDetails}` : ''}

Active Implementation Files:
${files?.map(file => {
      if (typeof file === 'object' && file !== null && 'path' in file) {
        const relativePath = path.relative(this.workspace, (file as FileMetadata).path);
        const description = (file as FileMetadata).description || '';
        return description
          ? `Path: ${relativePath}\nContext: ${description}`
          : `Path: ${relativePath}`;
      }
      return `Path: ${path.relative(this.workspace, file)}`;
    }).join('\n') ?? "None provided."}

Related Context Files:
${Array.from(contextFiles.keys())?.map(file => {
      if (typeof file === 'object' && file !== null && 'path' in file) {
        const relativePath = path.relative(this.workspace, (file as FileMetadata).path);
        const description = (file as FileMetadata).description || '';
        return description
          ? `Path: ${relativePath}\nContext: ${description}`
          : `Path: ${relativePath}`;
      }
      return `Path: ${path.relative(this.workspace, file)}`;
    }).join('\n') ?? "None provided."}

Available workspace files:
${fileTargets}

-----

Implementation Context:
The following conversation shows the current implementation plan and file context.
Messages are sorted oldest to newest.
Pay special attention to files being modified and implementation decisions.

${question}

-----

Response Format:
===ACKNOWLEDGEMENT_START===
[Brief acknowledgment of request]

[For rejection scenarios only - ask how you should proceed]

[For non-rejection scenarios only]
### Implementation Plan

[2-3 sentences describing approach]

Key Changes:
- [Bullet points listing specific files/components]
- [Include file names and paths]

**Would you like me to proceed with these changes?**
===ACKNOWLEDGEMENT_END===

===TARGETS_START===
[Internal targets list - not shown to user]
---TARGET---
Type: [MODIFY or CREATE only]
Description: [One line description]
Path: [Workspace relative file path]
---END_TARGET---
===TARGETS_END===`;

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