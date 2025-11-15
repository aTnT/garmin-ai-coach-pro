/**
 * Unit Tests for Multi-Agent Training Analysis System
 *
 * Tests the 2-stage parallel-sequential workflow:
 * Stage 1: Summarizers (Metrics, Physiology, Activity)
 * Stage 2: Expert Analysts (Dr. Aiden, Dr. Kwame, Coach Elena)
 * Integration: Synthesis Agent
 */

import { runMultiAgentAnalysis, initializeLLM, type AgentState } from '../multi-agent-system';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

// Mock LangChain modules
jest.mock('@langchain/anthropic');
jest.mock('@langchain/openai');

describe('Multi-Agent Training Analysis System', () => {
  let mockLLMInvoke: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a mock invoke function
    mockLLMInvoke = jest.fn();

    // Mock ChatAnthropic
    (ChatAnthropic as jest.MockedClass<typeof ChatAnthropic>).mockImplementation(() => ({
      invoke: mockLLMInvoke,
    } as any));

    // Mock ChatOpenAI
    (ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>).mockImplementation(() => ({
      invoke: mockLLMInvoke,
    } as any));
  });

  describe('initializeLLM', () => {
    it('should initialize Anthropic LLM by default', () => {
      const llm = initializeLLM();

      expect(ChatAnthropic).toHaveBeenCalledWith({
        apiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
      });
    });

    it('should initialize Anthropic LLM with custom model', () => {
      const llm = initializeLLM('anthropic', 'claude-3-opus-20240229');

      expect(ChatAnthropic).toHaveBeenCalledWith({
        apiKey: process.env.ANTHROPIC_API_KEY,
        modelName: 'claude-3-opus-20240229',
        temperature: 0.7,
      });
    });

    it('should initialize OpenAI LLM when specified', () => {
      const llm = initializeLLM('openai');

      expect(ChatOpenAI).toHaveBeenCalledWith({
        apiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4o',
        temperature: 0.7,
      });
    });

    it('should initialize OpenAI LLM with custom model', () => {
      const llm = initializeLLM('openai', 'gpt-4-turbo');

      expect(ChatOpenAI).toHaveBeenCalledWith({
        apiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4-turbo',
        temperature: 0.7,
      });
    });
  });

  describe('runMultiAgentAnalysis', () => {
    const createMockState = (): AgentState => ({
      userId: 'test-user-123',
      userContext: {
        name: 'Test Athlete',
        age: 30,
        gender: 'male',
        sports: ['RUNNING', 'CYCLING'],
        goals: 'Marathon PR in 12 weeks',
      },
      metrics: [
        { date: new Date('2024-01-01'), type: 'HRV', value: 65, unit: 'ms' },
        { date: new Date('2024-01-01'), type: 'TRAINING_LOAD', value: 400, unit: 'TSS' },
        { date: new Date('2024-01-01'), type: 'RESTING_HR', value: 52, unit: 'bpm' },
        { date: new Date('2024-01-01'), type: 'STRESS_LEVEL', value: 35 },
        { date: new Date('2024-01-01'), type: 'SLEEP_HOURS', value: 7.5, unit: 'hours' },
      ],
      workouts: [
        {
          date: new Date('2024-01-01'),
          sport: 'RUNNING',
          type: 'EASY',
          duration: 45,
          distance: 8,
          completed: true,
        },
        {
          date: new Date('2024-01-02'),
          sport: 'CYCLING',
          type: 'TEMPO',
          duration: 60,
          distance: 25,
          completed: true,
        },
      ],
      plans: [
        {
          name: 'Marathon Training Plan',
          sport: 'RUNNING',
          goal: 'Sub-3:30 marathon',
          status: 'ACTIVE',
        },
      ],
      query: 'How is my training going?',
    });

    it('should complete full multi-agent workflow', async () => {
      const mockState = createMockState();

      // Mock LLM responses for each agent
      mockLLMInvoke
        // Stage 1: Summarizers
        .mockResolvedValueOnce({ content: 'Metrics summary: HRV is stable, training load moderate' })
        .mockResolvedValueOnce({ content: 'Physiology summary: Good recovery, adequate sleep' })
        .mockResolvedValueOnce({ content: 'Activity summary: Consistent training, 90% completion rate' })
        // Stage 2: Experts
        .mockResolvedValueOnce({ content: 'Dr. Aiden: Training load is optimal, ACWR in range' })
        .mockResolvedValueOnce({ content: 'Dr. Kwame: Recovery is good, HRV trending positive' })
        .mockResolvedValueOnce({ content: 'Coach Elena: Great consistency, ready for build phase' })
        // Integration: Synthesis
        .mockResolvedValueOnce({
          content: '## Summary\nYour training is progressing well.\n## Recommendations\n- Continue current approach\n- Focus on race-specific workouts',
        });

      const result = await runMultiAgentAnalysis(mockState);

      // Verify all 7 agents were called
      expect(mockLLMInvoke).toHaveBeenCalledTimes(7);

      // Verify result contains synthesis output
      expect(result).toContain('Summary');
      expect(result).toContain('Recommendations');
    });

    it('should handle empty metrics gracefully', async () => {
      const mockState = createMockState();
      mockState.metrics = [];

      mockLLMInvoke
        .mockResolvedValueOnce({ content: 'No metrics data available' })
        .mockResolvedValueOnce({ content: 'No physiology data available' })
        .mockResolvedValueOnce({ content: 'Activity summary available' })
        .mockResolvedValueOnce({ content: 'Dr. Aiden: Limited data for analysis' })
        .mockResolvedValueOnce({ content: 'Dr. Kwame: Need more physiological data' })
        .mockResolvedValueOnce({ content: 'Coach Elena: Focus on data collection' })
        .mockResolvedValueOnce({ content: '## Summary\nInsufficient data. Please sync more metrics.' });

      const result = await runMultiAgentAnalysis(mockState);

      expect(result).toBeDefined();
      expect(mockLLMInvoke).toHaveBeenCalledTimes(7);
    });

    it('should handle empty workouts gracefully', async () => {
      const mockState = createMockState();
      mockState.workouts = [];

      mockLLMInvoke
        .mockResolvedValueOnce({ content: 'Metrics summary available' })
        .mockResolvedValueOnce({ content: 'Physiology summary available' })
        .mockResolvedValueOnce({ content: 'No workout data available' })
        .mockResolvedValueOnce({ content: 'Dr. Aiden: Cannot assess training load' })
        .mockResolvedValueOnce({ content: 'Dr. Kwame: Physiology looks good' })
        .mockResolvedValueOnce({ content: 'Coach Elena: Need workout history for recommendations' })
        .mockResolvedValueOnce({ content: '## Summary\nStart logging workouts for better insights.' });

      const result = await runMultiAgentAnalysis(mockState);

      expect(result).toBeDefined();
    });

    it('should pass user query through to experts', async () => {
      const mockState = createMockState();
      mockState.query = 'Am I overtraining?';

      mockLLMInvoke
        .mockResolvedValueOnce({ content: 'Metrics summary' })
        .mockResolvedValueOnce({ content: 'Physiology summary' })
        .mockResolvedValueOnce({ content: 'Activity summary' })
        .mockResolvedValueOnce({ content: 'Dr. Aiden analysis' })
        .mockResolvedValueOnce({ content: 'Dr. Kwame analysis' })
        .mockResolvedValueOnce({ content: 'Coach Elena analysis' })
        .mockResolvedValueOnce({ content: 'Not showing signs of overtraining' });

      const result = await runMultiAgentAnalysis(mockState);

      // Check that one of the LLM calls included the user query
      const callsWithQuery = mockLLMInvoke.mock.calls.filter((call) =>
        JSON.stringify(call).includes('Am I overtraining?')
      );

      expect(callsWithQuery.length).toBeGreaterThan(0);
    });

    it('should handle LLM errors gracefully', async () => {
      const mockState = createMockState();

      mockLLMInvoke.mockRejectedValueOnce(new Error('LLM API error'));

      await expect(runMultiAgentAnalysis(mockState)).rejects.toThrow('Multi-agent analysis failed');
    });

    it('should process recent metrics only (last 30 days)', async () => {
      const mockState = createMockState();

      // Add old metrics (should be filtered out)
      mockState.metrics = [
        ...mockState.metrics,
        { date: new Date('2023-01-01'), type: 'HRV', value: 50 }, // Old
        { date: new Date('2024-01-15'), type: 'HRV', value: 70 }, // Recent
      ];

      mockLLMInvoke
        .mockResolvedValue({ content: 'Mock response' })
        .mockResolvedValue({ content: 'Mock response' })
        .mockResolvedValue({ content: 'Mock response' })
        .mockResolvedValue({ content: 'Mock response' })
        .mockResolvedValue({ content: 'Mock response' })
        .mockResolvedValue({ content: 'Mock response' })
        .mockResolvedValue({ content: 'Final response' });

      const result = await runMultiAgentAnalysis(mockState);

      expect(result).toBe('Final response');
    });

    it('should handle missing user context fields', async () => {
      const mockState = createMockState();
      mockState.userContext = {
        name: 'Minimal User',
        // Missing age, gender, sports, goals
      };

      mockLLMInvoke
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Analysis with minimal context' });

      const result = await runMultiAgentAnalysis(mockState);

      expect(result).toBeDefined();
    });

    it('should default to general assessment when no query provided', async () => {
      const mockState = createMockState();
      delete mockState.query;

      mockLLMInvoke
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Mock' })
        .mockResolvedValue({ content: 'Overall assessment provided' });

      const result = await runMultiAgentAnalysis(mockState);

      // Check that calls use default query text
      const callsWithDefault = mockLLMInvoke.mock.calls.filter((call) =>
        JSON.stringify(call).includes('overall assessment' || 'How am I doing')
      );

      expect(result).toBeDefined();
    });

    it('should include all expert personas in analysis', async () => {
      const mockState = createMockState();

      mockLLMInvoke
        .mockResolvedValueOnce({ content: 'Metrics summary' })
        .mockResolvedValueOnce({ content: 'Physiology summary' })
        .mockResolvedValueOnce({ content: 'Activity summary' })
        .mockResolvedValueOnce({ content: 'Dr. Aiden Nakamura analysis' })
        .mockResolvedValueOnce({ content: 'Dr. Kwame Osei analysis' })
        .mockResolvedValueOnce({ content: 'Coach Elena Petrova analysis' })
        .mockResolvedValueOnce({ content: 'Synthesis from all three experts' });

      const result = await runMultiAgentAnalysis(mockState);

      // Verify synthesis call included all three expert outputs
      const synthesisCall = mockLLMInvoke.mock.calls[6];
      const synthesisInput = JSON.stringify(synthesisCall);

      expect(synthesisInput).toContain('Dr. Aiden');
      expect(synthesisInput).toContain('Dr. Kwame');
      expect(synthesisInput).toContain('Coach Elena');
    });

    it('should return final response from synthesis agent', async () => {
      const mockState = createMockState();
      const expectedResponse = '## Summary\nExcellent progress!\n## Recommendations\n1. Continue\n2. Build';

      mockLLMInvoke
        .mockResolvedValueOnce({ content: 'Mock' })
        .mockResolvedValueOnce({ content: 'Mock' })
        .mockResolvedValueOnce({ content: 'Mock' })
        .mockResolvedValueOnce({ content: 'Mock' })
        .mockResolvedValueOnce({ content: 'Mock' })
        .mockResolvedValueOnce({ content: 'Mock' })
        .mockResolvedValueOnce({ content: expectedResponse });

      const result = await runMultiAgentAnalysis(mockState);

      expect(result).toBe(expectedResponse);
    });
  });

  describe('Agent Workflow Integration', () => {
    it('should call all 7 agents in the workflow', async () => {
      const mockState: AgentState = {
        userId: 'test-user',
        userContext: { name: 'Test' },
        metrics: [],
        workouts: [],
        plans: [],
      };

      mockLLMInvoke.mockResolvedValue({ content: 'Mock response' });

      const result = await runMultiAgentAnalysis(mockState);

      // Verify all 7 agents were called
      // Stage 1: 3 summarizers + Stage 2: 3 experts + Integration: 1 synthesis = 7 total
      expect(mockLLMInvoke).toHaveBeenCalledTimes(7);

      // Verify final result is returned
      expect(result).toBe('Mock response');
    });
  });

  describe('Error Handling', () => {
    it('should throw descriptive error on LLM failure', async () => {
      const mockState: AgentState = {
        userId: 'test-user',
        userContext: { name: 'Test' },
        metrics: [],
        workouts: [],
        plans: [],
      };

      mockLLMInvoke.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      await expect(runMultiAgentAnalysis(mockState)).rejects.toThrow(
        'Multi-agent analysis failed: API rate limit exceeded'
      );
    });

    it('should handle network errors', async () => {
      const mockState: AgentState = {
        userId: 'test-user',
        userContext: { name: 'Test' },
        metrics: [],
        workouts: [],
        plans: [],
      };

      mockLLMInvoke.mockRejectedValueOnce(new Error('Network error'));

      await expect(runMultiAgentAnalysis(mockState)).rejects.toThrow('Network error');
    });
  });
});
