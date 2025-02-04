import { Command, END, interrupt, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver, StateGraphArgs } from "@langchain/langgraph";
import { ChatMessage } from "@langchain/core/messages";
import { CodeGraph } from "../../server/files/graph";
import { RunnableConfig } from "@langchain/core/runnables";
import { Store } from "../../store/vector.js";
import { PlanExecuteState } from "./types/index";
import { NoFilesChangedError, NoFilesFoundError } from "../errors";
import { ComposerRequest } from "@shared/types/v2/Composer";
import { FileMetadata } from "@shared/types/v2/Message";
import { CodeWriter } from "./agents/code-writer";
import path, { join } from "node:path";
import { getTextDocumentFromPath } from "../../server/files/utils";
import { DirectoryContent } from "../utils";
import { DependencyManager } from "./agents/dependency-manager";
import { promises } from "node:fs";
import { FeatureParser } from "./agents/feature-parser";
import { AIProvider } from "../../service/base";
import { createPlannerAgent } from "./agents/find";

export interface Thread {
    configurable: {
        thread_id: string;
    };
}

let controller = new AbortController();

export function cancelComposer() {
    controller.abort();
}

export class ComposerGraph {
    private workflow: StateGraph<PlanExecuteState>;

    constructor(private readonly workspace: string,
        private readonly aiProvider: AIProvider,
        private readonly codeGraph: CodeGraph,
        private readonly store: Store,
        private readonly config?: RunnableConfig,
        private readonly checkpointer?: BaseCheckpointSaver) {

        const plannerAgent = createPlannerAgent(this.aiProvider, this.codeGraph, this.store, this.workspace);
        const codeWriter = new CodeWriter(this.aiProvider, this.workspace);
        const dependencyManager = new DependencyManager(this.aiProvider.getLightweightModel(), this.workspace);
        const featureParser = new FeatureParser(this.aiProvider.getReasoningModel(), this.workspace);

        const planExecuteState: StateGraphArgs<PlanExecuteState>["channels"] = {
            messages: {
                value: (x: ChatMessage[], y: ChatMessage[]) => y ?? x,
                default: undefined
            },
            implementationPlan: {
                value: (x?: string, y?: string) => y ?? x,
                default: () => undefined,
            },
            files: {
                value: (x?: FileMetadata[], y?: FileMetadata[]) => y ?? x,
                default: () => undefined,
            },
            scannedFiles: {
                value: (x?: DirectoryContent[], y?: DirectoryContent[]) => y ?? x,
                default: () => undefined,
            },
            error: {
                value: (x?: string, y?: string) => y ?? x,
                default: () => undefined,
            },
            projectDetails: {
                value: (x?: string, y?: string) => y ?? x,
                default: () => undefined,
            },
            image: {
                value: (
                    x?: ComposerRequest["image"],
                    y?: ComposerRequest["image"]
                ) => y ?? x,
            },
            feature: {
                value: (x?: string, y?: string) => y ?? x,
                default: () => undefined,
            },
            dependencies: {
                value: (x?: string[], y?: string[]) => y ?? x,
                default: () => undefined,
            },
        };

        //@ts-expect-error
        this.workflow = new StateGraph({
            channels: planExecuteState,
        })
            .addNode("find", plannerAgent.invoke, {
                ends: ["intent-review"]
            })
            .addNode("intent-review", this.intentReviewFeedback, {
                ends: ["find", "dependency-manager", "code-writer"],
            })
            .addNode("dependency-manager", dependencyManager.addDependencies, {
                ends: ["code-writer"]
            })
            .addNode("code-writer", codeWriter.codeWriterStep, {
                ends: [END]
            })
            // .addNode("file-review", this.fileReview, {
            //     ends: ["find", "feature-parser"]
            // })
            // .addNode("feature-parser", featureParser.parseFeature, {
            //     ends: ["accept-feature-plan"]
            // })
            // .addNode("accept-feature-plan", this.acceptFeaturePlan, {
            //     ends: ["find", END]
            // })
            .addEdge(START, "find")
            .addEdge("find", "intent-review")
            // .addEdge("intent-review", "dependency-manager")
            // .addEdge("intent-review", "code-writer")
            // .addEdge("intent-review", "find")
            .addEdge("dependency-manager", "code-writer")
        // .addEdge("code-writer", "file-review")
        // .addEdge("file-review", "feature-parser")
        // .addEdge("feature-parser", "accept-feature-plan")
        // .addEdge("accept-feature-plan", END)
    }

    resetGraphState = async () => {
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        await graph.updateState({ ...this.config }, {
            messages: []
        } satisfies Partial<PlanExecuteState>);
    }

    undoFile = async (file: FileMetadata) => {
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        const state = await graph.getState({ ...this.config });

        const relativePath = path.relative(this.workspace, file.path);

        const graphFiles = (state.values as PlanExecuteState).files;
        const matchedFile = graphFiles?.find(f => f.path === relativePath);

        if (!matchedFile) return;

        matchedFile.rejected = false;
        matchedFile.accepted = false;
        matchedFile.code = matchedFile.original;

        await graph.updateState({ ...this.config }, {
            files: graphFiles
        })

        return {
            ...state.values,
            files: graphFiles
        }
    }

    rejectFile = async (file: FileMetadata): Promise<PlanExecuteState | undefined> => {
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        const state = await graph.getState({ ...this.config });

        const relativePath = path.relative(this.workspace, file.path);

        const graphFiles = (state.values as PlanExecuteState).files;
        const matchedFile = graphFiles?.find(f => f.path === relativePath);

        if (!matchedFile) return;

        const txtDoc = await getTextDocumentFromPath(join(this.workspace, matchedFile.path));
        matchedFile.code = txtDoc?.getText();

        matchedFile.rejected = true;
        matchedFile.accepted = false;
        matchedFile.lastModified = Date.now();

        await graph.updateState({ ...this.config }, {
            files: graphFiles
        })

        return {
            ...state.values,
            files: graphFiles
        }
    }

    acceptFile = async (file: FileMetadata): Promise<PlanExecuteState | undefined> => {
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        const state = await graph.getState({ ...this.config });

        const relativePath = path.relative(this.workspace, file.path);

        const graphFiles = (state.values as PlanExecuteState).files;
        const matchedFile = graphFiles?.find(f => f.path === relativePath);

        if (!matchedFile) return;

        matchedFile.accepted = true;
        matchedFile.rejected = false;

        await graph.updateState({ ...this.config }, {
            files: graphFiles
        });

        return {
            ...state.values,
            files: graphFiles
        };
    }

    removeFile = async (file: FileMetadata) => {
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        const state = await graph.getState({ ...this.config });

        const relativePath = path.relative(this.workspace, file.path);

        const graphFiles = (state.values as PlanExecuteState).files;
        const matchedFile = graphFiles?.find(f => f.path === relativePath);

        if (!matchedFile) return;

        await graph.updateState({ ...this.config }, {
            files: graphFiles?.filter(f => f.path !== relativePath)
        });

        return {
            ...state.values,
            files: graphFiles
        };
    }

    updateFile = async (file: FileMetadata) => {
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        const state = await graph.getState({ ...this.config });

        const relativePath = path.relative(this.workspace, file.path);

        const graphFiles = (state.values as PlanExecuteState).files;
        const matchedFile = graphFiles?.find(f => f.path === relativePath);

        if (!matchedFile) return;

        matchedFile.code = (await promises.readFile(path.join(this.workspace, file.path))).toString()
        matchedFile.lastModified = file.lastModified;

        await graph.updateState({ ...this.config }, {
            files: graphFiles
        });

        return {
            ...state.values,
            files: graphFiles
        };
    }

    determinePositiveAnswer = async (userMessage: string) => {
        const result = await this.aiProvider.getLightweightModel().invoke(
            `Analyze this response and determine if it's a positive confirmation or providing confirmation.

Rules:
- Respond with 'yes' ONLY for clear positive confirmations like:
    - "yes", "sure", "okay", "proceed"
    - "looks good", "that's correct"
    - "go ahead", "sounds good"
- Respond with 'no' for:
    - Any instructions or requests
    - Questions or queries
    - Greetings (like "hi", "hello")
    - Ambiguous or unclear responses
    - General comments or statements
    - Any specific directions or modifications
    - Partial agreements with conditions
- You must only respond with 'yes' or 'no', do not add any additional text

Examples:
- "Yes, go ahead" -> "yes"
- "Looks good" -> "yes"
- "That works perfectly" -> "yes"
- "Hi" -> "no"
- "Hello there" -> "no"
- "Can you change X" -> "no"
- "Instead, do this" -> "no"
- "Maybe" -> "no"
- "Yes, but can you..." -> "no"
- "That's interesting" -> "no"

Note: Examples above are not exhaustive, use your best judgement!

Response: ${userMessage}

Answer (yes/no):`
        );

        return result.content.toString().toLowerCase().includes('yes');
    }

    // fileReview = async (state: PlanExecuteState) => {
    //     const lastMessage = state.messages[state.messages.length - 1];
    //     interrupt(lastMessage);

    //     if (state.files?.every(f => f.accepted || f.rejected)) {
    //         return new Command({
    //             goto: "feature-parser",
    //         });
    //     }

    //     console.log("All files not finalized, restarting flow");

    //     return new Command({
    //         goto: "find",
    //         update: {
    //             messages: state.messages
    //         } satisfies Partial<PlanExecuteState>
    //     });
    // };

    acceptFeaturePlan = async (state: PlanExecuteState) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const interruptState = interrupt(lastMessage) as Partial<PlanExecuteState>;
        const userMessage = interruptState.messages![0].content.toString();
        const messages = [...state.messages, new ChatMessage(userMessage, "user")];

        const result = await this.determinePositiveAnswer(userMessage);

        if (result) {
            return new Command({
                goto: "find",
                update: {
                    messages
                } satisfies Partial<PlanExecuteState>
            });
        }

        return new Command({
            goto: END
        });
    }


    intentReviewFeedback = async (state: PlanExecuteState) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const interruptState = interrupt(lastMessage) as Partial<PlanExecuteState>;
        const userMessage = interruptState.messages![0].content.toString();
        const messages = [...state.messages, new ChatMessage(userMessage, "user")];

        const result = await this.determinePositiveAnswer(userMessage);

        if (result) {
            if (state.dependencies && state.dependencies?.length > 0) {
                return new Command({
                    goto: "dependency-manager",
                    update: {
                        messages
                    } satisfies Partial<PlanExecuteState>
                })
            }

            return new Command({
                goto: "code-writer",
                update: {
                    messages
                } satisfies Partial<PlanExecuteState>,
            });
        }

        console.log("Did not detect a positive sentiment response to prompted feedback.");

        return new Command({
            goto: "find",
            update: {
                messages
            } satisfies Partial<PlanExecuteState>
        });
    };

    async *execute(
        request: ComposerRequest,
    ) {
        controller = new AbortController();
        const graph = this.workflow.compile({ checkpointer: this.checkpointer });
        const state = await graph.getState({ ...this.config });

        let inputs: Partial<PlanExecuteState> = {};

        if (request.input) {
            inputs.messages = [new ChatMessage(request.input, "user")];
        }

        inputs.files = [...(state.values as PlanExecuteState)?.files ?? []];

        if (request.contextFiles) {
            const codeFiles: FileMetadata[] = [];
            // Use existing files from both inputs and current state
            const existingPaths = new Set(inputs.files.map(f => f.path));

            for (const file of request.contextFiles) {
                try {
                    const relativePath = path.relative(this.workspace, file);

                    if (existingPaths.has(relativePath)) {
                        continue;
                    }

                    const txtDoc = await getTextDocumentFromPath(path.join(this.workspace, relativePath));
                    codeFiles.push({
                        path: relativePath,
                        code: txtDoc?.getText(),
                        lastModified: Date.now()
                    });
                    existingPaths.add(relativePath); // Track newly added paths
                } catch { }
            }

            // Merge new files with existing ones
            inputs.files = [...inputs.files, ...codeFiles];
        }

        if (request.image) {
            inputs.image = request.image;
        }

        try {
            const graphInput = state?.tasks.length > 0 ? new Command({
                resume: {
                    messages: inputs.messages
                }
            }) : inputs;

            const streamingGraph = await graph.streamEvents(graphInput, {
                streamMode: ["custom"],
                signal: controller.signal,
                version: "v2",
                ...this.config
            });

            for await (const chunk of streamingGraph) {
                if (!chunk) continue;

                const { event, name, data } = chunk;
                if (event === "on_custom_event") {
                    yield { node: name, values: data };
                }
            }

            const latestState = await graph.getState({ ...this.config });

            if (latestState.tasks?.length === 0) {
                yield {
                    node: "composer-done",
                    values: latestState.values
                }
            }
        } catch (e) {
            console.error('Composer error: ', e);
            if (e instanceof DOMException && e.name === "AbortError") {
                yield {
                    node: "composer-error",
                    values: {
                        error: "Operation was cancelled",
                    },
                };
                return;
            } else if (e instanceof NoFilesChangedError) {
                yield {
                    node: "composer-error",
                    values: {
                        error:
                            "I was not able to generate any changes. Please try again with a different question or try explicitly referencing files.",
                    },
                };
                return;
            } else if (e instanceof NoFilesFoundError) {
                yield {
                    node: "composer-error",
                    values: {
                        error:
                            "I was unable to find any indexed code files. Please reference files directly using '@filename', build the full index or make sure embeddings are enabled in settings.",
                    },
                };
                return;
            }
            yield {
                node: "composer-error",
                values: {
                    error:
                        "An error occurred, please try again. If this continues use the clear chat button to start over.",
                },
            };
        }
    }
}
