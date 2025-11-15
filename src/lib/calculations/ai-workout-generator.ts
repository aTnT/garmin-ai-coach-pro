/**
 * AI-Powered Workout Generator
 *
 * Generates dynamic, personalized workouts using Claude AI based on:
 * - Current readiness score and factors
 * - User goals and constraints
 * - Training history and progress
 * - Sport-specific requirements
 *
 * This replaces template-based generation with intelligent, adaptive workouts.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Sport, WorkoutType } from '@prisma/client';
import { ReadinessScore } from './readiness';
import { WorkoutStructure, WorkoutSegment } from './workouts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface AIWorkoutRequest {
  // User context
  userId: string;
  sport: Sport;
  goals?: string; // e.g., "Marathon in 12 weeks", "Improve 5K time"

  // Constraints
  availableTime: number; // minutes
  equipment?: string[]; // e.g., ["treadmill"], ["bike"], ["pool"]
  location?: 'indoor' | 'outdoor' | 'either';

  // Current state
  readinessScore: ReadinessScore;
  recentWorkouts?: Array<{
    date: Date;
    sport: Sport;
    type: WorkoutType;
    duration: number;
    completed: boolean;
  }>;

  // Training phase
  trainingPhase?: 'base' | 'build' | 'peak' | 'taper' | 'recovery';
  weeksUntilRace?: number;

  // User preferences
  preferredIntensity?: 'low' | 'medium' | 'high';
  avoidWorkoutTypes?: WorkoutType[];
}

export interface AIWorkoutResponse {
  workout: WorkoutStructure;
  reasoning: string;
  adaptations: string[];
  alternatives?: string[];
}

/**
 * Generate a personalized workout using AI
 */
export async function generateAIWorkout(
  request: AIWorkoutRequest
): Promise<AIWorkoutResponse> {
  const prompt = buildWorkoutPrompt(request);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0.7,
      system: getWorkoutGeneratorSystemPrompt(),
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

    // Parse the structured JSON response
    const result = parseAIWorkoutResponse(content.text, request);

    return result;
  } catch (error: any) {
    console.error('[AI Workout Generator] Error:', error);
    throw new Error(`Failed to generate AI workout: ${error.message}`);
  }
}

/**
 * System prompt for workout generation
 */
function getWorkoutGeneratorSystemPrompt(): string {
  return `You are an expert endurance training coach specialized in creating personalized, science-based workouts for runners, cyclists, swimmers, and triathletes.

Your role is to generate structured workout plans that:
1. **Adapt to readiness**: Scale intensity based on current recovery state
2. **Align with goals**: Design sessions that progress toward the athlete's objectives
3. **Respect constraints**: Work within available time, equipment, and location
4. **Follow training principles**: Use proper periodization, progressive overload, and recovery

CRITICAL GUIDELINES:
- **Readiness-Based Intensity Scaling**:
  - Score 85-100 (Excellent): Full intensity, can handle hard workouts
  - Score 70-84 (Good): Moderate intensity, tempo/steady work
  - Score 50-69 (Moderate): Easy/recovery, reduce volume by 20-30%
  - Score 30-49 (Low): Active recovery only, cut volume by 50%
  - Score 0-29 (Very Low): Rest day or very light movement

- **Specific Readiness Factors**:
  - Low HRV → reduce intensity, focus on aerobic work
  - High training load (ACWR > 1.3) → recovery session
  - Poor sleep → shorten duration, easier intensity
  - Elevated resting HR → recovery or rest
  - High stress → gentle workout or rest
  - Declining workout quality → deload week

- **Sport-Specific Structure**:
  - Running: Warmup (10-15min) → Main set → Cooldown (10min)
  - Cycling: Warmup (15-20min) → Main set → Cooldown (10-15min)
  - Swimming: Warmup (200-400m) → Main set → Cooldown (200m)

- **Workout Types**:
  - EASY: Zone 2, conversational, aerobic base building
  - TEMPO: Zone 4, lactate threshold, sustained hard effort
  - INTERVAL: Zone 5, VO2max, repeated hard efforts with recovery
  - LONG: Zone 2, extended duration, endurance building
  - RECOVERY: Zone 1, active recovery, very easy

OUTPUT FORMAT (JSON):
{
  "workout": {
    "name": "Descriptive name",
    "description": "Purpose and expected outcomes",
    "sport": "RUNNING|CYCLING|SWIMMING|TRIATHLON",
    "type": "EASY|TEMPO|INTERVAL|LONG|RECOVERY",
    "totalDuration": <minutes>,
    "estimatedDistance": <kilometers>,
    "segments": [
      {
        "order": 1,
        "name": "Segment name",
        "duration": <minutes>,
        "intensity": "warmup|easy|moderate|hard|max|recovery",
        "heartRateZone": <1-5>,
        "paceGuidance": "Specific pace/effort description",
        "powerGuidance": "Power zones for cycling (optional)",
        "description": "Detailed instructions"
      }
    ],
    "notes": [
      "Key coaching points",
      "What to focus on",
      "Success criteria"
    ]
  },
  "reasoning": "Explain why this workout was chosen based on readiness, goals, and training phase",
  "adaptations": [
    "How the workout was adapted from standard template",
    "Specific modifications made for current readiness",
    "Any intensity reductions or volume adjustments"
  ],
  "alternatives": [
    "Alternative workout if athlete feels better/worse",
    "Backup options if conditions change"
  ]
}

Be specific with numbers, paces, and intensities. Provide actionable, clear instructions.`;
}

/**
 * Build the user prompt with all context
 */
function buildWorkoutPrompt(request: AIWorkoutRequest): string {
  const {
    sport,
    goals,
    availableTime,
    equipment,
    location,
    readinessScore,
    recentWorkouts,
    trainingPhase,
    weeksUntilRace,
    preferredIntensity,
    avoidWorkoutTypes,
  } = request;

  let prompt = `Generate a personalized workout for the following athlete:

**SPORT**: ${sport}
${goals ? `**GOAL**: ${goals}` : ''}
**AVAILABLE TIME**: ${availableTime} minutes
${equipment?.length ? `**EQUIPMENT**: ${equipment.join(', ')}` : ''}
${location ? `**LOCATION**: ${location}` : ''}

**CURRENT READINESS** (Score: ${readinessScore.score}/100, Level: ${readinessScore.level}, Confidence: ${readinessScore.confidenceLevel}):
${readinessScore.explanation}

**Readiness Factors**:
- HRV: ${readinessScore.factors.hrv.impact} (Score: ${readinessScore.factors.hrv.score}, Has Data: ${readinessScore.factors.hrv.hasData})
- Training Load: ${readinessScore.factors.trainingLoad.impact} (Score: ${readinessScore.factors.trainingLoad.score}, Has Data: ${readinessScore.factors.trainingLoad.hasData})
- Recovery: ${readinessScore.factors.recovery.impact} (Score: ${readinessScore.factors.recovery.score}, Has Data: ${readinessScore.factors.recovery.hasData})
- Sleep: ${readinessScore.factors.sleep.impact} (Score: ${readinessScore.factors.sleep.score}, Has Data: ${readinessScore.factors.sleep.hasData})
- Resting HR: ${readinessScore.factors.restingHR.impact} (Score: ${readinessScore.factors.restingHR.score}, Has Data: ${readinessScore.factors.restingHR.hasData})
- Stress: ${readinessScore.factors.stress.impact} (Score: ${readinessScore.factors.stress.score}, Has Data: ${readinessScore.factors.stress.hasData})
- Workout Quality: ${readinessScore.factors.workoutQuality.impact} (Score: ${readinessScore.factors.workoutQuality.score}, Has Data: ${readinessScore.factors.workoutQuality.hasData})

**Confidence Analysis**:
- Overall Confidence: ${readinessScore.confidence}% (${readinessScore.confidenceLevel})
- Data Completeness: ${readinessScore.confidenceFactors.dataCompleteness.toFixed(0)}%
- Data Recency: ${readinessScore.confidenceFactors.dataRecency.toFixed(0)}%
- Baseline Quality: ${readinessScore.confidenceFactors.baselineQuality.toFixed(0)}%
- Signal Agreement: ${readinessScore.confidenceFactors.signalAgreement.toFixed(0)}%
`;

  if (recentWorkouts && recentWorkouts.length > 0) {
    prompt += `\n**RECENT WORKOUTS (Last 7 days)**:\n`;
    recentWorkouts.slice(0, 7).forEach((w) => {
      prompt += `- ${w.date.toISOString().split('T')[0]}: ${w.sport} ${w.type} - ${w.duration}min ${w.completed ? '✓' : '✗'}\n`;
    });
  }

  if (trainingPhase) {
    prompt += `\n**TRAINING PHASE**: ${trainingPhase}`;
  }

  if (weeksUntilRace) {
    prompt += `\n**WEEKS UNTIL RACE**: ${weeksUntilRace}`;
  }

  if (preferredIntensity) {
    prompt += `\n**PREFERRED INTENSITY**: ${preferredIntensity}`;
  }

  if (avoidWorkoutTypes && avoidWorkoutTypes.length > 0) {
    prompt += `\n**AVOID**: ${avoidWorkoutTypes.join(', ')} workouts`;
  }

  prompt += `\n\nBased on the above information, generate an optimal workout that:
1. Adapts intensity to current readiness (this is CRITICAL - if readiness is low, recommend recovery or rest)
2. Aligns with the athlete's goals and training phase
3. Fits within the available time
4. Considers recent workout history to avoid overtraining
5. Provides clear, actionable instructions

Return your response as valid JSON matching the specified format.`;

  return prompt;
}

/**
 * Parse AI response and convert to structured format
 */
function parseAIWorkoutResponse(
  responseText: string,
  request: AIWorkoutRequest
): AIWorkoutResponse {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonText = responseText.trim();
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Validate required fields
    if (!parsed.workout || !parsed.reasoning) {
      throw new Error('Missing required fields in AI response');
    }

    // Ensure workout has required fields
    const workout: WorkoutStructure = {
      name: parsed.workout.name || `${request.sport} Workout`,
      description: parsed.workout.description || '',
      sport: parsed.workout.sport || request.sport,
      type: parsed.workout.type || 'EASY',
      totalDuration: parsed.workout.totalDuration || request.availableTime,
      estimatedDistance: parsed.workout.estimatedDistance,
      segments: parsed.workout.segments || [],
      notes: parsed.workout.notes || [],
    };

    return {
      workout,
      reasoning: parsed.reasoning,
      adaptations: parsed.adaptations || [],
      alternatives: parsed.alternatives,
    };
  } catch (error: any) {
    console.error('[AI Workout Parser] Error parsing response:', error);
    console.error('[AI Workout Parser] Response text:', responseText);

    // Fallback: create a basic workout based on readiness
    return createFallbackWorkout(request);
  }
}

/**
 * Create a fallback workout if AI parsing fails
 */
function createFallbackWorkout(request: AIWorkoutRequest): AIWorkoutResponse {
  const { sport, availableTime, readinessScore } = request;

  // Determine workout type based on readiness
  let type: WorkoutType = 'EASY';
  let intensity: 'warmup' | 'easy' | 'moderate' | 'hard' | 'max' | 'recovery' = 'easy';
  let adjustedDuration = availableTime;

  if (readinessScore.score >= 85) {
    type = 'TEMPO';
    intensity = 'moderate';
  } else if (readinessScore.score >= 70) {
    type = 'EASY';
    intensity = 'easy';
  } else if (readinessScore.score >= 50) {
    type = 'EASY';
    intensity = 'easy';
    adjustedDuration = Math.round(availableTime * 0.7); // Reduce duration by 30%
  } else {
    type = 'RECOVERY';
    intensity = 'recovery';
    adjustedDuration = Math.round(availableTime * 0.5); // Reduce duration by 50%
  }

  const workout: WorkoutStructure = {
    name: `Adaptive ${type} ${sport}`,
    description: `Readiness-adapted workout (Score: ${readinessScore.score}/100)`,
    sport,
    type,
    totalDuration: adjustedDuration,
    segments: [
      {
        order: 1,
        name: 'Main Effort',
        duration: adjustedDuration,
        intensity,
        heartRateZone: intensity === 'recovery' ? 1 : 2,
        paceGuidance: 'Comfortable pace appropriate for your current readiness',
        description: 'Maintain steady effort throughout',
      },
    ],
    notes: [
      `Adjusted based on readiness score: ${readinessScore.score}/100`,
      readinessScore.explanation,
      'Listen to your body and adjust as needed',
    ],
  };

  return {
    workout,
    reasoning: `Fallback workout generated due to AI parsing error. Intensity scaled to readiness level (${readinessScore.level}).`,
    adaptations: [
      `Duration adjusted from ${availableTime} to ${adjustedDuration} minutes`,
      `Intensity set to ${intensity} based on readiness score`,
    ],
    alternatives: [],
  };
}
