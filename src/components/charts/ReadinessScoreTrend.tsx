'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  score: number;
}

interface ReadinessScoreTrendProps {
  data: DataPoint[];
}

export default function ReadinessScoreTrend({ data }: ReadinessScoreTrendProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No readiness score history available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    score: d.score,
  }));

  const getGradientColor = (score: number) => {
    if (score >= 85) return { start: '#86efac', end: '#22c55e' }; // green
    if (score >= 70) return { start: '#93c5fd', end: '#3b82f6' }; // blue
    if (score >= 50) return { start: '#fde047', end: '#eab308' }; // yellow
    return { start: '#fca5a5', end: '#ef4444' }; // red
  };

  const avgScore = data.reduce((sum, d) => sum + d.score, 0) / data.length;
  const gradientId = 'readinessGradient';

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 70, 85, 100]}
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            label={{ value: 'Readiness Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => {
              const level =
                value >= 85
                  ? 'Excellent'
                  : value >= 70
                  ? 'Good'
                  : value >= 50
                  ? 'Moderate'
                  : 'Low';
              return [`${value.toFixed(0)} (${level})`, 'Readiness'];
            }}
          />

          {/* Reference lines for zones */}
          <ReferenceLine
            y={85}
            stroke="#22c55e"
            strokeDasharray="3 3"
            label={{ value: 'Excellent', position: 'right', fill: '#22c55e' }}
          />
          <ReferenceLine
            y={70}
            stroke="#3b82f6"
            strokeDasharray="3 3"
            label={{ value: 'Good', position: 'right', fill: '#3b82f6' }}
          />
          <ReferenceLine
            y={50}
            stroke="#eab308"
            strokeDasharray="3 3"
            label={{ value: 'Moderate', position: 'right', fill: '#eab308' }}
          />
          <ReferenceLine
            y={avgScore}
            stroke="#94a3b8"
            strokeDasharray="5 5"
            label={{
              value: `Avg: ${avgScore.toFixed(0)}`,
              position: 'right',
              fill: '#94a3b8',
            }}
          />

          <Area
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
