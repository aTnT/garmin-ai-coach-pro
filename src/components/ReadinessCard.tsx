import { ReadinessScore } from '@/lib/calculations/readiness';

interface ReadinessCardProps {
  readiness: ReadinessScore;
}

export default function ReadinessCard({ readiness }: ReadinessCardProps) {
  const { score, level, explanation, factors } = readiness;

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBgColor = (score: number) => {
    if (score >= 85) return 'bg-green-50 border-green-200';
    if (score >= 70) return 'bg-blue-50 border-blue-200';
    if (score >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className={`border-2 rounded-lg p-6 ${getBgColor(score)}`}>
      <h2 className="text-2xl font-bold mb-2">Today's Readiness</h2>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-6xl font-bold ${getScoreColor(score)}`}>
          {score}
        </span>
        <span className="text-2xl text-gray-600">/100</span>
      </div>
      <p className="text-lg font-semibold capitalize mb-2">{level}</p>
      <p className="text-gray-700">{explanation}</p>

      <div className="mt-6 space-y-3">
        <h3 className="font-semibold text-sm text-gray-600 uppercase">
          Contributing Factors
        </h3>

        <div className="space-y-2">
          <FactorItem
            name="HRV"
            score={factors.hrv.score}
            impact={factors.hrv.impact}
          />
          <FactorItem
            name="Training Load"
            score={factors.trainingLoad.score}
            impact={factors.trainingLoad.impact}
          />
          <FactorItem
            name="Recovery"
            score={factors.recovery.score}
            impact={factors.recovery.impact}
          />
          <FactorItem
            name="Sleep"
            score={factors.sleep.score}
            impact={factors.sleep.impact}
          />
        </div>
      </div>
    </div>
  );
}

function FactorItem({
  name,
  score,
  impact,
}: {
  name: string;
  score: number;
  impact: string;
}) {
  return (
    <div className="bg-white rounded p-3">
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium text-sm">{name}</span>
        <span className="text-sm font-semibold">{score}/100</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">{impact}</p>
    </div>
  );
}
