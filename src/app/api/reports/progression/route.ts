/**
 * Performance Progression Report API
 *
 * GET /api/reports/progression
 * Compares performance between two time periods:
 * - FTP progression
 * - Power curve improvements
 * - Volume changes
 * - Consistency metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generateProgressionReport, exportToJSON, type ReportingActivity, type ReportingMetric } from '@/lib/reporting/advanced-reports';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const currentDaysParam = searchParams.get('currentDays');
    const comparisonDaysParam = searchParams.get('comparisonDays');
    const formatParam = searchParams.get('format');

    const currentDays = currentDaysParam ? parseInt(currentDaysParam, 10) : 14;
    const comparisonDays = comparisonDaysParam ? parseInt(comparisonDaysParam, 10) : 14;
    const format = formatParam || 'json';

    if (currentDays < 1 || currentDays > 365 || comparisonDays < 1 || comparisonDays > 365) {
      return NextResponse.json({ error: 'Days must be between 1 and 365' }, { status: 400 });
    }

    // Calculate periods
    const currentEnd = new Date();
    const currentStart = new Date();
    currentStart.setDate(currentStart.getDate() - currentDays);

    const comparisonEnd = new Date(currentStart);
    comparisonEnd.setDate(comparisonEnd.getDate() - 1); // Day before current period starts
    const comparisonStart = new Date(comparisonEnd);
    comparisonStart.setDate(comparisonStart.getDate() - comparisonDays);

    // Fetch all activities for both periods
    const activities = await prisma.workout.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: comparisonStart,
          lte: currentEnd,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Fetch all metrics for both periods
    const metrics = await prisma.healthMetric.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: comparisonStart,
          lte: currentEnd,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Transform to reporting format
    const reportingActivities: ReportingActivity[] = activities.map((a) => ({
      id: a.id,
      date: a.date,
      sport: a.sport,
      duration: a.duration,
      distance: a.distance || undefined,
      avgPower: a.avgPower || undefined,
      avgHR: a.avgHR || undefined,
      tss: a.tss || undefined,
      powerData: undefined,
    }));

    const reportingMetrics: ReportingMetric[] = metrics.map((m) => ({
      date: m.date,
      type: m.type,
      value: m.value,
      unit: m.unit || undefined,
    }));

    // Generate progression report
    const report = await generateProgressionReport(
      reportingActivities,
      reportingMetrics,
      { start: currentStart, end: currentEnd },
      { start: comparisonStart, end: comparisonEnd }
    );

    // Return in requested format
    if (format === 'json') {
      return NextResponse.json(report);
    } else if (format === 'raw-json') {
      return new NextResponse(exportToJSON(report), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="progression-report-${Date.now()}.json"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unsupported format. Use json or raw-json' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Progression Report API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate progression report', details: error.message }, { status: 500 });
  }
}
