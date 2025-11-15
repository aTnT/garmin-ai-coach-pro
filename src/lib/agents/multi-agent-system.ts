/**
 * Multi-Agent Training Analysis System
 *
 * Architecture: 2-Stage Parallel-Sequential Workflow
 *
 * Stage 1 (Parallel): 3 Summarizer Agents process data simultaneously
 *   - Metrics Summarizer
 *   - Physiology Summarizer
 *   - Activity Summarizer
 *
 * Stage 2 (Sequential): 3 Expert Agents provide specialized analysis
 *   - Dr. Aiden Nakamura (Metrics Expert)
 *   - Dr. Kwame Osei (Physiology Expert)
 *   - Coach Elena Petrova (Activity Expert)
 *
 * Integration: Synthesis Agent combines insights from all experts
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

// Agent State Interface
export interface AgentState {
  // Input data
  userId: string;
  userContext: {
    name: string;
    age?: number;
    gender?: string;
    sports?: string[];
    goals?: string;
  };

  // Training data
  metrics: Array<{
    date: Date;
    type: string;
    value: number;
    unit?: string;
  }>;

  workouts: Array<{
    date: Date;
    sport: string;
    type: string;
    duration?: number;
    distance?: number;
    completed: boolean;
  }>;

  plans: Array<{
    name: string;
    sport: string;
    goal?: string;
    status: string;
  }>;

  // User query
  query?: string;

  // Agent outputs (parallel stage)
  metricsSummary?: string;
  physiologySummary?: string;
  activitySummary?: string;

  // Expert analyses (sequential stage)
  metricsAnalysis?: string;
  physiologyAnalysis?: string;
  activityAnalysis?: string;

  // Integration
  synthesizedInsights?: string;
  readinessScore?: number;
  recommendations?: string[];

  // Workflow control
  requiresHumanInput?: boolean;
  humanQuestion?: string;
  humanResponse?: string;

  // Final output
  finalResponse?: string;
}

/**
 * Initialize LLM based on provider
 */
export function initializeLLM(provider: 'anthropic' | 'openai' = 'anthropic', modelName?: string) {
  if (provider === 'anthropic') {
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      modelName: modelName || 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
    });
  } else {
    return new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: modelName || 'gpt-4o',
      temperature: 0.7,
    });
  }
}

/**
 * Stage 1: Metrics Summarizer
 * Processes and summarizes training metrics data
 */
async function metricsSummarizer(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are a data analysis specialist. Summarize the following training metrics concisely:
- Identify key trends in HRV, training load, stress, sleep
- Calculate averages and note significant deviations
- Flag any concerning patterns
Keep the summary factual and under 200 words.`;

  const metricsData = state.metrics
    .slice(-30) // Last 30 days
    .map(m => `${m.date.toISOString().split('T')[0]}: ${m.type} = ${m.value}${m.unit || ''}`)
    .join('\n');

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Metrics data:\n${metricsData}`),
  ];

  const response = await llm.invoke(messages);

  return {
    metricsSummary: response.content as string,
  };
}

/**
 * Stage 1: Physiology Summarizer
 * Processes physiological indicators
 */
async function physiologySummarizer(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are a sports science specialist. Summarize physiological data:
- Recovery indicators (HRV, resting HR, sleep quality)
- Stress and fatigue signals
- Readiness patterns
Keep under 200 words.`;

  const physiologyData = state.metrics
    .filter(m => ['HRV', 'RESTING_HR', 'STRESS_LEVEL', 'SLEEP_HOURS'].includes(m.type))
    .slice(-30)
    .map(m => `${m.date.toISOString().split('T')[0]}: ${m.type} = ${m.value}`)
    .join('\n');

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Physiology data:\n${physiologyData}`),
  ];

  const response = await llm.invoke(messages);

  return {
    physiologySummary: response.content as string,
  };
}

/**
 * Stage 1: Activity Summarizer
 * Processes workout history
 */
async function activitySummarizer(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are a training analyst. Summarize workout data:
- Total workouts and completion rate
- Sport distribution and workout types
- Volume trends (duration, distance)
- Training consistency
Keep under 200 words.`;

  const activityData = state.workouts
    .slice(-30)
    .map(w => `${w.date.toISOString().split('T')[0]}: ${w.sport} ${w.type} - ${w.duration}min, ${w.distance}km [${w.completed ? 'DONE' : 'SKIPPED'}]`)
    .join('\n');

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Workout data:\n${activityData}\n\nActive plans: ${state.plans.map(p => p.name).join(', ')}`),
  ];

  const response = await llm.invoke(messages);

  return {
    activitySummary: response.content as string,
  };
}

/**
 * Stage 2: Dr. Aiden Nakamura - Metrics Expert
 * Analyzes training load, fitness trends, performance metrics
 */
async function drAidenAnalysis(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are Dr. Aiden Nakamura, a sports scientist specializing in training load management and performance metrics.

Your expertise:
- Training load analysis (ACWR, acute/chronic load ratios)
- Fitness progression tracking
- Performance trend identification
- Injury risk assessment based on load patterns

Analyze the data and provide:
1. Current training load status (optimal/concerning)
2. Fitness trend (improving/plateauing/declining)
3. Injury risk factors
4. Load management recommendations

Be specific, cite the ACWR optimal range (0.8-1.3), and reference Gabbett's research when relevant.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Metrics Summary:\n${state.metricsSummary}\n\nWorkout Summary:\n${state.activitySummary}\n\nUser Query: ${state.query || 'Provide overall assessment'}`),
  ];

  const response = await llm.invoke(messages);

  return {
    metricsAnalysis: response.content as string,
  };
}

/**
 * Stage 2: Dr. Kwame Osei - Physiology Expert
 * Analyzes HRV, sleep, stress, recovery
 */
async function drKwameAnalysis(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are Dr. Kwame Osei, a sports physiologist specializing in recovery and adaptation.

Your expertise:
- HRV-guided training (Plews et al., 2013)
- Sleep and recovery optimization (Milewski et al., 2014)
- Stress management and overtraining prevention
- Autonomic nervous system balance

Analyze the data and provide:
1. Recovery status (well-recovered/fatigued/overtrained)
2. HRV trends and what they indicate
3. Sleep quality assessment
4. Stress levels and impact on training
5. Recovery recommendations

Reference scientific research when making recommendations.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Physiology Summary:\n${state.physiologySummary}\n\nMetrics Summary:\n${state.metricsSummary}\n\nUser Query: ${state.query || 'Provide recovery assessment'}`),
  ];

  const response = await llm.invoke(messages);

  return {
    physiologyAnalysis: response.content as string,
  };
}

/**
 * Stage 2: Coach Elena Petrova - Activity Expert
 * Analyzes workout patterns and execution quality
 */
async function coachElenaAnalysis(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are Coach Elena Petrova, an elite endurance coach with 20+ years of experience.

Your expertise:
- Workout pattern analysis and periodization
- Training plan adherence and execution quality
- Sport-specific coaching for running, cycling, swimming, triathlon
- Pacing strategy and race preparation

Analyze the data and provide:
1. Training consistency and adherence
2. Workout execution quality
3. Periodization assessment (Base/Build/Peak/Taper)
4. Specific workout recommendations for upcoming sessions
5. Adjustments needed based on current performance

Be practical, motivational, and sport-specific in your recommendations.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Activity Summary:\n${state.activitySummary}\n\nPhysiology Summary:\n${state.physiologySummary}\n\nActive Plans: ${state.plans.map(p => `${p.name} (${p.sport}, Goal: ${p.goal})`).join('; ')}\n\nUser Query: ${state.query || 'Provide training assessment'}`),
  ];

  const response = await llm.invoke(messages);

  return {
    activityAnalysis: response.content as string,
  };
}

/**
 * Integration: Synthesis Agent
 * Combines insights from all experts into cohesive recommendations
 */
async function synthesisAgent(state: AgentState): Promise<Partial<AgentState>> {
  const llm = initializeLLM();

  const systemPrompt = `You are the Synthesis Coordinator. Your role is to integrate insights from three expert agents:
- Dr. Aiden Nakamura (Metrics Expert)
- Dr. Kwame Osei (Physiology Expert)
- Coach Elena Petrova (Activity Expert)

Create a cohesive, actionable response that:
1. Synthesizes the key insights from all experts
2. Identifies areas of agreement and concern
3. Provides prioritized, specific recommendations
4. Answers the user's query directly
5. Maintains a supportive, encouraging tone

Output format:
## Summary
[2-3 sentences overview]

## Key Insights
[Bullet points from each expert]

## Recommendations
[Prioritized action items]

## Answer to Your Question
[Direct response to user query]`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`User Query: ${state.query || 'How am I doing with my training?'}

Dr. Aiden (Metrics):
${state.metricsAnalysis}

Dr. Kwame (Physiology):
${state.physiologyAnalysis}

Coach Elena (Activity):
${state.activityAnalysis}

User Context: ${state.userContext.name}, ${state.userContext.age ? `${state.userContext.age} years old, ` : ''}${state.userContext.gender || ''}, Training for: ${state.userContext.goals || 'general fitness'}`),
  ];

  const response = await llm.invoke(messages);

  return {
    synthesizedInsights: response.content as string,
    finalResponse: response.content as string,
  };
}

/**
 * Execute the multi-agent analysis workflow
 *
 * NOTE: LangGraph integration deferred to next iteration due to API compatibility.
 * Current implementation uses sequential async execution which delivers the same
 * multi-agent functionality without the graph abstraction layer.
 *
 * Workflow: Stage 1 (Summarizers) → Stage 2 (Experts) → Integration (Synthesis)
 */
export async function runMultiAgentAnalysis(input: AgentState): Promise<string> {
  try {
    console.log('[Multi-Agent] Starting analysis for user:', input.userId);

    let state: AgentState = { ...input };

    // Stage 1: Run all summarizers (sequential for now, parallel in next iteration)
    console.log('[Multi-Agent] Stage 1: Running summarizers...');
    const metricsResult = await metricsSummarizer(state);
    state = { ...state, ...metricsResult };

    const physiologyResult = await physiologySummarizer(state);
    state = { ...state, ...physiologyResult };

    const activityResult = await activitySummarizer(state);
    state = { ...state, ...activityResult };

    // Stage 2: Run expert analyses (sequential)
    console.log('[Multi-Agent] Stage 2: Running expert analyses...');
    const aidenResult = await drAidenAnalysis(state);
    state = { ...state, ...aidenResult };

    const kwameResult = await drKwameAnalysis(state);
    state = { ...state, ...kwameResult };

    const elenaResult = await coachElenaAnalysis(state);
    state = { ...state, ...elenaResult };

    // Integration: Synthesis
    console.log('[Multi-Agent] Integration: Running synthesis...');
    const synthesisResult = await synthesisAgent(state);
    state = { ...state, ...synthesisResult };

    console.log('[Multi-Agent] Analysis complete');

    return state.finalResponse || 'Unable to generate analysis';
  } catch (error: any) {
    console.error('[Multi-Agent] Error during analysis:', error);
    throw new Error(`Multi-agent analysis failed: ${error.message}`);
  }
}
