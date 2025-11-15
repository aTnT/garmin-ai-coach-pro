/**
 * Dynamic Plan Adaptation Engine
 *
 * Automatically adapts training plans based on real-time signals:
 * - Readiness trends
 * - Workout compliance
 * - Performance changes
 * - Life disruptions
 * - Race schedule updates
 *
 * Uses AI to generate intelligent, context-aware plan modifications.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Sport, WorkoutType } from '@prisma/client';
import { ReadinessScore } from '@/lib/calculations/readiness';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// Types
// ============================================================================

export interface AdaptationContext {
  planId: string;
  userId: string;
  sport: Sport;
  goal: string;
  raceDate?: Date;
  weeksRemaining?: number;

  // Current state
  currentReadiness: ReadinessScore;
  readinessHistory: Array<{
    date: Date;
    score: number;
    level: string;
  }>;
  recentWorkouts: Array<{
    date: Date;
    plannedType: WorkoutType;
    plannedDuration: number;
    actualType?: WorkoutType;
    actualDuration?: number;
    completed: boolean;
    quality?: number; // 0-100
  }>;

  // Plan structure
  upcomingWeeks: Array<{
    weekNumber: number;
    startDate: Date;
    workouts: Array<{
      date: Date;
      type: WorkoutType;
      duration: number;
      description: string;
    }>;
    targetLoad: number;
  }>;

  // User context
  constraints?: {
    equipment?: string[];
    location?: string;
    timeAvailability?: string;
    injuries?: string[];
  };
}

export interface AdaptationTrigger {
  id: string;
  type:
    | 'LOW_READINESS'
    | 'MISSED_WORKOUTS'
    | 'RACE_DATE_CHANGE'
    | 'ILLNESS_INJURY'
    | 'OVERTRAINING'
    | 'UNDERTRAINING'
    | 'PERFORMANCE_BREAKTHROUGH'
    | 'FATIGUE_ACCUMULATION'
    | 'TRAVEL_DISRUPTION'
    | 'GOAL_CHANGE'
    | 'EQUIPMENT_UNAVAILABLE'
    | 'WEATHER_CONSTRAINT'
    | 'LIFE_EVENT';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected: Date;
  description: string;
  metrics: Record<string, any>;
}

export interface AdaptationRecommendation {
  triggers: AdaptationTrigger[];
  confidence: number; // 0-100
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
  modifications: PlanModification[];
  alternatives?: string[];
  requiresApproval: boolean; // For critical changes
}

export interface PlanModification {
  type:
    | 'REDUCE_LOAD'
    | 'INCREASE_LOAD'
    | 'EXTEND_RECOVERY'
    | 'RESCHEDULE_WORKOUT'
    | 'CHANGE_INTENSITY'
    | 'SWAP_WORKOUT_TYPE'
    | 'INSERT_REST_DAY'
    | 'SHIFT_SCHEDULE'
    | 'REPERIODIZE';
  target: {
    weekNumber?: number;
    date?: Date;
    workoutId?: string;
  };
  change: {
    before: any;
    after: any;
  };
  rationale: string;
}

// ============================================================================
// Trigger Detection
// ============================================================================

/**
 * Analyze context and detect all active adaptation triggers
 */
export function detectTriggers(
  context: AdaptationContext
): AdaptationTrigger[] {
  const triggers: AdaptationTrigger[] = [];
  const now = new Date();

  // 1. LOW READINESS (3+ consecutive days below 50)
  const lowReadinessDays = context.readinessHistory
    .slice(0, 7)
    .filter((r) => r.score < 50).length;

  if (lowReadinessDays >= 3) {
    triggers.push({
      id: 'low_readiness',
      type: 'LOW_READINESS',
      severity: lowReadinessDays >= 5 ? 'critical' : 'high',
      detected: now,
      description: `Readiness below 50 for ${lowReadinessDays} days`,
      metrics: {
        days: lowReadinessDays,
        currentScore: context.currentReadiness.score,
        avgScore:
          context.readinessHistory.slice(0, 7).reduce((s, r) => s + r.score, 0) / 7,
      },
    });
  }

  // 2. MISSED WORKOUTS (2+ consecutive)
  const recentMissed = context.recentWorkouts
    .slice(0, 7)
    .filter((w) => !w.completed);

  if (recentMissed.length >= 2) {
    // Check if consecutive
    const sortedWorkouts = context.recentWorkouts
      .slice(0, 7)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    let consecutive = 0;
    for (const w of sortedWorkouts) {
      if (!w.completed) consecutive++;
      else break;
    }

    if (consecutive >= 2) {
      triggers.push({
        id: 'missed_workouts',
        type: 'MISSED_WORKOUTS',
        severity: consecutive >= 4 ? 'high' : 'medium',
        detected: now,
        description: `${consecutive} consecutive workouts missed`,
        metrics: {
          consecutive,
          total: recentMissed.length,
          lastCompleted: sortedWorkouts.find((w) => w.completed)?.date,
        },
      });
    }
  }

  // 3. OVERTRAINING (readiness declining + high load)
  const recentScores = context.readinessHistory.slice(0, 7).map((r) => r.score);
  const trend =
    recentScores.length >= 3
      ? recentScores.slice(0, 3).reduce((a, b) => a + b) / 3 -
        recentScores.slice(3, 6).reduce((a, b) => a + b) / 3
      : 0;

  if (trend < -10 && context.currentReadiness.score < 70) {
    triggers.push({
      id: 'overtraining',
      type: 'OVERTRAINING',
      severity: trend < -20 ? 'critical' : 'high',
      detected: now,
      description: `Readiness declining by ${Math.abs(trend).toFixed(0)} points`,
      metrics: {
        trend,
        currentScore: context.currentReadiness.score,
        acwrImpact: context.currentReadiness.factors.trainingLoad.impact,
      },
    });
  }

  // 4. UNDERTRAINING (consistently high readiness + low compliance)
  const avgReadiness =
    context.readinessHistory.slice(0, 14).reduce((s, r) => s + r.score, 0) / 14;
  const completionRate =
    context.recentWorkouts.filter((w) => w.completed).length /
    context.recentWorkouts.length;

  if (avgReadiness > 85 && completionRate < 0.5 && context.weeksRemaining && context.weeksRemaining > 4) {
    triggers.push({
      id: 'undertraining',
      type: 'UNDERTRAINING',
      severity: 'medium',
      detected: now,
      description: 'High readiness but low workout compliance',
      metrics: {
        avgReadiness,
        completionRate,
        weeksRemaining: context.weeksRemaining,
      },
    });
  }

  // 5. FATIGUE ACCUMULATION (consistent moderate readiness)
  const moderateCount = context.readinessHistory
    .slice(0, 14)
    .filter((r) => r.score >= 50 && r.score < 70).length;

  if (moderateCount >= 10) {
    triggers.push({
      id: 'fatigue_accumulation',
      type: 'FATIGUE_ACCUMULATION',
      severity: 'medium',
      detected: now,
      description: 'Prolonged moderate readiness - not recovering fully',
      metrics: {
        moderateDays: moderateCount,
        avgScore:
          context.readinessHistory.slice(0, 14).reduce((s, r) => s + r.score, 0) / 14,
      },
    });
  }

  // 6. ILLNESS/INJURY (very low readiness + specific factors)
  if (
    context.currentReadiness.score < 30 ||
    context.constraints?.injuries?.length
  ) {
    triggers.push({
      id: 'illness_injury',
      type: 'ILLNESS_INJURY',
      severity: 'critical',
      detected: now,
      description: context.constraints?.injuries?.length
        ? `Active injuries: ${context.constraints.injuries.join(', ')}`
        : 'Severe readiness drop - possible illness/injury',
      metrics: {
        readiness: context.currentReadiness.score,
        injuries: context.constraints?.injuries || [],
        hrvImpact: context.currentReadiness.factors.hrv.impact,
        restingHRImpact: context.currentReadiness.factors.restingHR.impact,
      },
    });
  }

  // 7. PERFORMANCE BREAKTHROUGH (improving trend + high quality)
  const recentQuality = context.recentWorkouts
    .filter((w) => w.completed && w.quality)
    .slice(0, 5);

  if (recentQuality.length >= 3) {
    const avgQuality =
      recentQuality.reduce((s, w) => s + (w.quality || 0), 0) / recentQuality.length;

    if (avgQuality >= 85 && trend > 5) {
      triggers.push({
        id: 'performance_breakthrough',
        type: 'PERFORMANCE_BREAKTHROUGH',
        severity: 'low',
        detected: now,
        description: 'Strong performance trend - ready for progression',
        metrics: {
          avgQuality,
          trend,
          consecutiveGood: recentQuality.length,
        },
      });
    }
  }

  // 8. RACE DATE CHANGE (external input - would be passed in constraints)
  // This would be triggered by user action, just showing structure

  // 9. TRAVEL DISRUPTION (inferred from location/equipment constraints)
  if (context.constraints?.location?.includes('travel')) {
    triggers.push({
      id: 'travel_disruption',
      type: 'TRAVEL_DISRUPTION',
      severity: 'medium',
      detected: now,
      description: 'Travel detected - may need workout adjustments',
      metrics: {
        location: context.constraints.location,
        equipment: context.constraints.equipment,
      },
    });
  }

  // 10. EQUIPMENT UNAVAILABLE
  if (context.constraints?.equipment?.includes('limited')) {
    triggers.push({
      id: 'equipment_unavailable',
      type: 'EQUIPMENT_UNAVAILABLE',
      severity: 'low',
      detected: now,
      description: 'Limited equipment access',
      metrics: {
        available: context.constraints.equipment,
      },
    });
  }

  return triggers;
}

// ============================================================================
// AI-Powered Adaptation Generation
// ============================================================================

/**
 * Generate intelligent plan adaptations using AI
 */
export async function generateAdaptation(
  context: AdaptationContext,
  triggers: AdaptationTrigger[]
): Promise<AdaptationRecommendation> {
  if (triggers.length === 0) {
    return {
      triggers: [],
      confidence: 100,
      urgency: 'low',
      reasoning: 'No adaptations needed - plan is on track',
      modifications: [],
      requiresApproval: false,
    };
  }

  const prompt = buildAdaptationPrompt(context, triggers);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      temperature: 0.5, // Lower temp for more conservative recommendations
      system: getAdaptationSystemPrompt(),
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

    const result = parseAdaptationResponse(content.text, triggers);
    return result;
  } catch (error: any) {
    console.error('[Adaptation Engine] Error:', error);

    // Fallback: Conservative rule-based adaptations
    return generateFallbackAdaptation(context, triggers);
  }
}

/**
 * System prompt for adaptation generation
 */
function getAdaptationSystemPrompt(): string {
  return `You are an expert endurance training coach specializing in adaptive periodization and athlete readiness management.

Your role is to analyze training plan performance and recommend intelligent adaptations when triggers indicate the plan needs adjustment.

**CORE PRINCIPLES:**

1. **Safety First**:
   - Never recommend pushing through illness, injury, or severe fatigue
   - Err on the side of conservative recovery when readiness is low
   - Preserve long-term athlete health over short-term gains

2. **Adaptation Hierarchy** (from most to least severe):
   - CRITICAL: Illness/injury → immediate rest/medical clearance
   - HIGH: Overtraining → reduce load 30-50%, extend recovery
   - MEDIUM: Missed workouts → reschedule key sessions, adjust volume
   - LOW: Performance breakthrough → cautious progression (+10-15%)

3. **Modification Types**:
   - **REDUCE_LOAD**: Decrease volume/intensity (illness, overtraining, fatigue)
   - **INCREASE_LOAD**: Progressive overload (breakthrough, undertraining)
   - **EXTEND_RECOVERY**: Add rest days, reduce intensity (low readiness)
   - **RESCHEDULE_WORKOUT**: Move sessions due to missed workouts
   - **CHANGE_INTENSITY**: Adjust zones without changing structure
   - **SWAP_WORKOUT_TYPE**: Replace hard session with recovery
   - **INSERT_REST_DAY**: Add unplanned rest
   - **SHIFT_SCHEDULE**: Accommodate travel/life events
   - **REPERIODIZE**: Major plan restructuring (race date change, injury)

4. **Readiness-Based Guidelines**:
   - Score < 30: Complete rest or very light active recovery only
   - Score 30-49: Easy recovery workouts, -50% volume
   - Score 50-69: Easy sessions, -30% volume, no intensity
   - Score 70-84: Moderate intensity OK, be cautious with volume
   - Score 85-100: Full training, can handle progression

5. **Missed Workout Strategy**:
   - 2 missed: Reschedule key session, drop low-priority workout
   - 3-4 missed: Simplify week, focus on 1-2 quality sessions
   - 5+ missed: Reset to recovery week, rebuild gradually

6. **Race Timeline Considerations**:
   - 12+ weeks: More flexibility, can take recovery time
   - 8-12 weeks: Balance fitness vs. freshness
   - 4-8 weeks: Peak phase - careful adjustments only
   - 1-4 weeks: Taper - prioritize freshness over fitness

OUTPUT FORMAT (JSON):
{
  "confidence": <0-100>,
  "urgency": "low|medium|high|critical",
  "reasoning": "Clear explanation of why adaptations are needed and your overall strategy",
  "modifications": [
    {
      "type": "REDUCE_LOAD|INCREASE_LOAD|...",
      "target": {
        "weekNumber": <number>,
        "date": "<ISO date>",
        "workoutId": "<optional>"
      },
      "change": {
        "before": {"description": "Original plan detail"},
        "after": {"description": "Modified plan detail"}
      },
      "rationale": "Specific reason for this change"
    }
  ],
  "alternatives": [
    "Alternative approach if athlete prefers different strategy",
    "Backup option if primary adaptation doesn't work"
  ],
  "requiresApproval": <boolean - true for critical changes like reperiodization>
}

**IMPORTANT:**
- Be specific with dates, workout types, and load adjustments
- Explain trade-offs clearly (e.g., "Sacrificing this week's volume to protect against injury")
- Provide alternatives when there are multiple valid approaches
- Flag critical changes that need athlete/coach approval
- Consider the athlete's goal and timeline in every recommendation`;
}

/**
 * Build detailed prompt with context and triggers
 */
function buildAdaptationPrompt(
  context: AdaptationContext,
  triggers: AdaptationTrigger[]
): string {
  const now = new Date();

  let prompt = `Analyze this training plan and recommend adaptations:

**ATHLETE CONTEXT:**
- Sport: ${context.sport}
- Goal: ${context.goal}
${context.raceDate ? `- Race Date: ${context.raceDate.toISOString().split('T')[0]} (${context.weeksRemaining} weeks away)` : ''}

**CURRENT READINESS:**
- Score: ${context.currentReadiness.score}/100 (${context.currentReadiness.level})
- Confidence: ${context.currentReadiness.confidence}% (${context.currentReadiness.confidenceLevel})
- Key Factors:
  - HRV: ${context.currentReadiness.factors.hrv.impact} (Score: ${context.currentReadiness.factors.hrv.score})
  - Training Load: ${context.currentReadiness.factors.trainingLoad.impact} (Score: ${context.currentReadiness.factors.trainingLoad.score})
  - Recovery: ${context.currentReadiness.factors.recovery.impact} (Score: ${context.currentReadiness.factors.recovery.score})
  - Sleep: ${context.currentReadiness.factors.sleep.impact} (Score: ${context.currentReadiness.factors.sleep.score})
  - Resting HR: ${context.currentReadiness.factors.restingHR.impact} (Score: ${context.currentReadiness.factors.restingHR.score})
  - Stress: ${context.currentReadiness.factors.stress.impact} (Score: ${context.currentReadiness.factors.stress.score})

**READINESS TREND (Last 14 days):**
${context.readinessHistory
  .slice(0, 14)
  .map(
    (r) =>
      `- ${r.date.toISOString().split('T')[0]}: ${r.score}/100 (${r.level})`
  )
  .join('\n')}

**RECENT WORKOUTS (Last 7 days):**
${context.recentWorkouts
  .slice(0, 7)
  .map((w) => {
    const status = w.completed
      ? `✓ Completed${w.quality ? ` (Quality: ${w.quality}/100)` : ''}`
      : '✗ Missed';
    return `- ${w.date.toISOString().split('T')[0]}: ${w.plannedType} ${w.plannedDuration}min - ${status}`;
  })
  .join('\n')}

**UPCOMING PLAN (Next 4 weeks):**
${context.upcomingWeeks
  .slice(0, 4)
  .map(
    (week) =>
      `Week ${week.weekNumber} (starts ${week.startDate.toISOString().split('T')[0]}, target load: ${week.targetLoad}):\n${week.workouts.map((w) => `  - ${w.date.toISOString().split('T')[0]}: ${w.type} ${w.duration}min - ${w.description}`).join('\n')}`
  )
  .join('\n\n')}

**DETECTED TRIGGERS (${triggers.length}):**
${triggers
  .map(
    (t) =>
      `- [${t.severity.toUpperCase()}] ${t.type}: ${t.description}\n  Metrics: ${JSON.stringify(t.metrics)}`
  )
  .join('\n')}

${context.constraints ? `\n**CONSTRAINTS:**\n${Object.entries(context.constraints).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join('\n')}` : ''}

Based on the above analysis:
1. Assess the severity and urgency of needed adaptations
2. Recommend specific modifications to the upcoming plan
3. Explain your reasoning and trade-offs
4. Provide alternatives if multiple approaches are valid
5. Flag if changes need athlete/coach approval

Return your response as valid JSON matching the specified format.`;

  return prompt;
}

/**
 * Parse AI response
 */
function parseAdaptationResponse(
  responseText: string,
  triggers: AdaptationTrigger[]
): AdaptationRecommendation {
  try {
    // Extract JSON from markdown if present
    let jsonText = responseText.trim();
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Validate and structure
    return {
      triggers,
      confidence: parsed.confidence || 75,
      urgency: parsed.urgency || 'medium',
      reasoning: parsed.reasoning || 'Adaptations recommended based on detected triggers',
      modifications: parsed.modifications || [],
      alternatives: parsed.alternatives,
      requiresApproval: parsed.requiresApproval || false,
    };
  } catch (error: any) {
    console.error('[Adaptation Parser] Error:', error);
    console.error('[Adaptation Parser] Response:', responseText);

    // Fallback
    return generateFallbackAdaptation(
      { triggers } as any,
      triggers
    );
  }
}

/**
 * Generate conservative rule-based adaptations if AI fails
 */
function generateFallbackAdaptation(
  context: AdaptationContext | { triggers: AdaptationTrigger[] },
  triggers: AdaptationTrigger[]
): AdaptationRecommendation {
  const modifications: PlanModification[] = [];
  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let requiresApproval = false;

  // Find highest severity trigger
  const maxSeverity = triggers.reduce((max, t) => {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[t.severity] > levels[max] ? t.severity : max;
  }, 'low' as 'low' | 'medium' | 'high' | 'critical');

  urgency = maxSeverity;

  // Critical triggers → immediate rest
  if (triggers.some((t) => t.type === 'ILLNESS_INJURY')) {
    modifications.push({
      type: 'EXTEND_RECOVERY',
      target: { weekNumber: 1 },
      change: {
        before: { plan: 'Current week training' },
        after: { plan: 'Complete rest or very light recovery only' },
      },
      rationale:
        'Illness or injury detected - prioritizing recovery and preventing further damage',
    });
    requiresApproval = true;
  }

  // Overtraining → reduce load
  if (triggers.some((t) => t.type === 'OVERTRAINING')) {
    modifications.push({
      type: 'REDUCE_LOAD',
      target: { weekNumber: 1 },
      change: {
        before: { load: '100%' },
        after: { load: '60-70%' },
      },
      rationale:
        'Overtraining signals detected - reducing load to facilitate recovery',
    });
  }

  // Low readiness → extend recovery
  if (triggers.some((t) => t.type === 'LOW_READINESS')) {
    modifications.push({
      type: 'CHANGE_INTENSITY',
      target: { weekNumber: 1 },
      change: {
        before: { intensity: 'As planned' },
        after: { intensity: 'Easy/recovery only' },
      },
      rationale: 'Low readiness - switching to easy sessions until recovery improves',
    });
  }

  // Missed workouts → reschedule
  if (triggers.some((t) => t.type === 'MISSED_WORKOUTS')) {
    modifications.push({
      type: 'RESCHEDULE_WORKOUT',
      target: { weekNumber: 1 },
      change: {
        before: { plan: 'Current week schedule' },
        after: { plan: 'Reschedule key sessions, drop low-priority workouts' },
      },
      rationale: 'Multiple missed workouts - simplifying and rescheduling',
    });
  }

  return {
    triggers,
    confidence: 60, // Lower confidence for fallback
    urgency,
    reasoning: `Fallback adaptations generated due to AI error. ${triggers.length} trigger(s) detected requiring plan adjustments. Conservative approach applied.`,
    modifications,
    alternatives: [
      'Wait 2-3 days and reassess if conditions improve',
      'Consult with coach for personalized guidance',
    ],
    requiresApproval,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Main entry point: Analyze plan and generate adaptations
 */
export async function analyzeAndAdapt(
  context: AdaptationContext
): Promise<AdaptationRecommendation> {
  // 1. Detect triggers
  const triggers = detectTriggers(context);

  // 2. If no triggers, return success
  if (triggers.length === 0) {
    return {
      triggers: [],
      confidence: 100,
      urgency: 'low',
      reasoning: 'Plan is progressing well - no adaptations needed at this time',
      modifications: [],
      requiresApproval: false,
    };
  }

  // 3. Generate AI-powered adaptations
  const recommendation = await generateAdaptation(context, triggers);

  return recommendation;
}
