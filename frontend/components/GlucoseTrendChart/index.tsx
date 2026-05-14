import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import Card from '@/components/Card';
import SectionHeader from '@/components/SectionHeader';
import { colors } from '@/constants/colors';
import {
  patientsService,
  type GlucoseReading,
  type GlucoseHistoryResponse,
} from '@/services/patients';

type RangeKey = '7d' | '30d';

// Reference band for random capillary glucose (mg/dL).
const NORMAL_LOW = 70;
const NORMAL_HIGH = 140;

const PREFERRED_CODE_ORDER = ['RANDOM_GLUCOSE', 'FASTING_GLUCOSE'];

function pickSeries(readings: GlucoseReading[]): {
  code: string | null;
  points: GlucoseReading[];
} {
  for (const code of PREFERRED_CODE_ORDER) {
    const points = readings
      .filter((r) => r.code === code && r.recorded_at)
      .sort(
        (a, b) =>
          new Date(a.recorded_at as string).getTime() -
          new Date(b.recorded_at as string).getTime(),
      );
    if (points.length > 0) {
      return { code, points };
    }
  }
  return { code: null, points: [] };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface GlucoseTrendChartProps {
  patientId: string;
}

const GlucoseTrendChart: React.FC<GlucoseTrendChartProps> = ({ patientId }) => {
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<RangeKey>('7d');
  const [data, setData] = useState<GlucoseHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await patientsService.getGlucoseHistory(patientId, range);
      setData(res);
    } catch {
      setError(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [patientId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const { code, points } = useMemo(
    () => pickSeries(data?.readings ?? []),
    [data],
  );

  const chartWidth = Math.max(width - 130, 220);

  const chartData = useMemo(
    () =>
      points.map((p, index) => {
        const showLabel =
          points.length <= 7 || index % Math.ceil(points.length / 6) === 0;
        return {
          value: p.value,
          label: showLabel ? formatDate(p.recorded_at as string) : '',
          labelTextStyle: { color: colors.text.tertiary, fontSize: 10 },
        };
      }),
    [points],
  );

  const maxValue = useMemo(() => {
    const peak = Math.max(NORMAL_HIGH, ...points.map((p) => p.value));
    return Math.ceil((peak * 1.15) / 20) * 20;
  }, [points]);

  const codeLabel = code === 'FASTING_GLUCOSE' ? 'Fasting glucose' : 'Random glucose';

  return (
    <Card className="mb-4 border-border/80">
      <SectionHeader
        eyebrow="Trends"
        title="Glucose trend"
        subtitle={
          code
            ? `${codeLabel} · normal ${NORMAL_LOW}–${NORMAL_HIGH} mg/dL`
            : 'Glucose progression over time'
        }
      />

      <View className="flex-row self-end mb-3 rounded-full border border-border bg-bg-secondary p-0.5">
        {(['7d', '30d'] as RangeKey[]).map((key) => {
          const active = range === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setRange(key)}
              className={`px-3 py-1 rounded-full ${active ? 'bg-bg-card shadow-sm' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                className={`text-xs font-semibold ${active ? 'text-text' : 'text-text-secondary'}`}
              >
                {key === '7d' ? 'Last 7 days' : 'Last 30 days'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View className="py-10 items-center">
          <Text className="text-sm text-text-tertiary">Loading glucose history…</Text>
        </View>
      ) : error ? (
        <View className="py-8 items-center">
          <Ionicons name="cloud-offline-outline" size={24} color={colors.text.tertiary} />
          <Text className="text-sm text-text-secondary mt-2 text-center">
            Could not load glucose history.
          </Text>
          <TouchableOpacity onPress={load} className="mt-2">
            <Text className="text-sm font-semibold text-primary">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : chartData.length === 0 ? (
        <View className="py-8 items-center">
          <View className="w-11 h-11 rounded-2xl bg-primary/10 items-center justify-center mb-2">
            <Ionicons name="pulse-outline" size={22} color={colors.primary.main} />
          </View>
          <Text className="text-sm text-text-secondary text-center leading-5">
            No glucose readings recorded in this period. New readings appear here as
            the health record is updated.
          </Text>
        </View>
      ) : chartData.length === 1 ? (
        <View className="py-6 items-center">
          <Text className="text-3xl font-bold text-text">
            {chartData[0].value}
            <Text className="text-base text-text-secondary"> mg/dL</Text>
          </Text>
          <Text className="text-sm text-text-secondary mt-1">
            {codeLabel} · {formatDate(points[0].recorded_at as string)}
          </Text>
          <Text className="text-xs text-text-tertiary mt-2 text-center">
            One reading so far — a trend line appears once more readings are recorded.
          </Text>
        </View>
      ) : (
        <View className="-ml-1">
          <LineChart
            data={chartData}
            width={chartWidth}
            adjustToWidth
            curved
            isAnimated
            animationDuration={600}
            thickness={2.5}
            color={colors.primary.dark}
            dataPointsColor={colors.primary.dark}
            dataPointsRadius={3.5}
            startFillColor={colors.primary.main}
            endFillColor={colors.primary.light}
            startOpacity={0.28}
            endOpacity={0.04}
            areaChart
            hideRules
            yAxisColor="transparent"
            xAxisColor={colors.border.light}
            yAxisTextStyle={{ color: colors.text.tertiary, fontSize: 10 }}
            noOfSections={4}
            maxValue={maxValue}
            initialSpacing={12}
            endSpacing={8}
            showReferenceLine1
            referenceLine1Position={NORMAL_HIGH}
            referenceLine1Config={{
              color: colors.status.warning,
              dashWidth: 4,
              dashGap: 4,
              thickness: 1,
            }}
            showReferenceLine2
            referenceLine2Position={NORMAL_LOW}
            referenceLine2Config={{
              color: colors.status.info,
              dashWidth: 4,
              dashGap: 4,
              thickness: 1,
            }}
            pointerConfig={{
              pointerStripColor: colors.border.medium,
              pointerStripWidth: 1,
              pointerColor: colors.primary.dark,
              radius: 5,
              pointerLabelWidth: 110,
              pointerLabelHeight: 44,
              activatePointersOnLongPress: false,
              pointerLabelComponent: (items: any[]) => {
                const item = items?.[0];
                if (!item) return null;
                return (
                  <View className="px-2.5 py-1.5 rounded-xl bg-text shadow-sm">
                    <Text className="text-xs font-semibold text-white">
                      {item.value} mg/dL
                    </Text>
                  </View>
                );
              },
            }}
          />
          <View className="flex-row items-center justify-center mt-3 gap-4">
            <View className="flex-row items-center">
              <View
                className="w-3 h-0.5 mr-1.5"
                style={{ backgroundColor: colors.status.warning }}
              />
              <Text className="text-xs text-text-tertiary">High {NORMAL_HIGH}</Text>
            </View>
            <View className="flex-row items-center">
              <View
                className="w-3 h-0.5 mr-1.5"
                style={{ backgroundColor: colors.status.info }}
              />
              <Text className="text-xs text-text-tertiary">Low {NORMAL_LOW}</Text>
            </View>
          </View>
        </View>
      )}
    </Card>
  );
};

export default GlucoseTrendChart;
