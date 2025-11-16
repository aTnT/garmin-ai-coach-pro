/**
 * Race Calendar API
 *
 * GET /api/races - List all races for user
 * POST /api/races - Create new race
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const upcoming = searchParams.get('upcoming') === 'true';
    const priority = searchParams.get('priority') as 'A' | 'B' | 'C' | null;
    const sport = searchParams.get('sport');

    // Build where clause
    const where: any = {
      userId: session.user.id,
    };

    if (upcoming) {
      where.date = {
        gte: new Date(),
      };
    }

    if (priority) {
      where.priority = priority;
    }

    if (sport) {
      where.sport = sport;
    }

    // Fetch races
    const races = await prisma.race.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ races });
  } catch (error: any) {
    console.error('[Races API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch races', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();

    // Validate required fields
    const { name, date, sport, distance, priority = 'B' } = body;

    if (!name || !date || !sport || !distance) {
      return NextResponse.json(
        { error: 'Missing required fields: name, date, sport, distance' },
        { status: 400 }
      );
    }

    // Create race
    const race = await prisma.race.create({
      data: {
        userId: session.user.id,
        name,
        date: new Date(date),
        sport,
        distance,
        customDistance: body.customDistance,
        priority,
        location: body.location,
        notes: body.notes,
        goalTime: body.goalTime,
      },
    });

    return NextResponse.json({ race }, { status: 201 });
  } catch (error: any) {
    console.error('[Races API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create race', details: error.message },
      { status: 500 }
    );
  }
}
