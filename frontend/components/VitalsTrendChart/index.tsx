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
  type ObservationRange,
} from '@/services/patients';

type IonIconName = React.ComponentProps<typeof Ionicons>['name'];

export interface VitalsSeriesConfig {
  code: string;
  label: string;
  color: string;
}

export interface VitalsReferenceLine {
  value: number;
  color: string;
  label: string;
}

interface VitalsTrendChartProps {
  patientId: string;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** One or two series — second one renders as a paired line (e.g. BP). */
  series: VitalsSeriesConfig[];
  unit: string;
  range?: ObservationRange;
  referenceLines?: VitalsReferenceLine[];
  emptyIcon?: IonIconName;
  emptyMessage?: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function toChartData(
  readings: GlucoseReading[],
  code: string,
  highlightLabels: boolean,
) {
  const points = readings
    .filter((r) => r.code === code && r.recorded_at && r.value != null)
    .sort(
      (a, b) =>
        new Date(a.recorded_at as string).getTime() -
        new Date(b.recorded_at as string).getTime(),
    );
  return points.map((p, index) => {
    const showLabel =
      highlightLabels &&
      (points.length <= 7 ||
        index % Math.ceil(points.length / 6) === 0 ||
        index === points.length - 1);
    return {
      value: p.value,
      label: showLabel ? formatDate(p.recorded_at) : '',
      labelTextStyle: { color: colors.text.tertiary, fontSize: 10 },
    };
  });
}

const VitalsTrendChart: React.FC<VitalsTrendChartProps> = ({
  patientId,
  title,
  subtitle,
  eyebrow = 'Trends',
  series,
  unit,
  range = '30d',
  referenceLines = [],
  emptyIcon = 'analytics-outline',
  emptyMessage,
}) => {
  const { width } = useWindowDimensions();
  const [readings, setReadings] = useState<GlucoseReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const codes = useMemo(() => series.map((s) => s.code), [series]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await patientsService.getObservationHistory(patientId, {
        codes,
        range,
      });
      setReadings(res.readings);
    } catch {
      setError(true);
      setReadings([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, codes, range]);

  useEffect(() => {
    load();
  }, [load]);

  const primaryData = useMemo(
    () => toChartData(readings, series[0]?.code ?? '', true),
    [readings, series],
  );
  const secondaryData = useMemo(
    () =>
      series[1]
        ? toChartData(readings, series[1].code, false)
        : [],
    [readings, series],
  );

  const hasData = primaryData.length > 0 || secondaryData.length > 0;

  const maxValue = useMemo(() => {
    const values = [
      ...primaryData.map((d) => d.value),
      ...secondaryData.map((d) => d.value),
      ...referenceLines.map((r) => r.value),
    ];
    if (values.length === 0) return 100;
    const peak = Math.max(...values);
    return Math.ceil((peak * 1.18) / 10) * 10;
  }, [primaryData, secondaryData, referenceLines]);

  const chartWidth = Math.max(width - 130, 220);

  const latest = (data: { value: number }[]) =>
    data.length > 0 ? data[data.length - 1].value : null;

  return (
    <Card className="mb-4 border-border/80">
      <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      {loading ? (
        <View className="py-10 items-center">
          <Text className="text-sm text-text-tertiary">Loading {title.toLowerCase()}…</Text>
        </View>
      ) : error ? (
        <View className="py-8 items-center">
          <Ionicons name="cloud-offline-outline" size={24} color={colors.text.tertiary} />
          <Text className="text-sm text-text-secondary mt-2 text-center">
            Could not load {title.toLowerCase()}.
          </Text>
          <TouchableOpacity onPress={load} className="mt-2">
            <Text className="text-sm font-semibold text-primary">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !hasData ? (
        <View className="py-8 items-center">
          <View className="w-11 h-11 rounded-2xl bg-accent/10 items-center justify-center mb-2">
            <Ionicons name={emptyIcon} size={22} color={colors.accent.main} />
          </View>
          <Text className="text-sm text-text-secondary text-center leading-5">
            {emptyMessage ??
              `No ${title.toLowerCase()} recorded in this period. New readings appear here over time.`}
          </Text>
        </View>
      ) : (
        <View>
          <View className="flex-row flex-wrap gap-x-5 gap-y-1 mb-3">
            {series.map((s) => {
              const data = s.code === series[0]?.code ? primaryData : secondaryData;
              const value = latest(data);
              return (
                <View key={s.code} className="flex-row items-center">
                  <View
                    className="w-2.5 h-2.5 rounded-full mr-1.5"
                    style={{ backgroundColor: s.color }}
                  />
                  <Text className="text-xs text-text-secondary">
                    {s.label}
                    {value != null ? (
                      <Text className="font-semibold text-text"> {value} {unit}</Text>
                    ) : null}
                  </Text>
                </View>
              );
            })}
          </View>

          <View className="-ml-1">
            <LineChart
              data={primaryData}
              data2={series[1] ? secondaryData : undefined}
              width={chartWidth}
              adjustToWidth
              curved
              isAnimated
              animationDuration={600}
              thickness={2.5}
              color={series[0]?.color ?? colors.accent.main}
              color2={series[1]?.color ?? colors.accent.light}
              dataPointsColor={series[0]?.color ?? colors.accent.main}
              dataPointsColor2={series[1]?.color ?? colors.accent.light}
              dataPointsRadius={3.5}
              hideRules
              yAxisColor="transparent"
              xAxisColor={colors.border.light}
              yAxisTextStyle={{ color: colors.text.tertiary, fontSize: 10 }}
              noOfSections={4}
              maxValue={maxValue}
              initialSpacing={12}
              endSpacing={8}
              showReferenceLine1={referenceLines.length > 0}
              referenceLine1Position={referenceLines[0]?.value}
              referenceLine1Config={
                referenceLines[0]
                  ? {
                      color: referenceLines[0].color,
                      dashWidth: 4,
                      dashGap: 4,
                      thickness: 1,
                    }
                  : undefined
              }
              showReferenceLine2={referenceLines.length > 1}
              referenceLine2Position={referenceLines[1]?.value}
              referenceLine2Config={
                referenceLines[1]
                  ? {
                      color: referenceLines[1].color,
                      dashWidth: 4,
                      dashGap: 4,
                      thickness: 1,
                    }
                  : undefined
              }
              pointerConfig={{
                pointerStripColor: colors.border.medium,
                pointerStripWidth: 1,
                pointerColor: series[0]?.color ?? colors.accent.main,
                radius: 5,
                pointerLabelWidth: 110,
                pointerLabelHeight: 44,
                activatePointersOnLongPress: false,
                pointerLabelComponent: (items: any[]) => {
                  if (!items || items.length === 0) return null;
                  return (
                    <View className="px-2.5 py-1.5 rounded-xl bg-text shadow-sm">
                      {items.map((item, idx) => (
                        <Text
                          key={idx}
                          className="text-xs font-semibold text-white"
                        >
                          {item?.value} {unit}
                        </Text>
                      ))}
                    </View>
                  );
                },
              }}
            />
          </View>

          {referenceLines.length > 0 && (
            <View className="flex-row items-center justify-center mt-3 gap-4">
              {referenceLines.map((ref) => (
                <View key={ref.label} className="flex-row items-center">
                  <View
                    className="w-3 h-0.5 mr-1.5"
                    style={{ backgroundColor: ref.color }}
                  />
                  <Text className="text-xs text-text-tertiary">{ref.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );
};

export default VitalsTrendChart;
