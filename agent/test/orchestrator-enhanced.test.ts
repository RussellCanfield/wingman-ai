import { describe, it, expect, beforeEach } from 'vitest';
import { createEnhancedOrchestratorTool } from '../src/tools/orchestrator-enhanced';
import type { WingmanConfig } from '../src/agent';
import { ChatAnthropic } from '@langchain/anthropic';
import { CallbackManager } from '@langchain/core/callbacks/manager';

describe('Enhanced Orchestrator Tool', () => {
	let mockConfig: WingmanConfig;
	let enhancedOrchestratorTool: ReturnType<typeof createEnhancedOrchestratorTool>;

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

		enhancedOrchestratorTool = createEnhancedOrchestratorTool(mockConfig);
	});

	it('should create enhanced orchestrator tool with correct name and description', () => {
		expect(enhancedOrchestratorTool.name).toBe('enhanced_orchestrator');
		expect(enhancedOrchestratorTool.description).toContain('multiple agents of the same specialization');
		expect(enhancedOrchestratorTool.description).toContain('Workload distribution'); // Capital W
	});

	it('should support multiple code generation agents', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await enhancedOrchestratorTool.invoke(
			{
				request: 'Create 2 generation agents to implement frontend and backend for a web application with multiple agents and parallel execution',
				agentPoolSizes: {
					'generation': 2,
					'testing': 1,
				},
				workloadDistribution: 'by_modules',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'enhanced_orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		expect(content.taskPlan.agentPools).toBeDefined();
		
		// Should have a generation pool with 2 agents
		const generationPool = content.taskPlan.agentPools.find(
			(pool: any) => pool.specialization === 'generation'
		);
		expect(generationPool).toBeDefined();
		expect(generationPool.agentCount).toBe(2);
		expect(generationPool.tasks.length).toBeGreaterThan(1); // Multiple tasks for multiple agents
	});

	it('should handle microservices architecture with multiple agents', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await enhancedOrchestratorTool.invoke(
			{
				request: 'Implement a microservices architecture with multiple services, comprehensive testing, and documentation using multiple agents',
				workloadDistribution: 'by_features',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'enhanced_orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		expect(content.taskPlan.agentPools.length).toBeGreaterThan(1);
		
		// Should detect microservices and suggest multiple agents
		const generationPool = content.taskPlan.agentPools.find(
			(pool: any) => pool.specialization === 'generation'
		);
		if (generationPool) {
			expect(generationPool.agentCount).toBeGreaterThan(1);
		}
	});

	it('should support explicit agent pool sizing', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await enhancedOrchestratorTool.invoke(
			{
				request: 'Build a complex application with multiple components using multiple agents for parallel development',
				agentPoolSizes: {
					'generation': 3,
					'testing': 2,
					'documentation': 1,
				},
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'enhanced_orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		
		const agentPools = content.taskPlan.agentPools;
		expect(agentPools).toBeDefined();
		
		// Check that explicit pool sizes are respected
		const generationPool = agentPools.find((pool: any) => pool.specialization === 'generation');
		const testingPool = agentPools.find((pool: any) => pool.specialization === 'testing');
		const documentationPool = agentPools.find((pool: any) => pool.specialization === 'documentation');
		
		if (generationPool) expect(generationPool.agentCount).toBe(3);
		if (testingPool) expect(testingPool.agentCount).toBe(2);
		if (documentationPool) expect(documentationPool.agentCount).toBe(1);
	});

	it('should distribute work by different strategies', async () => {
		const callbackManager = new CallbackManager();
		const strategies = ['by_modules', 'by_features', 'by_files', 'auto'] as const;
		
		for (const strategy of strategies) {
			const result = await enhancedOrchestratorTool.invoke(
				{
					request: 'Implement a large application with multiple components using multiple agents for parallel development',
					agentPoolSizes: { 'generation': 2 },
					workloadDistribution: strategy,
				},
				{
					callbacks: callbackManager,
					toolCall: { 
						id: `test-tool-call-${strategy}`,
						name: 'enhanced_orchestrator',
						args: {}
					},
				}
			);

			const content = JSON.parse(result.content);
			expect(content.success).toBe(true);
			expect(content.taskPlan.workloadDistribution).toContain(strategy);
			
			// Should have multiple tasks for the generation agents
			const generationPool = content.taskPlan.agentPools.find(
				(pool: any) => pool.specialization === 'generation'
			);
			if (generationPool) {
				expect(generationPool.tasks.length).toBeGreaterThan(1);
			}
		}
	});

	it('should handle complex task dependencies with multiple agents', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await enhancedOrchestratorTool.invoke(
			{
				request: 'Build a full-stack application with frontend, backend, API, and comprehensive testing using multiple agents for parallel development',
				agentPoolSizes: {
					'generation': 3, // Frontend, Backend, API
					'testing': 2,    // Unit tests, Integration tests
				},
				workloadDistribution: 'by_modules',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'enhanced_orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		expect(content.taskPlan.totalTasks).toBeGreaterThan(1); // Adjusted expectation
		expect(content.taskPlan.parallelGroups).toBeGreaterThan(0);
		
		// Should have proper agent pools
		expect(content.taskPlan.agentPools.length).toBeGreaterThan(0);
		
		// Total agent count should match pool sizes
		const totalAgents = content.taskPlan.agentPools.reduce(
			(sum: number, pool: any) => sum + pool.agentCount, 
			0
		);
		expect(totalAgents).toBeGreaterThan(1);
	});

	it('should provide detailed task scoping information', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await enhancedOrchestratorTool.invoke(
			{
				request: 'Implement a modular e-commerce platform using multiple agents for parallel development',
				agentPoolSizes: { 'generation': 2 },
				workloadDistribution: 'by_modules',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'enhanced_orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(true);
		expect(content.taskPlan).toBeDefined();
		expect(content.taskPlan.agentPools).toBeDefined();
		expect(content.taskPlan.workloadDistribution).toContain('by_modules');
		
		// Should provide next steps for enhanced orchestration
		expect(content.nextSteps).toBeDefined();
		expect(content.nextSteps.some((step: string) => 
			step.includes('workload distribution')
		)).toBe(true);
	});

	it('should fall back gracefully for single-agent requests', async () => {
		const callbackManager = new CallbackManager();
		
		const result = await enhancedOrchestratorTool.invoke(
			{
				request: 'Fix a small bug in this function',
			},
			{
				callbacks: callbackManager,
				toolCall: { 
					id: 'test-tool-call',
					name: 'enhanced_orchestrator',
					args: {}
				},
			}
		);

		const content = JSON.parse(result.content);
		expect(content.success).toBe(false);
		expect(content.message).toContain("doesn't require multi-agent orchestration");
	});
});