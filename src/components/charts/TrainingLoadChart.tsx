'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { format, subDays } from 'date-fns';

interface Metric {
  date: string;
  value: number;
}

interface TrainingLoadChartProps {
  data: Metric[];
}

export default function TrainingLoadChart({ data }: TrainingLoadChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No training load data available
      </div>
    );
  }

  // Calculate rolling averages
  const calculateRollingAverage = (days: number, endDate: Date) => {
    const startDate = subDays(endDate, days);
    const relevantData = data.filter((d) => {
      const date = new Date(d.date);
      return date >= startDate && date <= endDate;
    });

    if (relevantData.length === 0) return 0;
    return relevantData.reduce((sum, d) => sum + d.value, 0) / relevantData.length;
  };

  // Group by week and calculate acute (7-day) and chronic (28-day) loads
  const weeklyData: any[] = [];
  const sortedData = [...data].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Sample every 7 days
  for (let i = 0; i < sortedData.length; i += 7) {
    const point = sortedData[i];
    const date = new Date(point.date);

    const acuteLoad = calculateRollingAverage(7, date);
    const chronicLoad = calculateRollingAverage(28, date);
    const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

    weeklyData.push({
      date: format(date, 'MMM d'),
      acute: Math.round(acuteLoad),
      chronic: Math.round(chronicLoad),
      acwr: acwr.toFixed(2),
    });
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeklyData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
            label={{ value: 'Training Load', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'ACWR') return [value, 'ACWR'];
              return [value, name === 'acute' ? 'Acute (7-day)' : 'Chronic (28-day)'];
            }}
          />
          <Legend />
          <Bar
            dataKey="acute"
            fill="#3b82f6"
            name="Acute Load (7-day)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="chronic"
            fill="#94a3b8"
            name="Chronic Load (28-day)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
