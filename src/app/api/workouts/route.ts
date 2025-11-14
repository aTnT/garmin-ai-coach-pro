import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport');
    const type = searchParams.get('type');
    const completed = searchParams.get('completed');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {
      userId: session.user.id,
    };

    if (sport) where.sport = sport;
    if (type) where.type = type;
    if (completed !== null) where.completed = completed === 'true';
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const workouts = await prisma.workout.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ workouts });
  } catch (error) {
    console.error('Error fetching workouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workouts' },
      { status: 500 }
    );
  }
}
