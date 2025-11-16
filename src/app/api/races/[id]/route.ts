/**
 * Individual Race API
 *
 * GET /api/races/[id] - Get race by ID
 * PATCH /api/races/[id] - Update race
 * DELETE /api/races/[id] - Delete race
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
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

    const race = await prisma.race.findUnique({
      where: { id: params.id },
    });

    if (!race) {
      return NextResponse.json({ error: 'Race not found' }, { status: 404 });
    }

    if (race.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ race });
  } catch (error: any) {
    console.error('[Race API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch race', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await req.json();

    // Update race
    const updatedRace = await prisma.race.update({
      where: { id: params.id },
      data: {
        name: body.name,
        date: body.date ? new Date(body.date) : undefined,
        sport: body.sport,
        distance: body.distance,
        customDistance: body.customDistance,
        priority: body.priority,
        location: body.location,
        notes: body.notes,
        goalTime: body.goalTime,
        resultTime: body.resultTime,
        completed: body.completed,
      },
    });

    return NextResponse.json({ race: updatedRace });
  } catch (error: any) {
    console.error('[Race API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update race', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    await prisma.race.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('[Race API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete race', details: error.message },
      { status: 500 }
    );
  }
}
