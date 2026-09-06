import React, { useMemo } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-gifted-charts';
import SectionHeader from '@/components/SectionHeader';
import { colors } from '@/constants/colors';

function labelColor(label: string) {
  const normalized = String(label ?? '').toLowerCase();
  if (normalized === 'high') return colors.status.error;
  if (normalized === 'medium') return colors.status.warning;
  return colors.status.success;
}

interface WhatIfComparisonChartProps {
  /** baseline + scenario risk scores in the 0–1 range */
  baselineScore: number;
  scenarioScore: number;
  baselineLabel: string;
  scenarioLabel: string;
}

const WhatIfComparisonChart: React.FC<WhatIfComparisonChartProps> = ({
  baselineScore,
  scenarioScore,
  baselineLabel,
  scenarioLabel,
}) => {
  const { width } = useWindowDimensions();

  const basePct = Math.round((baselineScore ?? 0) * 100);
  const scenarioPct = Math.round((scenarioScore ?? 0) * 100);

  const improvement = useMemo(() => {
    if (!baselineScore || baselineScore <= 0) return 0;
    return Math.round(((baselineScore - scenarioScore) / baselineScore) * 100);
  }, [baselineScore, scenarioScore]);

  const improved = improvement > 0;
  const unchanged = improvement === 0;

  const chartData = useMemo(
    () => [
      {
        value: basePct,
        label: 'Current',
        frontColor: labelColor(baselineLabel),
        topLabelComponent: () => (
          <Text className="text-xs font-bold text-text mb-1">{basePct}%</Text>
        ),
      },
      {
        value: scenarioPct,
        label: 'Simulated',
        frontColor: labelColor(scenarioLabel),
        topLabelComponent: () => (
          <Text className="text-xs font-bold text-text mb-1">{scenarioPct}%</Text>
        ),
      },
    ],
    [basePct, scenarioPct, baselineLabel, scenarioLabel],
  );

  const chartWidth = Math.max(width - 150, 200);

  return (
    <View>
      <SectionHeader
        eyebrow="What-if"
        title="Risk comparison"
        subtitle="Current versus simulated diabetes risk."
      />

      <View
        className={`flex-row items-center px-3 py-2.5 rounded-2xl mb-4 ${
          unchanged ? 'bg-bg-secondary' : improved ? 'bg-success/10' : 'bg-error/10'
        }`}
      >
        <View
          className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
            unchanged ? 'bg-bg-tertiary' : improved ? 'bg-success/15' : 'bg-error/15'
          }`}
        >
          <Ionicons
            name={unchanged ? 'remove' : improved ? 'trending-down' : 'trending-up'}
            size={20}
            color={
              unchanged
                ? colors.text.secondary
                : improved
                  ? colors.status.success
                  : colors.status.error
            }
          />
        </View>
        <View className="flex-1">
          <Text
            className={`text-base font-bold ${
              unchanged ? 'text-text' : improved ? 'text-success' : 'text-error'
            }`}
          >
            {unchanged
              ? 'No change in risk'
              : `${Math.abs(improvement)}% ${improved ? 'lower' : 'higher'} risk`}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            {basePct}% → {scenarioPct}% predicted risk
          </Text>
        </View>
      </View>

      <View className="items-center">
        <BarChart
          data={chartData}
          width={chartWidth}
          height={150}
          barWidth={56}
          spacing={48}
          initialSpacing={24}
          endSpacing={16}
          roundedTop
          isAnimated
          animationDuration={500}
          maxValue={100}
          noOfSections={4}
          hideRules
          yAxisColor="transparent"
          xAxisColor={colors.border.light}
          yAxisTextStyle={{ color: colors.text.tertiary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: colors.text.secondary, fontSize: 12 }}
        />
      </View>
    </View>
  );
};

export default WhatIfComparisonChart;
