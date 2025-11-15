/**
 * Readiness History Report API
 *
 * GET /api/reports/readiness
 * Generates daily readiness scores over a period:
 * - Daily readiness scores
 * - Trend analysis
 * - Factor breakdown
 * - Recovery recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { generateReadinessReport, exportToJSON, exportToCSV, type ReportingActivity, type ReportingMetric } from '@/lib/reporting/advanced-reports';

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
    const days = daysParam ? parseInt(daysParam, 10) : 14;
    const format = formatParam || 'json';

    if (days < 1 || days > 365) {
      return NextResponse.json({ error: 'Days must be between 1 and 365' }, { status: 400 });
    }

    // Calculate period
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    // Fetch metrics (need 30 days of data for readiness calculation)
    const metricsStart = new Date(start);
    metricsStart.setDate(metricsStart.getDate() - 30);

    const metrics = await prisma.healthMetric.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: metricsStart,
          lte: end,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Fetch activities (need 30 days for training load calculation)
    const activities = await prisma.workout.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: metricsStart,
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
      powerData: undefined,
    }));

    const reportingMetrics: ReportingMetric[] = metrics.map((m) => ({
      date: m.date,
      type: m.type,
      value: m.value,
      unit: m.unit || undefined,
    }));

    // Generate readiness history report
    const report = await generateReadinessReport(reportingMetrics, reportingActivities, { start, end });

    // Return in requested format
    if (format === 'json') {
      return NextResponse.json(report);
    } else if (format === 'csv') {
      const csv = exportToCSV(report);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="readiness-history-${Date.now()}.csv"`,
        },
      });
    } else if (format === 'raw-json') {
      return new NextResponse(exportToJSON(report), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="readiness-report-${Date.now()}.json"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unsupported format. Use json, csv, or raw-json' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Readiness Report API] Error:', error);
    return NextResponse.json({ error: 'Failed to generate readiness report', details: error.message }, { status: 500 });
  }
}
