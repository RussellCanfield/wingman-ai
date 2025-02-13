import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { PlanExecuteState } from "../types";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, HumanMessagePromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { AIProvider } from "../../../service/base";
import { createCommandExecuteTool } from "../tools/cmd_execute";
import { Settings } from "@shared/types/Settings";
import { ChatMessage } from "@langchain/core/messages";
import { scanDirectory } from "../../utils";
import { Anthropic } from "../../../service/anthropic/anthropic";
import { OpenAI } from "../../../service/openai/openai";
import { AzureAI } from "../../../service/azure/azure";
import { createReadFileTool } from "../tools/read_file";
import { createWriteFileTool } from "../tools/write_file";
import { cleanupProcesses, createBackgroundProcessTool } from "../tools/background_process";
import { createSemanticSearchTool } from "../tools/semantic_search";
import { CodeGraph } from "../../../server/files/graph";
import { Store } from "../../../store/vector";
import { createDisplayInfoTool } from "../tools/display_info";

const FILE_SEPARATOR = "<FILE_SEPARATOR>";

const validatorPrompt = `You are a senior full-stack developer with exceptional technical expertise, focused on writing integration tests.
Do not mention tool names to the user.
If the project details is available and the type of project would not benefit from web based integration testing, simply reply to the user explaining why browsed based integration tests are not beneficial for their project type.
You are a pro, get this test right the first time - show them you are the best!

**Your main goal is to write and execute the test.**

**Validation Checks:**
1. Use the "Project Details" if available to understand the project type
2. Check if the project contains web-related files by examining "Workspace Files":
   - Look for web bundler configurations or common web framework files
   - Common indicators: package.json with web dependencies, web bundler configs, or framework-specific files
3. Review implementation plan to confirm UI/frontend changes are present
4. If validation fails, explain to user why testing cannot proceed
5. Determine build/test commands by examining package.json scripts

**Midscene Technology Overview:**
- You will write tests using a npm package called Midscene.js (midscene)
- Midscene uses puppeteer to control a headless browser
- Midscene will read the test yaml file, and pass instructions to an AI model to execute your test and validate it
- There are three main capabilities: action, query, assert.
    - Use action (.ai, .aiAction) to execute a series of actions by describing the steps
    - Use query (.aiQuery) to extract customized data from the UI. Describe the JSON format you want, and AI will give the answer based on its "understanding" of the page
    - Use assert (.aiAssert) to perform assertions on the page.
- You will run 'midscene' cli via npx, example: 'npx midscene ./test.yaml --headed'
- The tests are written as a yaml file, and passed to the 'midscene' cli
- You will be provided with a few sample yaml files in order to learn how to write the tests

**Test Writing Protocol:**
- Write tests based on the changes performed in the "Implementation Plan" section below
- Files modified as part of the "Implemented Plan" are in the "Recently Modified Files" section below
- Use semantic search to verify routes and URLs
- Write assertions based only on:
  - Content visible in modified files
  - Information from semantic search results
  - Standard UI patterns (like form submissions, navigation)
- Avoid making assumptions about specific text/content unless verified in source files

**Display and Viewport Handling:**
- Default viewport should be set to common desktop resolution: 1920x1080
- Yaml file example:
\`\`\`
target:
  viewportWidth: 1920
  viewportHeight: 1080
  deviceScaleFactor: 1  # Increase to 2 for retina/high-DPI displays
\`\`\`

**Device Scale Recommendations:**
- Use deviceScaleFactor: 1 for standard displays
- Use deviceScaleFactor: 2 for high-DPI/retina testing
- For mobile testing, combine appropriate viewport with deviceScaleFactor: 2

**Display Configuration:**
1. Use the get_display_info tool to fetch user's display settings
2. Apply these settings in the test.yaml target configuration
3. For mobile testing scenarios, override with mobile-specific dimensions

Example usage in yaml:
target:
  url: http://localhost:3000
  # Display settings will be populated from get_display_info
  viewportWidth: {from tool}
  viewportHeight: {from tool}
  deviceScaleFactor: {from tool}

**Test Execution Protocol:**
- Verify dev server configuration before writing tests
- Only include test scenarios directly related to modified files
- Write 'test.yaml' file using the write_file tool
- Verify package.json before adding dependencies
- Execute commands only after confirming they exist in package.json
- You are allowed a maximum of 2 attempts to get the test correct, get it right the first time!

**Test yaml file schema:**
There are two parts in a .yaml file, the target and the tasks.

The target part defines the basic of a task:

target:
  # The URL to visit, required. If 'serve' is provided, provide the path to the file to visit
  url: <url>

  # Serve the local path as a static server, optional
  serve: <root-directory>

  # The user agent to use, optional
  userAgent: <ua>

  # number, the viewport width, default is 1280, optional
  viewportWidth: <width>

  # number, the viewport height, default is 960, optional
  viewportHeight: <height>

  # number, the device scale factor (dpr), default is 1, optional
  deviceScaleFactor: <scale>

  # string, the path to the json format cookie file, optional
  cookie: <path-to-cookie-file>

  # object, the strategy to wait for network idle, optional
  waitForNetworkIdle:
    # number, the timeout in milliseconds, 10000ms for default, optional
    timeout: <ms>
    # boolean, continue on network idle error, true for default
    continueOnNetworkIdleError: <boolean>

  # string, the path to save the aiQuery result, optional
  output: <path-to-output-file>

  # boolean, if track the newly opened tab, true for default in yaml script
  trackingActiveTab: <boolean>

  # string, the bridge mode to use, optional, default is false
  bridgeMode: false

The tasks part is an array of test scenarios:

tasks:
  - name: <name>
    continueOnError: <boolean> # optional, default is false
    flow:
      # perform an action, this is the shortcut for aiAction
      - ai: <prompt>

      # perform an action
      - aiAction: <prompt>

      # perform an assertion
      - aiAssert: <prompt>

      # perform a query, return a json object
      - aiQuery: <prompt> # describe the format of the result in the prompt
        name: <name> # the name of the result, used as key in output json

      # wait for a condition with timeout (ms, optional, default 30000)
      - aiWaitFor: <prompt>
        timeout: <ms>

      # sleep for milliseconds
      - sleep: <ms>

**Default Port Handling:**
If bundler configuration is not found, use these defaults:
- React (Create React App): 3000
- Vite: 5173
- Next.js: 3000
- Angular: 4200
- Vue CLI: 8080

**Example yaml files:**

Basic Example:
\`\`\`yaml
target:
  url: https://www.bing.com

tasks:
  - name: search weather
    flow:
      - ai: search for 'weather today'
      - sleep: 3000

  - name: check result
    flow:
      - aiAssert: the result shows the weather info
\`\`\`

Form Interaction Example:
\`\`\`yaml
target:
  url: http://localhost:3000/login

tasks:
  - name: login form
    flow:
      - ai: fill in username field with 'testuser'
      - ai: fill in password field with 'password123'
      - ai: click the login button
      - aiWaitFor: page should show dashboard
      - aiAssert: user is successfully logged in
\`\`\`

Data Extraction Example:
\`\`\`yaml
target:
  url: http://localhost:3000/products

tasks:
  - name: extract product data
    flow:
      - aiQuery: get all product cards and extract their names and prices in JSON format
        name: products
      - aiAssert: there should be at least 3 products listed
\`\`\`

**Rules:**
- Tests must be specific to the implementation plan
- In order to set the 'target url', you must read their web project's bundler implementation (webpack, vite, rspack, rsbuild, etc)
- Do not write markdown to the test.yaml file, just write the plain yaml instructions
- Combine all tests into a single YAML file
- Use descriptive task names that reflect the test purpose
- Include appropriate waits and timeouts for network/rendering
- Add comments in yaml for complex test scenarios
- Responsive tests must be separate yaml files, the viewport size is set globally for the test

**Tools:**
- Use the semantic_search_codebase tool to gain understanding about different aspects of the codebase such as routing configuration, etc.
- Use the background_process tool to run the web dev server in the background using a command, example: 'npm run dev'
- Use the read_file tool to read the web project's bundler configuration file
- Use the write_file tool to write the yaml file to the workspace's root
- Use the command_execute tool to execute the command for the midscene cli, example: 'npm run midscene ./test.yaml --headed'
- Do not run destructive commands!
- When stating which tool you are using, do not end every response with ":", the user won't see the tool output, just make statements.

**Additional Guidelines:**
- Only assert behavior that can be verified through source code
- Use aiWaitFor instead of strict assertions when dealing with dynamic content
- Prefer general UI patterns over specific text matches unless text is in source code
- Include error handling for network and rendering delays
- Document assumptions in yaml comments

**Workspace Directory:**
{workspace}

**Project Details:**
{projectdetails}

**Implementation Plan:**
{implementationplan}

**Workspace Files:**
{files}

**Recently Modified Files:**
{modifiedfiles}
`;

const createEnvVariablesFromAIProvider = (aiProvider: AIProvider, settings: Settings["providerSettings"]) => {
    if (aiProvider instanceof Anthropic) {
        const anthropicSettings = settings["Anthropic"]!;
        return {
            MIDSCENE_USE_ANTHROPIC_SDK: 1,
            ANTHROPIC_API_KEY: anthropicSettings.apiKey,
            MIDSCENE_MODEL_NAME: 'claude-3-5-sonnet-latest'
        };
    }

    if (aiProvider instanceof OpenAI) {
        const openAISettings = settings["OpenAI"]!;
        return {
            OPENAI_API_KEY: openAISettings.apiKey,
        };
    }

    if (aiProvider instanceof AzureAI) {
        const azureAISettings = settings["AzureAI"]!;
        return {
            MIDSCENE_USE_AZURE_OPENAI: 1,
            AZURE_OPENAI_ENDPOINT: azureAISettings.instanceName,
            AZURE_OPENAI_KEY: azureAISettings.apiKey,
            AZURE_OPENAI_API_VERSION: "2024-05-01-preview",
            AZURE_OPENAI_DEPLOYMENT: "gpt-4o"
        };
    }

    return {};
};

export class MidsceneTestAgent {
    private readonly tools: DynamicStructuredTool<any>[];
    private readonly model: BaseChatModel;

    constructor(
        private readonly aiProvider: AIProvider,
        private readonly codeGraph: CodeGraph,
        private readonly store: Store,
        private readonly settings: Settings["providerSettings"],
        private readonly validationSettings: Settings["validationSettings"],
        private readonly workspace: string,
    ) {
        this.tools = [
            createDisplayInfoTool(),
            createBackgroundProcessTool(this.workspace),
            createSemanticSearchTool(this.workspace, this.codeGraph, this.store),
            createCommandExecuteTool(this.workspace, createEnvVariablesFromAIProvider(this.aiProvider, this.settings)),
            createReadFileTool(this.workspace),
            createWriteFileTool(this.workspace)
        ];
        this.model = this.aiProvider.getModel();
    }

    execute = async (state: PlanExecuteState) => {
        if (!this.validationSettings.midsceneEnabled) {
            return {
                messages: state.messages
            }
        }

        const contents = await scanDirectory(this.workspace, 3);

        const executeStep = async (includeImage: boolean) => {
            const humanMsg = [];
            let buffer = '';

            humanMsg.push({
                type: "text",
                text: "{{input}}"
            });

            const systemTemplate = PromptTemplate.fromTemplate(validatorPrompt,
                { templateFormat: "mustache" }
            );

            const humanTemplate = PromptTemplate.fromTemplate(
                JSON.stringify(humanMsg),
                { templateFormat: "mustache" }
            );

            const baseMessages = [
                new SystemMessagePromptTemplate(systemTemplate),
                new HumanMessagePromptTemplate(humanTemplate)
            ];

            const chatPrompt = ChatPromptTemplate.fromMessages([
                ...baseMessages,
                ["placeholder", "{agent_scratchpad}"]
            ]);

            // Prepare the variables for formatting
            const variables = {
                projectdetails: state.projectDetails || "Not available.",
                implementationplan: state.implementationPlan!,
                files: contents.map(f => `- ${f.path}`).join('\n'),
                modifiedfiles: state.files
                    ?.map((f) => `${FILE_SEPARATOR}\nFile: ${f.path}\nDescription: ${f.description}\nCode:\n${f.code ?? "(New File)"}`)
                    .join(`\n\n${FILE_SEPARATOR}\n\n`) || "",
                workspace: this.workspace,
                input: `Write and execute midscene tests for the implementation plan`,
            };

            try {
                const agent = createToolCallingAgent({
                    llm: this.model,
                    tools: this.tools,
                    prompt: chatPrompt,
                });

                const executor = new AgentExecutor({
                    agent,
                    tools: this.tools
                });

                for await (const event of await executor.streamEvents(
                    variables,
                    { version: "v2" }
                )) {
                    switch (event.event) {
                        case "on_chat_model_stream":
                            if (event.data.chunk?.content) {
                                const chunk = Array.isArray(event.data.chunk.content) ?
                                    event.data.chunk.content[0]?.text || ''
                                    :
                                    event.data.chunk.content.toString();

                                buffer += chunk;

                                await dispatchCustomEvent("composer-message-stream", buffer);
                            }
                            break;
                    }
                }
            } catch (error) {
                const errorMessage = error?.toString?.() || '';
                if (includeImage && (
                    errorMessage.includes('image') ||
                    errorMessage.includes('multimodal') ||
                    errorMessage.includes('unsupported')
                )) {
                    await dispatchCustomEvent("composer-warning", {
                        warning: "Image processing not supported by the model. Retrying without image...",
                    });
                    return false;
                }
                throw error;
            } finally {
                await cleanupProcesses();
            }

            return buffer;
        };

        const buffer = await executeStep(true);
        const messages: ChatMessage[] = [...state.messages, new ChatMessage(buffer || "", "assistant")];

        return {
            messages
        } satisfies Partial<PlanExecuteState>;
    }
}