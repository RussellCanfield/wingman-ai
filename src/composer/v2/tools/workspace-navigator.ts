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

    const messages = [...state.messages, new ChatMessage(intent.task, "assistant")];

    await dispatchCustomEvent("assistant-question", {
      messages
    });

    return {
      userIntent: { ...intent },
      messages,
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

    // Helper to safely extract and trim content
    const safeExtract = (content: string, pattern: string): string => {
      const match = content.match(new RegExp(`${pattern}\\s*:\\s*(.*?)(?:\n|$)`));
      return match?.[1]?.trim() ?? '';
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

          // Safely extract and normalize type
          const extractedType = safeExtract(content, 'Type').toUpperCase();
          const type = extractedType as "CREATE" | "MODIFY";

          if (!type || !["CREATE", "MODIFY"].includes(type)) {
            return null;
          }

          const description = safeExtract(content, 'Description');
          const rawPath = safeExtract(content, 'Path');

          if (!rawPath) return null;

          const normalizedWorkspace = path.normalize(this.workspace);
          const normalizedPath = path.normalize(rawPath);
          const absolutePath = path.isAbsolute(normalizedPath)
            ? normalizedPath
            : path.resolve(normalizedWorkspace, normalizedPath);

          const filePath = path
            .relative(normalizedWorkspace, absolutePath)
            .split(path.sep)
            .join('/');

          return {
            type,
            description,
            path: filePath,
          } satisfies FileTarget;
        })
        .filter(target => target !== null);

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

Note: When creating new files, do not specify directory creation. The system will automatically create necessary directories when creating files.

Project Creation Guidelines:
1. Framework-Specific Structures
    - Recognize common framework patterns (React, Vue, Angular, etc.)
    - Include all necessary configuration files
    - Set up proper folder structure based on best practices
    - Include required dependencies in package.json
    - Set up proper build configuration
    - Include necessary TypeScript configurations
    - Set up testing framework structure

2. Project Bootstrapping
    - Include all necessary root-level configuration files
    - Set up proper environment configuration
    - Include .gitignore and other VCS files
    - Set up proper README structure
    - Include license files if necessary
    - Set up proper documentation structure

3. Common Project Patterns
    React:
    - src/
      - components/
      - hooks/
      - context/
      - services/
      - utils/
      - types/
      - assets/
      - styles/
    - public/
    - tests/
    
    Node.js:
    - src/
      - controllers/
      - models/
      - routes/
      - middleware/
      - utils/
      - config/
    - tests/
    - docs/

4. Configuration Files Checklist
    React:
    - package.json
    - tsconfig.json (if TypeScript)
    - .eslintrc
    - .prettierrc
    - jest.config.js
    - vite.config.js/webpack.config.js
    - index.html
    
    Node.js:
    - package.json
    - tsconfig.json (if TypeScript)
    - .eslintrc
    - .prettierrc
    - jest.config.js
    - nodemon.json
    - .env.example

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

Project Analysis Guidelines:
1. Requirements Analysis
    - Break down high-level requirements into technical components
    - Identify core features vs nice-to-have features
    - Map dependencies between components
    - Consider scalability requirements
    - Analyze potential technical constraints

2. Architecture Planning
    - Determine appropriate design patterns
    - Plan component hierarchy and relationships
    - Identify shared services and utilities
    - Define data flow and state management
    - Plan error handling strategy
    - Consider performance bottlenecks
    - Design for extensibility

3. Implementation Strategy
    - Break down into logical implementation phases
    - Identify critical path components
    - Plan testing strategy and requirements
    - Consider deployment requirements
    - Define success criteria for each component
    - Plan for monitoring and logging
    - Consider maintenance requirements

4. Project Structure Planning
    - Define folder organization
    - Plan module boundaries
    - Identify shared types and interfaces
    - Plan configuration management
    - Consider build pipeline requirements
    - Define naming conventions
    - Plan documentation structure

5. Risk Assessment
    - Consider integration challenges
    - Assess third-party dependencies
    - Plan for potential bottlenecks
    - Consider security implications
    - Identify potential maintenance issues
    - Plan mitigation strategies

6. Framework-Specific Considerations
    - Identify framework-specific best practices
    - Include necessary framework configurations
    - Set up proper routing structure
    - Plan state management approach
    - Consider component composition
    - Plan data fetching strategy
    - Consider SSR/SSG requirements

7. Development Environment Setup
    - Define development tools requirements
    - Plan local development workflow
    - Set up debugging configurations
    - Define code quality tools
    - Plan hot reload strategy
    - Consider development vs production configs

8. Dependency Management
    - Identify core dependencies
    - Plan dependency version strategy
    - Consider peer dependencies
    - Plan package manager requirements
    - Consider monorepo structure if needed
    - Plan dependency update strategy

Remember: Focus on creating a complete, well-structured project plan that considers all aspects of development, maintenance, and scalability. The goal is to provide clear direction while maintaining flexibility for implementation details.

For new projects, the TARGETS response must include:
1. All necessary configuration files
2. Basic project structure directories
3. Essential framework files
4. Development environment setup files
5. Initial documentation files

Note - Skip directories, creating files will create directories.

------

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