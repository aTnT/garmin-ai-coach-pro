import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateTrainingPlan } from '@/lib/calculations/plans';
import { Sport } from '@prisma/client';

const generatePlanSchema = z.object({
  sport: z.enum(['RUNNING', 'CYCLING', 'SWIMMING', 'TRIATHLON', 'OTHER']),
  raceDate: z.string().datetime(),
  currentFitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().min(3).max(7),
  hoursPerWeek: z.number().min(2).max(20),
  goal: z.enum(['finish', 'improve', 'compete']),
  raceDistance: z.number().optional(),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const params = generatePlanSchema.parse(body);

    // Generate the training plan
    const plan = generateTrainingPlan({
      sport: params.sport as Sport,
      raceDate: new Date(params.raceDate),
      currentFitnessLevel: params.currentFitnessLevel,
      daysPerWeek: params.daysPerWeek,
      hoursPerWeek: params.hoursPerWeek,
      goal: params.goal,
      raceDistance: params.raceDistance,
    });

    // Save to database
    const savedPlan = await prisma.trainingPlan.create({
      data: {
        userId: session.user.id,
        name: params.name || plan.name,
        description: plan.description,
        sport: params.sport as Sport,
        goal: plan.goal,
        startDate: plan.startDate,
        endDate: plan.raceDate,
        weeks: plan.totalWeeks,
        planData: plan as any,
        status: 'ACTIVE',
      },
    });

    // Generate and save workouts for the plan
    const workouts = [];
    for (const week of plan.weeks) {
      for (const workout of week.workouts) {
        workouts.push({
          userId: session.user.id,
          planId: savedPlan.id,
          date: workout.date,
          sport: params.sport as Sport,
          type: workout.type,
          name: workout.name,
          duration: workout.duration,
          distance: workout.distance,
          structure: {
            description: workout.description,
            intensity: workout.intensity,
            weekNumber: week.weekNumber,
            phase: week.phase,
          },
          completed: false,
        });
      }
    }

    await prisma.workout.createMany({
      data: workouts,
    });

    return NextResponse.json({
      plan: savedPlan,
      summary: plan.summary,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate training plan' },
      { status: 500 }
    );
  }
}
