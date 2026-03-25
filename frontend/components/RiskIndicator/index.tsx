import React from 'react';
import { View, Text } from 'react-native';
import Badge from '@/components/Badge';
import { RiskPrediction } from '@/constants/mockRisk';

interface RiskIndicatorProps {
  risk: RiskPrediction;
  showDetails?: boolean;
  className?: string;
}

const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  risk,
  showDetails = false,
  className = '',
}) => {
  const getRiskColor = (riskClass: string) => {
    switch (riskClass) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'info';
    }
  };

  const getRiskPercentage = (score: number) => {
    return Math.round(score * 100);
  };

  const getBarColor = (riskClass: string) => {
    switch (riskClass) {
      case 'low':
        return 'bg-success';
      case 'medium':
        return 'bg-warning';
      case 'high':
        return 'bg-error';
      default:
        return 'bg-info';
    }
  };

  return (
    <View className={className}>
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1">
          <Text className="text-sm text-text-secondary mb-1">Risk Score</Text>
          <View className="flex-row items-baseline">
            <Text className="text-3xl font-bold text-text mr-2">
              {getRiskPercentage(risk.risk_score)}%
            </Text>
            <Badge variant={getRiskColor(risk.risk_class) as any} size="md">
              {risk.risk_class.toUpperCase()}
            </Badge>
          </View>
        </View>
        {showDetails && (
          <View className="items-end">
            <Text className="text-xs text-text-secondary mb-1">Confidence</Text>
            <Text className="text-base font-semibold text-text">
              {Math.round(risk.confidence * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View className="h-3 bg-bg-secondary rounded-full overflow-hidden mb-4">
        <View
          className={`h-full ${getBarColor(risk.risk_class)}`}
          style={{ width: `${getRiskPercentage(risk.risk_score)}%` }}
        />
      </View>

      {showDetails && (
        <View className="mt-4">
          <Text className="text-sm font-semibold text-text mb-2">
            Clinical Summary
          </Text>
          <Text className="text-sm text-text-secondary leading-5 mb-4">
            {risk.clinicalSummary}
          </Text>

          {(risk.factors?.clinical?.length || risk.factors?.lifestyle?.length || risk.factors?.genetic?.length) > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-text mb-2">Contributing Factors</Text>
              {risk.factors.clinical?.length > 0 && (
                <View className="mb-2">
                  <Text className="text-xs text-text-tertiary mb-1">Clinical</Text>
                  {risk.factors.clinical.map((f, i) => (
                    <Text key={i} className="text-sm text-text-secondary">• {f}</Text>
                  ))}
                </View>
              )}
              {risk.factors.lifestyle?.length > 0 && (
                <View className="mb-2">
                  <Text className="text-xs text-text-tertiary mb-1">Lifestyle</Text>
                  {risk.factors.lifestyle.map((f, i) => (
                    <Text key={i} className="text-sm text-text-secondary">• {f}</Text>
                  ))}
                </View>
              )}
              {risk.factors.genetic?.length > 0 && (
                <View className="mb-2">
                  <Text className="text-xs text-text-tertiary mb-1">Genetic</Text>
                  {risk.factors.genetic.map((f, i) => (
                    <Text key={i} className="text-sm text-text-secondary">• {f}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {risk.recommendations?.length > 0 && (
            <View>
              <Text className="text-sm font-semibold text-text mb-2">Recommendations</Text>
              {risk.recommendations.map((rec, i) => (
                <View key={i} className="flex-row items-start mb-1.5">
                  <Text className="text-primary mr-2">•</Text>
                  <Text className="text-sm text-text-secondary flex-1">{rec}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default RiskIndicator;


