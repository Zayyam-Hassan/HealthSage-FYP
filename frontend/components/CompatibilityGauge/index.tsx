import React from 'react';
import { View, Text } from 'react-native';
import Badge from '@/components/Badge';
import Card from '@/components/Card';

interface CompatibilityGaugeProps {
  score: number;
  contraindications?: string[];
  interactions?: string[];
  summary?: string;
  className?: string;
}

const CompatibilityGauge: React.FC<CompatibilityGaugeProps> = ({
  score,
  contraindications = [],
  interactions = [],
  summary = '',
  className = '',
}) => {
  // Score ranges: -1 to 1, convert to 0-100 for display
  const normalizedScore = ((score + 1) / 2) * 100;
  
  const getCompatibilityLevel = (score: number): 'safe' | 'caution' | 'warning' => {
    if (score > 0.5) return 'safe';
    if (score > -0.5) return 'caution';
    return 'warning';
  };

  const getVariant = (level: string): 'success' | 'warning' | 'error' => {
    switch (level) {
      case 'safe':
        return 'success';
      case 'caution':
        return 'warning';
      case 'warning':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getBarColor = (level: string) => {
    switch (level) {
      case 'safe':
        return 'bg-success';
      case 'caution':
        return 'bg-warning';
      case 'warning':
        return 'bg-error';
      default:
        return 'bg-warning';
    }
  };

  const level = getCompatibilityLevel(score);
  const levelLabels = {
    safe: 'Compatible',
    caution: 'Use with Caution',
    warning: 'Not Recommended',
  };

  return (
    <View className={className}>
      {/* Score Display */}
      <Card className="mb-4">
        <View className="items-center mb-4">
          <Text className="text-sm text-text-secondary mb-2">Compatibility Score</Text>
          <View className="flex-row items-baseline mb-2">
            <Text className="text-4xl font-bold text-text mr-2">
              {normalizedScore.toFixed(0)}%
            </Text>
            <Badge variant={getVariant(level)} size="md">
              {levelLabels[level]}
            </Badge>
          </View>
          
          {/* Progress Bar */}
          <View className="w-full h-4 bg-bg-secondary rounded-full overflow-hidden">
            <View
              className={`h-full ${getBarColor(level)}`}
              style={{ width: `${normalizedScore}%` }}
            />
          </View>
        </View>

        {summary && (
          <View className="mt-4 pt-4 border-t border-border">
            <Text className="text-sm font-semibold text-text mb-2">Summary</Text>
            <Text className="text-sm text-text-secondary leading-5">
              {summary}
            </Text>
          </View>
        )}
      </Card>

      {/* Contraindications */}
      {contraindications.length > 0 && (
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-2 text-error">
            Contraindications
          </Text>
          {contraindications.map((item, index) => (
            <View key={index} className="flex-row items-start mb-2">
              <Text className="text-error mr-2">•</Text>
              <Text className="text-sm text-text-secondary flex-1">{item}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Interactions */}
      {interactions.length > 0 && (
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-2 text-warning">
            Drug Interactions
          </Text>
          {interactions.map((item, index) => (
            <View key={index} className="flex-row items-start mb-2">
              <Text className="text-warning mr-2">•</Text>
              <Text className="text-sm text-text-secondary flex-1">{item}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Medical Disclaimer */}
      <Card className="bg-warning/10 border-warning/30">
        <Text className="text-xs text-warning font-semibold mb-1">
          ⚠️ Medical Disclaimer
        </Text>
        <Text className="text-xs text-text-secondary leading-4">
          This compatibility check is for informational purposes only and should not replace professional medical advice. Always consult with a healthcare provider before making medication decisions.
        </Text>
      </Card>
    </View>
  );
};

export default CompatibilityGauge;


