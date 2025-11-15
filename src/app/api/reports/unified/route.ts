/**
 * Unified Training Report API
 *
 * GET /api/reports/unified
 * Generates comprehensive training report combining:
 * - Power curve analysis
 * - Historical trends
 * - Readiness tracking
 * - Training load analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generateUnifiedReport, exportToJSON, type ReportingActivity, type ReportingMetric } from '@/lib/reporting/advanced-reports';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const daysParam = searchParams.get('days');
    const formatParam = searchParams.get('format');
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    const format = formatParam || 'json';

    if (days < 1 || days > 365) {
      return NextResponse.json({ error: 'Days must be between 1 and 365' }, { status: 400 });
    }

    // Calculate period
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    // Fetch activities
    const activities = await prisma.workout.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Fetch metrics
    const metrics = await prisma.healthMetric.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: start,
          lte: end,
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
      // Note: powerData would need to be fetched separately if stored
      powerData: undefined,
    }));

    const reportingMetrics: ReportingMetric[] = metrics.map((m) => ({
      date: m.date,
      type: m.type,
      value: m.value,
      unit: m.unit || undefined,
    }));

    // Generate report
    const report = await generateUnifiedReport(reportingActivities, reportingMetrics, { start, end });

    // Return in requested format
    if (format === 'json') {
      return NextResponse.json(report);
    } else if (format === 'raw-json') {
      return new NextResponse(exportToJSON(report), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="unified-report-${Date.now()}.json"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unsupported format. Use json or raw-json' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Unified Report API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate report', details: error.message }, { status: 500 });
  }
}
