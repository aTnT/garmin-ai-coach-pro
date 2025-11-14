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
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { format, subDays } from 'date-fns';

interface Metric {
  date: string;
  value: number;
}

interface ACWRChartProps {
  data: Metric[];
}

export default function ACWRChart({ data }: ACWRChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No training load data available for ACWR calculation
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

  // Calculate ACWR for each day
  const acwrData: any[] = [];
  const sortedData = [...data].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Sample every 3 days to reduce data points
  for (let i = 0; i < sortedData.length; i += 3) {
    const point = sortedData[i];
    const date = new Date(point.date);

    const acuteLoad = calculateRollingAverage(7, date);
    const chronicLoad = calculateRollingAverage(28, date);
    const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

    // Only include if we have enough data
    if (acuteLoad > 0 && chronicLoad > 0) {
      acwrData.push({
        date: format(date, 'MMM d'),
        acwr: Number(acwr.toFixed(2)),
        optimal: 1.0, // Reference line
      });
    }
  }

  if (acwrData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Not enough data to calculate ACWR (need 28+ days)
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="font-semibold text-gray-900 mb-2">
          Acute:Chronic Workload Ratio (ACWR)
        </h4>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-200 rounded"></div>
            <span className="text-gray-600">Safe Zone (0.8-1.3)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-200 rounded"></div>
            <span className="text-gray-600">Caution (&lt;0.8 or 1.3-1.5)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-200 rounded"></div>
            <span className="text-gray-600">Danger (&gt;1.5)</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={acwrData}>
            {/* Color zones */}
            <ReferenceArea y1={0.8} y2={1.3} fill="#bbf7d0" fillOpacity={0.3} />
            <ReferenceArea y1={0.5} y2={0.8} fill="#fef08a" fillOpacity={0.2} />
            <ReferenceArea y1={1.3} y2={1.5} fill="#fef08a" fillOpacity={0.2} />
            <ReferenceArea y1={1.5} y2={2.0} fill="#fecaca" fillOpacity={0.3} />

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
            />
            <YAxis
              domain={[0, 2]}
              ticks={[0, 0.5, 0.8, 1.0, 1.3, 1.5, 2.0]}
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              label={{ value: 'ACWR', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number) => {
                const status =
                  value >= 0.8 && value <= 1.3
                    ? '✓ Safe Zone'
                    : value >= 1.5
                    ? '⚠ High Risk'
                    : value < 0.8
                    ? '⚠ Under-training'
                    : '⚠ Caution';
                return [`${value.toFixed(2)} (${status})`, 'ACWR'];
              }}
            />

            {/* Reference lines */}
            <ReferenceLine
              y={0.8}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ value: '0.8', position: 'right' }}
            />
            <ReferenceLine
              y={1.3}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              label={{ value: '1.3', position: 'right' }}
            />
            <ReferenceLine
              y={1.5}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: '1.5 (danger)', position: 'right', fill: '#ef4444' }}
            />

            <Line
              type="monotone"
              dataKey="acwr"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', r: 5 }}
              activeDot={{ r: 7 }}
              name="ACWR"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-semibold text-blue-900 mb-2">Understanding ACWR</h5>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>
            <strong>ACWR = Acute Load (7 days) ÷ Chronic Load (28 days)</strong>
          </li>
          <li>
            <strong>0.8-1.3</strong>: Optimal training zone - building fitness safely
          </li>
          <li>
            <strong>&lt;0.8</strong>: Under-training - may lose fitness
          </li>
          <li>
            <strong>1.3-1.5</strong>: Caution - monitor for fatigue
          </li>
          <li>
            <strong>&gt;1.5</strong>: High injury risk - consider recovery week
          </li>
        </ul>
      </div>
    </div>
  );
}
