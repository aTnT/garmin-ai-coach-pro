import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateWorkout } from '@/lib/calculations/workouts';
import { generateAIWorkout, AIWorkoutRequest } from '@/lib/calculations/ai-workout-generator';
import { calculateReadinessScore } from '@/lib/calculations/readiness';
import { Sport, WorkoutType } from '@prisma/client';
import { subDays } from 'date-fns';
import { logAIOperation } from '@/lib/audit-log';

const generateWorkoutSchema = z.object({
  sport: z.enum(['RUNNING', 'CYCLING', 'SWIMMING', 'TRIATHLON', 'OTHER']),
  type: z.enum(['EASY', 'TEMPO', 'INTERVAL', 'LONG', 'RECOVERY', 'RACE', 'STRENGTH']).optional(),
  duration: z.number().min(10).max(600),
  goals: z.string().optional(),
  equipment: z.array(z.string()).optional(),
  location: z.enum(['indoor', 'outdoor', 'either']).optional(),
  preferredIntensity: z.enum(['low', 'medium', 'high']).optional(),
  useAI: z.boolean().optional(), // Force AI or template mode
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedBody = generateWorkoutSchema.parse(body);
    const {
      sport,
      type,
      duration,
      goals,
      equipment,
      location,
      preferredIntensity,
      useAI,
    } = validatedBody;

    // Check subscription tier
    let subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId: session.user.id,
          tier: 'FREE',
          status: 'ACTIVE',
        },
      });
    }

    // Determine which generation mode to use
    // AI generation for PREMIUM/TEAM tiers (or if ENABLE_AI_WORKOUTS_FOR_ALL is set)
    const shouldUseAI =
      useAI !== undefined
        ? useAI
        : subscription.tier !== 'FREE' || process.env.ENABLE_AI_WORKOUTS_FOR_ALL === 'true';

    let workoutStructure;
    let reasoning: string | undefined;
    let adaptations: string[] | undefined;

    if (shouldUseAI) {
      // AI-Powered Generation
      console.log('[Workout Gen] Using AI generation for', sport);

      // Get readiness score
      const recentMetrics = await prisma.metric.findMany({
        where: {
          userId: session.user.id,
          date: { gte: subDays(new Date(), 30) },
        },
        orderBy: { date: 'desc' },
        take: 100,
      });

      const readinessScore = calculateReadinessScore(recentMetrics);

      // Get recent workouts
      const recentWorkouts = await prisma.workout.findMany({
        where: {
          userId: session.user.id,
          date: { gte: subDays(new Date(), 7) },
        },
        orderBy: { date: 'desc' },
        take: 10,
      });

      // Get active training plans for goals
      const activePlans = await prisma.trainingPlan.findMany({
        where: {
          userId: session.user.id,
          status: 'ACTIVE',
        },
        take: 1,
      });

      const aiRequest: AIWorkoutRequest = {
        userId: session.user.id,
        sport: sport as Sport,
        goals: goals || activePlans[0]?.goal || undefined,
        availableTime: duration,
        equipment,
        location,
        readinessScore,
        recentWorkouts: recentWorkouts.map((w) => ({
          date: w.date,
          sport: w.sport,
          type: w.type,
          duration: w.duration || 0,
          completed: w.completed,
        })),
        preferredIntensity,
      };

      try {
        const aiResponse = await generateAIWorkout(aiRequest);
        workoutStructure = aiResponse.workout;
        reasoning = aiResponse.reasoning;
        adaptations = aiResponse.adaptations;

        // Log AI operation for cost tracking
        await logAIOperation({
          userId: session.user.id,
          action: 'WORKOUT_GENERATE',
          req,
        });
      } catch (aiError: any) {
        console.error('[Workout Gen] AI generation failed, falling back to template:', aiError);
        // Fallback to template if AI fails
        workoutStructure = generateWorkout({
          sport: sport as Sport,
          type: (type as WorkoutType) || 'EASY',
          duration,
        });
        reasoning = `AI generation failed, using template. Readiness: ${readinessScore.score}/100 (${readinessScore.level})`;
      }
    } else {
      // Template-Based Generation (FREE tier)
      console.log('[Workout Gen] Using template generation for', sport);
      workoutStructure = generateWorkout({
        sport: sport as Sport,
        type: (type as WorkoutType) || 'EASY',
        duration,
      });
      reasoning = 'Template-based workout. Upgrade to Premium for AI-powered, readiness-adapted workouts!';
    }

    // Save to database
    const workout = await prisma.workout.create({
      data: {
        userId: session.user.id,
        date: new Date(),
        sport: sport as Sport,
        type: workoutStructure.type as WorkoutType,
        name: workoutStructure.name,
        duration: workoutStructure.totalDuration,
        distance: workoutStructure.estimatedDistance,
        structure: workoutStructure as any,
        completed: false,
      },
    });

    return NextResponse.json({
      workout,
      structure: workoutStructure,
      aiGenerated: shouldUseAI,
      reasoning,
      adaptations,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error generating workout:', error);
    return NextResponse.json(
      { error: 'Failed to generate workout' },
      { status: 500 }
    );
  }
}
