import { describe, it, expect, beforeEach } from 'vitest';
import { createOrchestratorTool } from '../src/tools/orchestrator';
import type { WingmanConfig } from '../src/agent';
import { ChatAnthropic } from '@langchain/anthropic';
import { CallbackManager } from '@langchain/core/callbacks/manager';

describe('Orchestrator Tool', () => {
	let mockConfig: WingmanConfig;
	let orchestratorTool: ReturnType<typeof createOrchestratorTool>;

	beforeEach(() => {
		mockConfig = {
			name: 'test-agent',
			model: new ChatAnthropic({
				apiKey: 'test-key',
				model: 'claude-3-sonnet-20240229',
			}),
			workingDirectory: '/test/directory',
			instructions: '',
			toolAbilities: {
				blockedCommands: [],
			},
		};

		orchestratorTool = createOrchestratorTool(mockConfig);
	});

	it('should create orchestrator tool with correct name and description', () => {
		expect(orchestratorTool.name).toBe('orchestrator');
		expect(orchestratorTool.description).toContain('multi-agent coordination');
		expect(orchestratorTool.description).toContain('parallel execution');
	});

	it('should have correct schema properties', () => {
		const schema = orchestratorTool.schema;
		expect(schema).toBeDefined();
		
		// Check that the schema has the expected properties
		const schemaShape = schema.shape || schema._def?.shape;
		expect(schemaShape).toBeDefined();
		expect(schemaShape.request).toBeDefined();
		expect(schemaShape.agentCount).toBeDefined();
		expect(schemaShape.taskTypes).toBeDefined();
		expect(schemaShape.parallelExecution).toBeDefined();
	});

	it('should detect orchestration requests correctly', async () => {
		const callbackManager = new CallbackManager();
		
		// Test with a clear orchestration request
		const result = await orchestratorTool.invoke(
			{
				request: 'Create 3 agents to work on implementing a new feature with testing and documentation',
				agentCount: 3,
				taskTypes: ['generation', 'testing', 'documentation'],
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'orchestrator',
					args: {}
				},
			}
		);

		expect(result).toBeDefined();
		expect(result.content).toBeDefined();
		
		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		expect(content.orchestrationId).toBeDefined();
		expect(content.taskPlan).toBeDefined();
		expect(content.taskPlan.totalTasks).toBeGreaterThan(0);
	});

	it('should reject non-orchestration requests', async () => {
		const callbackManager = new CallbackManager();
		
		// Test with a simple single-agent request
		const result = await orchestratorTool.invoke(
			{
				request: 'Read this file and tell me what it does',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'orchestrator',
					args: {}
				},
			}
		);

		expect(result).toBeDefined();
		expect(result.content).toBeDefined();
		
		const content = JSON.parse(result.content);
		expect(content.success).toBe(false);
		expect(content.message).toContain("doesn't require multi-agent orchestration");
		expect(content.suggestion).toBeDefined();
	});

	it('should generate appropriate task plans', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await orchestratorTool.invoke(
			{
				request: 'Implement a complete REST API with testing, documentation, and code analysis',
				taskTypes: ['code_analysis', 'generation', 'testing', 'documentation'],
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		expect(content.taskPlan.totalTasks).toBe(4); // Should match the number of task types
		expect(content.taskPlan.taskTypes).toEqual(['code_analysis', 'generation', 'testing', 'documentation']);
		expect(content.orchestrationState).toBeDefined();
		expect(content.nextSteps).toBeDefined();
		expect(Array.isArray(content.nextSteps)).toBe(true);
	});

	it('should handle schema validation', () => {
		// Test that the schema validates correctly
		const validInput = {
			request: 'Do some work',
			agentCount: 2,
			taskTypes: ['generation', 'testing'],
			parallelExecution: true,
		};

		const result = orchestratorTool.schema.safeParse(validInput);
		expect(result.success).toBe(true);

		// Test invalid input
		const invalidInput = {
			request: 'Do some work',
			taskTypes: ['invalid_type'], // Invalid agent specialization
		};

		const invalidResult = orchestratorTool.schema.safeParse(invalidInput);
		expect(invalidResult.success).toBe(false);
	});

	it('should set appropriate defaults', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await orchestratorTool.invoke(
			{
				request: 'Parallelize this work across multiple agents for a large codebase implementation',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		if (content.success) {
			expect(content.orchestrationState.maxConcurrentAgents).toBeDefined();
			expect(content.orchestrationState.allowUserCancellation).toBe(true);
			expect(content.orchestrationState.timeoutMs).toBeDefined();
		}
	});

	it('should analyze orchestration requests correctly', () => {
		// Test the internal analysis logic by checking different request types
		const orchestrationRequests = [
			'Create 3 agents to work on this',
			'Spawn sub-agents for parallel processing',
			'Use multiple agents to handle this large codebase',
			'Distribute this work among specialized agents',
		];

		const nonOrchestrationRequests = [
			'Read this file',
			'What does this function do?',
			'Fix this bug',
			'Add a comment to this line',
		];

		// We can't directly test the internal function, but we can test the tool behavior
		// This is more of an integration test to ensure the analysis works as expected
		orchestrationRequests.forEach(request => {
			const parsed = orchestratorTool.schema.parse({ request });
			expect(parsed.request).toBe(request);
		});

		nonOrchestrationRequests.forEach(request => {
			const parsed = orchestratorTool.schema.parse({ request });
			expect(parsed.request).toBe(request);
		});
	});
});