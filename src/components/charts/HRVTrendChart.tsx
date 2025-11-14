'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  value: number;
}

interface HRVTrendChartProps {
  data: DataPoint[];
  average?: number;
}

export default function HRVTrendChart({ data, average }: HRVTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No HRV data available
      </div>
    );
  }

  const chartData = data.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    hrv: d.value,
    average: average || 0,
  }));

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            label={{ value: 'HRV (ms)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [`${value.toFixed(1)} ms`, 'HRV']}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="hrv"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="HRV"
          />
          {average && (
            <Line
              type="monotone"
              dataKey="average"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="30-day Average"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
