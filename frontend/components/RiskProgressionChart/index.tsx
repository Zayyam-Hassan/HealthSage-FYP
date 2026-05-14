import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import SectionHeader from '@/components/SectionHeader';
import { colors } from '@/constants/colors';
import {
  aiResultsService,
  type RiskHistoryPoint,
  type RiskHistoryResponse,
} from '@/services/aiResults';

function labelColor(label: string) {
  if (label === 'high') return colors.status.error;
  if (label === 'medium') return colors.status.warning;
  return colors.status.success;
}

function badgeVariant(label: string) {
  if (label === 'high') return 'error' as const;
  if (label === 'medium') return 'warning' as const;
  return 'success' as const;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface RiskProgressionChartProps {
  patientId: string;
}

const RiskProgressionChart: React.FC<RiskProgressionChartProps> = ({ patientId }) => {
  const { width } = useWindowDimensions();
  const [data, setData] = useState<RiskHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await aiResultsService.getRiskHistory(patientId);
      setData(res);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const history: RiskHistoryPoint[] = useMemo(
    () => (data?.history ?? []).filter((h) => h.date),
    [data],
  );

  const latest = history[history.length - 1];
  const first = history[0];

  const delta = useMemo(() => {
    if (history.length < 2) return null;
    return Math.round((latest.risk_score - first.risk_score) * 100);
  }, [history, latest, first]);

  const chartWidth = Math.max(width - 130, 220);

  const chartData = useMemo(
    () =>
      history.map((h, index) => {
        const showLabel =
          history.length <= 7 ||
          index % Math.ceil(history.length / 6) === 0 ||
          index === history.length - 1;
        return {
          value: Math.round(h.risk_score * 100),
          label: showLabel ? formatDate(h.date) : '',
          labelTextStyle: { color: colors.text.tertiary, fontSize: 10 },
        };
      }),
    [history],
  );

  const lineColor = latest ? labelColor(latest.risk_label) : colors.accent.main;

  return (
    <Card className="mb-5 border-border/80">
      <SectionHeader
        eyebrow="Trends"
        title="Risk progression"
        subtitle="Diabetes risk across past predictions."
      />

      {loading ? (
        <View className="py-10 items-center">
          <Text className="text-sm text-text-tertiary">Loading risk history…</Text>
        </View>
      ) : error ? (
        <View className="py-8 items-center">
          <Ionicons name="cloud-offline-outline" size={24} color={colors.text.tertiary} />
          <Text className="text-sm text-text-secondary mt-2 text-center">
            Could not load risk history.
          </Text>
          <TouchableOpacity onPress={load} className="mt-2">
            <Text className="text-sm font-semibold text-primary">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : history.length === 0 ? (
        <View className="py-8 items-center">
          <View className="w-11 h-11 rounded-2xl bg-accent/10 items-center justify-center mb-2">
            <Ionicons name="trending-up-outline" size={22} color={colors.accent.main} />
          </View>
          <Text className="text-sm text-text-secondary text-center leading-5">
            No prior predictions yet. Run the risk model over time to build a
            progression trend.
          </Text>
        </View>
      ) : history.length === 1 ? (
        <View className="py-6 items-center">
          <Text className="text-4xl font-bold text-text">
            {Math.round(latest.risk_score * 100)}%
          </Text>
          <View className="mt-2">
            <Badge variant={badgeVariant(latest.risk_label)} size="sm">
              {latest.risk_label.toUpperCase()}
            </Badge>
          </View>
          <Text className="text-xs text-text-tertiary mt-2 text-center">
            One prediction on record — a trend line appears after the next run.
          </Text>
        </View>
      ) : (
        <View>
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-baseline">
              <Text className="text-2xl font-bold text-text mr-2">
                {Math.round(latest.risk_score * 100)}%
              </Text>
              <Badge variant={badgeVariant(latest.risk_label)} size="sm">
                {latest.risk_label.toUpperCase()}
              </Badge>
            </View>
            {delta !== null && delta !== 0 && (
              <View
                className={`flex-row items-center px-2 py-1 rounded-full ${
                  delta > 0 ? 'bg-error/10' : 'bg-success/10'
                }`}
              >
                <Ionicons
                  name={delta > 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={delta > 0 ? colors.status.error : colors.status.success}
                />
                <Text
                  className={`text-xs font-semibold ml-0.5 ${
                    delta > 0 ? 'text-error' : 'text-success'
                  }`}
                >
                  {Math.abs(delta)} pts
                </Text>
              </View>
            )}
          </View>

          <View className="-ml-1">
            <LineChart
              data={chartData}
              width={chartWidth}
              adjustToWidth
              curved
              isAnimated
              animationDuration={600}
              areaChart
              thickness={2.5}
              color={lineColor}
              dataPointsColor={lineColor}
              dataPointsRadius={3.5}
              startFillColor={lineColor}
              endFillColor={lineColor}
              startOpacity={0.25}
              endOpacity={0.03}
              hideRules
              yAxisColor="transparent"
              xAxisColor={colors.border.light}
              yAxisTextStyle={{ color: colors.text.tertiary, fontSize: 10 }}
              noOfSections={4}
              maxValue={100}
              initialSpacing={12}
              endSpacing={8}
              pointerConfig={{
                pointerStripColor: colors.border.medium,
                pointerStripWidth: 1,
                pointerColor: lineColor,
                radius: 5,
                pointerLabelWidth: 90,
                pointerLabelHeight: 40,
                activatePointersOnLongPress: false,
                pointerLabelComponent: (items: any[]) => {
                  const item = items?.[0];
                  if (!item) return null;
                  return (
                    <View className="px-2.5 py-1.5 rounded-xl bg-text shadow-sm">
                      <Text className="text-xs font-semibold text-white">
                        {item.value}% risk
                      </Text>
                    </View>
                  );
                },
              }}
            />
          </View>
        </View>
      )}
    </Card>
  );
};

export default RiskProgressionChart;
