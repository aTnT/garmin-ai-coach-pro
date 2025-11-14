interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export default function MetricCard({
  title,
  value,
  unit,
  trend,
  icon,
}: MetricCardProps) {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900">{value}</span>
            {unit && <span className="text-lg text-gray-600">{unit}</span>}
          </div>
        </div>
        {icon && <div className="text-blue-600">{icon}</div>}
      </div>
      {trend && (
        <p className={`text-xs mt-2 ${getTrendColor()}`}>
          {trend === 'up' && '↑ Increasing'}
          {trend === 'down' && '↓ Decreasing'}
          {trend === 'neutral' && '→ Stable'}
        </p>
      )}
    </div>
  );
}
