import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '@/components/Card';
import SectionHeader from '@/components/SectionHeader';
import { colors } from '@/constants/colors';

interface ParsedFactor {
  name: string;
  importance: number;
}

// predictRisk() formats clinical factors as "feature name (importance: 28.0%)".
function parseFactor(raw: string): ParsedFactor {
  const match = raw.match(/^(.*?)\s*\(importance:\s*([\d.]+)%\)\s*$/i);
  if (match) {
    return {
      name: match[1].trim(),
      importance: Number(match[2]) || 0,
    };
  }
  return { name: raw.trim(), importance: 0 };
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface ExplainabilityPanelProps {
  /** Clinical factor strings from RiskPredictionResponse.factors.clinical */
  factors: string[];
  maxItems?: number;
  className?: string;
}

const ExplainabilityPanel: React.FC<ExplainabilityPanelProps> = ({
  factors,
  maxItems = 5,
  className = 'mb-4 border-border/80',
}) => {
  const parsed = useMemo(() => {
    return (factors ?? [])
      .map(parseFactor)
      .filter((f) => f.name.length > 0)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxItems);
  }, [factors, maxItems]);

  const peak = useMemo(
    () => parsed.reduce((max, f) => Math.max(max, f.importance), 0),
    [parsed],
  );

  return (
    <Card className={className}>
      <SectionHeader
        eyebrow="Explainable AI"
        title="Why this risk level"
        subtitle="Top features driving the model's prediction."
      />

      {parsed.length === 0 ? (
        <View className="py-6 items-center">
          <View className="w-11 h-11 rounded-2xl bg-accent/10 items-center justify-center mb-2">
            <Ionicons name="bulb-outline" size={22} color={colors.accent.main} />
          </View>
          <Text className="text-sm text-text-secondary text-center leading-5">
            The model did not return feature attributions for this prediction.
          </Text>
        </View>
      ) : (
        <View>
          {parsed.map((factor, index) => {
            const widthPct =
              peak > 0 ? Math.max(8, (factor.importance / peak) * 100) : 8;
            return (
              <View key={`${factor.name}-${index}`} className="mb-3.5 last:mb-0">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View className="flex-row items-center flex-1 pr-2">
                    <View className="w-5 h-5 rounded-md bg-accent/10 items-center justify-center mr-2">
                      <Text className="text-[10px] font-bold text-accent">
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-medium text-text flex-1"
                      numberOfLines={1}
                    >
                      {titleCase(factor.name)}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons
                      name="arrow-up"
                      size={12}
                      color={colors.status.error}
                    />
                    <Text className="text-xs font-semibold text-text-secondary ml-0.5">
                      {factor.importance.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <View className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(widthPct, 100)}%`,
                      backgroundColor: colors.accent.main,
                    }}
                  />
                </View>
              </View>
            );
          })}

          <View className="flex-row items-center mt-3 pt-3 border-t border-border">
            <Ionicons name="arrow-up" size={12} color={colors.status.error} />
            <Text className="text-xs text-text-tertiary ml-1">
              Each factor increases predicted risk; longer bars contribute more.
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
};

export default ExplainabilityPanel;
