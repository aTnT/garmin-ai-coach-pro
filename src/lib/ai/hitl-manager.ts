/**
 * Human-in-the-Loop (HITL) Manager
 *
 * Enables interactive AI workflows where the system can:
 * - Ask clarifying questions during plan generation
 * - Request additional context when uncertain
 * - Guide users through complex decisions
 * - Validate assumptions before taking action
 *
 * Use cases:
 * - Plan generation: "What's your target race distance?"
 * - Goal refinement: "Are you prioritizing speed or endurance?"
 * - Adaptation approval: "Your readiness is low. Reduce intensity or take rest?"
 * - Constraint gathering: "What equipment do you have access to?"
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// Types
// ============================================================================

export interface HITLQuestion {
  id: string;
  type: 'clarification' | 'choice' | 'confirmation' | 'open_ended' | 'constraint';
  question: string;
  context?: string; // Why we're asking
  options?: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  validation?: {
    required: boolean;
    pattern?: string;
    min?: number;
    max?: number;
  };
  defaultValue?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface HITLResponse {
  questionId: string;
  answer: string | string[];
  timestamp: Date;
}

export interface HITLSession {
  id: string;
  workflowType:
    | 'plan_generation'
    | 'plan_refinement'
    | 'adaptation_approval'
    | 'goal_setting'
    | 'constraint_gathering';
  userId: string;
  status: 'active' | 'completed' | 'abandoned';

  // Questions and responses
  questions: HITLQuestion[];
  responses: HITLResponse[];
  currentQuestionIndex: number;

  // Context
  initialContext: Record<string, any>;
  gatheredContext: Record<string, any>;

  // Metadata
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date; // Auto-expire after 1 hour
}

export interface HITLWorkflowResult {
  needsInput: boolean;
  nextQuestion?: HITLQuestion;
  allQuestionsAnswered: boolean;
  gatheredContext: Record<string, any>;
  canProceed: boolean;
}

// ============================================================================
// Question Generation
// ============================================================================

/**
 * Generate intelligent questions based on workflow context
 * Uses AI to determine what information is missing and how to ask for it
 */
export async function generateQuestions(
  workflowType: HITLSession['workflowType'],
  context: Record<string, any>
): Promise<HITLQuestion[]> {
  const prompt = buildQuestionGenerationPrompt(workflowType, context);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent questioning
      system: getQuestionGeneratorSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const questions = parseQuestions(content.text);
    return questions;
  } catch (error: any) {
    console.error('[HITL] Question generation error:', error);

    // Fallback: Generate basic questions based on workflow type
    return generateFallbackQuestions(workflowType, context);
  }
}

/**
 * System prompt for question generation
 */
function getQuestionGeneratorSystemPrompt(): string {
  return `You are an expert endurance training coach conducting an intake interview with an athlete.

Your role is to ask clear, specific questions to gather the information needed to create an optimal training plan.

**QUESTION DESIGN PRINCIPLES:**

1. **Clarity**: Questions should be unambiguous and easy to understand
2. **Specificity**: Ask for concrete details (dates, numbers, specific goals)
3. **Priority**: Start with critical information, then nice-to-have details
4. **Context**: Explain why you're asking when it helps
5. **Options**: Provide multiple-choice when appropriate to make answering easier
6. **Validation**: Include validation rules to ensure quality responses

**QUESTION TYPES:**

- **clarification**: Resolve ambiguity in existing information
- **choice**: Select from predefined options (multiple choice)
- **confirmation**: Verify assumptions (yes/no)
- **open_ended**: Free text for complex answers
- **constraint**: Gather limitations (time, equipment, location, etc.)

**PRIORITY LEVELS:**

- **critical**: Must have to proceed (race date, goal, sport)
- **high**: Important for quality plan (current fitness, experience level)
- **medium**: Helpful for customization (preferred workout types, schedule)
- **low**: Nice-to-have for refinement (motivation, past injuries)

OUTPUT FORMAT (JSON):
{
  "questions": [
    {
      "type": "choice|clarification|confirmation|open_ended|constraint",
      "question": "Clear, specific question text",
      "context": "Why we need this information (optional)",
      "options": [
        {
          "value": "option_key",
          "label": "Human-readable label",
          "description": "What this option means (optional)"
        }
      ],
      "validation": {
        "required": true|false,
        "pattern": "regex pattern (optional)",
        "min": <number>,
        "max": <number>
      },
      "defaultValue": "Suggested default (optional)",
      "priority": "critical|high|medium|low"
    }
  ]
}

**IMPORTANT:**
- Ask no more than 5 questions at once (don't overwhelm the user)
- Start with the most critical questions
- Use multiple choice when there are clear options
- Validate numeric inputs (distances, durations, etc.)
- Be friendly and encouraging in your wording`;
}

/**
 * Build prompt for question generation
 */
function buildQuestionGenerationPrompt(
  workflowType: HITLSession['workflowType'],
  context: Record<string, any>
): string {
  let prompt = `Generate questions for the following workflow:

**WORKFLOW TYPE**: ${workflowType}

**CURRENT CONTEXT:**
${JSON.stringify(context, null, 2)}

**GOAL:**
`;

  switch (workflowType) {
    case 'plan_generation':
      prompt += `Generate a comprehensive training plan. We need to know:
- What sport/event they're training for
- Target race date and distance (if applicable)
- Current fitness level and recent training
- Available time per week
- Equipment and location constraints
- Experience level and goals (finish vs. time goal)

Identify what's missing from the current context and ask for it.`;
      break;

    case 'plan_refinement':
      prompt += `Refine an existing training plan based on user feedback. We need:
- What they want to change (more/less volume, intensity, specific days)
- Why they want to change it (too hard, conflicts, different goals)
- What's working well that should be kept
- Any new constraints or goals

Ask targeted questions to understand their refinement needs.`;
      break;

    case 'adaptation_approval':
      prompt += `Get approval for recommended plan adaptations. We need:
- User's understanding of the situation (do they agree with the triggers?)
- Their preference for adaptation approach (conservative vs. aggressive)
- Any additional context (upcoming travel, race, etc.)
- Confirmation to proceed or alternative approach

Ask for their input on the proposed changes.`;
      break;

    case 'goal_setting':
      prompt += `Help set realistic, specific goals. We need:
- Primary goal (race finish, time target, fitness improvement, weight loss)
- Timeline and constraints
- Current baseline (fitness level, recent performances)
- Motivation and commitment level
- Success criteria (how will they know they've achieved it?)

Guide them to articulate clear, achievable goals.`;
      break;

    case 'constraint_gathering':
      prompt += `Understand training constraints and preferences. We need:
- Time availability (hours per week, preferred days/times)
- Equipment access (treadmill, bike, pool, gym)
- Location preferences (indoor, outdoor, both)
- Injury history and current limitations
- Other commitments (work, family, travel)

Gather comprehensive constraint information.`;
      break;
  }

  prompt += `\n\nGenerate 3-5 targeted questions as JSON. Focus on critical missing information first.`;

  return prompt;
}

/**
 * Parse AI-generated questions
 */
function parseQuestions(responseText: string): HITLQuestion[] {
  try {
    // Extract JSON from markdown if present
    let jsonText = responseText.trim();
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid questions format');
    }

    return parsed.questions.map((q: any, index: number) => ({
      id: `q${index + 1}`,
      type: q.type || 'open_ended',
      question: q.question,
      context: q.context,
      options: q.options,
      validation: q.validation,
      defaultValue: q.defaultValue,
      priority: q.priority || 'medium',
    }));
  } catch (error: any) {
    console.error('[HITL] Question parsing error:', error);
    throw error;
  }
}

/**
 * Fallback questions if AI generation fails
 */
function generateFallbackQuestions(
  workflowType: HITLSession['workflowType'],
  context: Record<string, any>
): HITLQuestion[] {
  const questions: HITLQuestion[] = [];

  switch (workflowType) {
    case 'plan_generation':
      if (!context.sport) {
        questions.push({
          id: 'sport',
          type: 'choice',
          question: 'What sport are you training for?',
          options: [
            { value: 'RUNNING', label: 'Running' },
            { value: 'CYCLING', label: 'Cycling' },
            { value: 'SWIMMING', label: 'Swimming' },
            { value: 'TRIATHLON', label: 'Triathlon' },
            { value: 'OTHER', label: 'Other' },
          ],
          validation: { required: true },
          priority: 'critical',
        });
      }

      if (!context.goal) {
        questions.push({
          id: 'goal',
          type: 'open_ended',
          question: 'What is your training goal?',
          context: 'E.g., "Complete a marathon in 4 hours" or "Improve 5K time to under 20 minutes"',
          validation: { required: true },
          priority: 'critical',
        });
      }

      if (!context.raceDate) {
        questions.push({
          id: 'raceDate',
          type: 'open_ended',
          question: 'When is your target race or goal date?',
          context: 'Format: YYYY-MM-DD or "in 12 weeks"',
          validation: { required: false },
          priority: 'high',
        });
      }

      if (!context.weeklyHours) {
        questions.push({
          id: 'weeklyHours',
          type: 'choice',
          question: 'How many hours per week can you dedicate to training?',
          options: [
            { value: '3-5', label: '3-5 hours', description: 'Beginner friendly' },
            { value: '6-8', label: '6-8 hours', description: 'Intermediate volume' },
            { value: '9-12', label: '9-12 hours', description: 'Advanced training' },
            { value: '12+', label: '12+ hours', description: 'Competitive level' },
          ],
          validation: { required: true },
          priority: 'high',
        });
      }

      if (!context.experienceLevel) {
        questions.push({
          id: 'experienceLevel',
          type: 'choice',
          question: 'What is your experience level with this sport?',
          options: [
            { value: 'beginner', label: 'Beginner', description: 'Less than 6 months training' },
            { value: 'intermediate', label: 'Intermediate', description: '6 months - 2 years' },
            { value: 'advanced', label: 'Advanced', description: '2+ years, multiple races' },
          ],
          validation: { required: true },
          priority: 'medium',
        });
      }
      break;

    case 'adaptation_approval':
      questions.push({
        id: 'approve_adaptation',
        type: 'confirmation',
        question: 'Do you want to apply the recommended plan adaptations?',
        context: 'Based on your current readiness and recent performance',
        validation: { required: true },
        priority: 'critical',
      });

      questions.push({
        id: 'adaptation_preference',
        type: 'choice',
        question: 'How conservative should we be with the adaptations?',
        options: [
          { value: 'conservative', label: 'Conservative', description: 'Prioritize recovery and long-term health' },
          { value: 'moderate', label: 'Moderate', description: 'Balanced approach' },
          { value: 'aggressive', label: 'Aggressive', description: 'Minimize training disruption' },
        ],
        validation: { required: false },
        defaultValue: 'moderate',
        priority: 'medium',
      });
      break;

    case 'goal_setting':
      questions.push({
        id: 'primary_goal_type',
        type: 'choice',
        question: 'What is your primary training goal?',
        options: [
          { value: 'race_finish', label: 'Complete a race', description: 'Just finish, time not critical' },
          { value: 'race_time', label: 'Achieve a time goal', description: 'Specific performance target' },
          { value: 'fitness', label: 'Improve general fitness', description: 'Health and wellness focus' },
          { value: 'weight_loss', label: 'Weight loss', description: 'Body composition change' },
        ],
        validation: { required: true },
        priority: 'critical',
      });
      break;

    case 'constraint_gathering':
      questions.push({
        id: 'equipment_access',
        type: 'choice',
        question: 'What equipment do you have access to?',
        options: [
          { value: 'full', label: 'Full access', description: 'Gym, trainer, all equipment' },
          { value: 'basic', label: 'Basic', description: 'Shoes/bike, minimal equipment' },
          { value: 'limited', label: 'Limited', description: 'Travel, temporary restrictions' },
        ],
        validation: { required: true },
        priority: 'high',
      });
      break;
  }

  return questions;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Create a new HITL session
 */
export async function createHITLSession(
  workflowType: HITLSession['workflowType'],
  userId: string,
  initialContext: Record<string, any>
): Promise<HITLSession> {
  const questions = await generateQuestions(workflowType, initialContext);

  const session: HITLSession = {
    id: `hitl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workflowType,
    userId,
    status: 'active',
    questions,
    responses: [],
    currentQuestionIndex: 0,
    initialContext,
    gatheredContext: {},
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  };

  return session;
}

/**
 * Get next question in the session
 */
export function getNextQuestion(session: HITLSession): HITLQuestion | null {
  // Filter to critical and high priority questions first
  const criticalQuestions = session.questions.filter(
    (q) =>
      (q.priority === 'critical' || q.priority === 'high') &&
      !session.responses.find((r) => r.questionId === q.id)
  );

  if (criticalQuestions.length > 0) {
    return criticalQuestions[0];
  }

  // Then medium priority
  const mediumQuestions = session.questions.filter(
    (q) =>
      q.priority === 'medium' &&
      !session.responses.find((r) => r.questionId === q.id)
  );

  if (mediumQuestions.length > 0) {
    return mediumQuestions[0];
  }

  // Finally low priority
  const lowQuestions = session.questions.filter(
    (q) =>
      q.priority === 'low' &&
      !session.responses.find((r) => r.questionId === q.id)
  );

  if (lowQuestions.length > 0) {
    return lowQuestions[0];
  }

  return null; // All questions answered
}

/**
 * Submit answer to a question
 */
export function submitAnswer(
  session: HITLSession,
  questionId: string,
  answer: string | string[]
): HITLSession {
  // Validate question exists
  const question = session.questions.find((q) => q.id === questionId);
  if (!question) {
    throw new Error(`Question ${questionId} not found in session`);
  }

  // Validate answer
  if (question.validation?.required && (!answer || answer.length === 0)) {
    throw new Error(`Answer is required for question ${questionId}`);
  }

  // Add response
  session.responses.push({
    questionId,
    answer,
    timestamp: new Date(),
  });

  // Update gathered context
  session.gatheredContext[questionId] = answer;

  return session;
}

/**
 * Check if session is complete
 */
export function isSessionComplete(session: HITLSession): boolean {
  // Check if all critical and high priority questions are answered
  const criticalQuestions = session.questions.filter(
    (q) => q.priority === 'critical' || q.priority === 'high'
  );

  const answeredCritical = criticalQuestions.filter((q) =>
    session.responses.find((r) => r.questionId === q.id)
  );

  return answeredCritical.length === criticalQuestions.length;
}

/**
 * Get workflow result
 */
export function getWorkflowResult(session: HITLSession): HITLWorkflowResult {
  const nextQuestion = getNextQuestion(session);
  const allAnswered = nextQuestion === null;
  const canProceed = isSessionComplete(session);

  return {
    needsInput: !canProceed,
    nextQuestion: nextQuestion || undefined,
    allQuestionsAnswered: allAnswered,
    gatheredContext: {
      ...session.initialContext,
      ...session.gatheredContext,
    },
    canProceed,
  };
}

// ============================================================================
// Persistence Helpers
// ============================================================================

// In-memory storage for demo (replace with database in production)
const sessions = new Map<string, HITLSession>();

export function saveSession(session: HITLSession): void {
  sessions.set(session.id, session);
}

export function loadSession(sessionId: string): HITLSession | null {
  return sessions.get(sessionId) || null;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now || session.status !== 'active') {
      sessions.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}
