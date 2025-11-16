/**
 * Race Taper Plan API
 *
 * GET /api/races/[id]/taper-plan - Generate taper plan for race
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generateTaperPlan, generateRacePeakPlan, type Race as RaceCalendarRace } from '@/lib/training/race-calendar';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await rateLimit(session.user.id);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const race = await prisma.race.findUnique({
      where: { id: params.id },
    });

    if (!race) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    if (race.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const baselineWeeklyVolume = parseInt(searchParams.get('weeklyVolume') || '300');
    const weeksAvailable = parseInt(searchParams.get('weeks') || '12');
    const planType = searchParams.get('type') || 'taper'; // 'taper' or 'peak'

    // Map database race distance to race-calendar enum
    const distanceMap: Record<string, string> = {
      'FIVE_K': '5K',
      'TEN_K': '10K',
      'HALF_MARATHON': 'HALF_MARATHON',
      'MARATHON': 'MARATHON',
      'ULTRA': 'ULTRA',
      'SPRINT': 'SPRINT',
      'OLYMPIC': 'OLYMPIC',
      'HALF_IM': 'HALF_IM',
      'IRONMAN': 'IRONMAN',
      'CUSTOM': 'CUSTOM',
    };

    // Convert database race to race-calendar format
    const raceCalendarFormat: RaceCalendarRace = {
      id: race.id,
      name: race.name,
      date: race.date,
      sport: race.sport as any,
      distance: distanceMap[race.distance] as any,
      customDistance: race.customDistance || undefined,
      priority: race.priority as any,
      location: race.location || undefined,
      notes: race.notes || undefined,
      goalTime: race.goalTime || undefined,
    };

    if (planType === 'peak') {
      // Generate full peak plan (build + peak + taper)
      const peakPlan = generateRacePeakPlan(
        raceCalendarFormat,
        baselineWeeklyVolume,
        weeksAvailable
      );

      return NextResponse.json({
        type: 'peak',
        race: raceCalendarFormat,
        plan: peakPlan,
      });
    } else {
      // Generate taper plan only
      const taperPlan = generateTaperPlan(raceCalendarFormat, baselineWeeklyVolume);

      return NextResponse.json({
        type: 'taper',
        race: raceCalendarFormat,
        plan: taperPlan,
      });
    }
  } catch (error: any) {
    console.error('[Race Taper Plan API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate taper plan', details: error.message },
      { status: 500 }
    );
  }
}
