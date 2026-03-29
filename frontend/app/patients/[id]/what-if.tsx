import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Input from '@/components/Input';
import SectionHeader from '@/components/SectionHeader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { patientsService, type Patient } from '@/services/patients';
import {
  whatIfService,
  type WhatIfBaselineResponse,
  type WhatIfCompareResponse,
  type WhatIfFeatureField,
} from '@/services/whatIf';

function riskVariant(label?: string) {
  const normalized = String(label ?? '').toLowerCase();
  if (normalized === 'high') return 'error' as const;
  if (normalized === 'medium') return 'warning' as const;
  return 'success' as const;
}

function formatPercent(score?: number | null) {
  return `${Math.round((score ?? 0) * 100)}%`;
}

function valueToString(value: unknown) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function formatFieldValue(value: unknown, unit?: string | null) {
  if (value === undefined || value === null || value === '') {
    return 'Not recorded';
  }
  return unit ? `${value} ${unit}` : String(value);
}

function buildChatbotPrompt(result: WhatIfCompareResponse) {
  const scenarioName = result.scenario_name || 'What-if scenario';
  const changedFeatures =
    result.changes.length > 0
      ? result.changes
          .map(
            (change) =>
              `${change.label}: ${formatFieldValue(change.baseline_value, change.unit)} to ${formatFieldValue(
                change.scenario_value,
                change.unit,
              )}`,
          )
          .join('; ')
      : 'No feature changes were recorded.';

  return [
    `Review this diabetes risk what-if analysis for clinician discussion.`,
    `Scenario: ${scenarioName}.`,
    `Baseline risk: ${result.baseline.risk_label} (${result.baseline.risk_score}).`,
    `Scenario risk: ${result.scenario.risk_label} (${result.scenario.risk_score}).`,
    `Risk delta: ${result.risk_delta.absolute} (${result.risk_delta.relative_percent}% ${result.risk_delta.direction}).`,
    `Changed features: ${changedFeatures}.`,
    `Use the comparison and patient context to explain what likely changed and what cautions the clinician should keep in mind.`,
  ].join(' ');
}

function buildInitialValues(fields: WhatIfFeatureField[]) {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.field] = valueToString(field.baseline_value);
    return acc;
  }, {});
}

function compareValue(field: WhatIfFeatureField, nextValue: string) {
  if (field.input_type === 'text') {
    return nextValue.trim();
  }
  return Number(nextValue);
}

function areEqualValues(field: WhatIfFeatureField, nextValue: string) {
  const baseline = field.baseline_value;
  if (field.input_type === 'text') {
    return String(baseline ?? '').trim().toLowerCase() === nextValue.trim().toLowerCase();
  }
  if (nextValue.trim() === '' && (baseline === undefined || baseline === null || baseline === '')) {
    return true;
  }
  const nextNumeric = Number(nextValue);
  const baselineNumeric = Number(baseline);
  if (!Number.isFinite(nextNumeric) || !Number.isFinite(baselineNumeric)) {
    return false;
  }
  return Math.abs(nextNumeric - baselineNumeric) < 0.0001;
}

export default function PatientWhatIfScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [baseline, setBaseline] = useState<WhatIfBaselineResponse | null>(null);
  const [result, setResult] = useState<WhatIfCompareResponse | null>(null);
  const [history, setHistory] = useState<
    Array<{ id: string; createdAt: string; scenario: WhatIfCompareResponse }>
  >([]);
  const [scenarioName, setScenarioName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const { dialog, hideDialog, showDialog } = useAppDialog();

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      try {
        const [patientData, baselineData] = await Promise.all([
          patientsService.getPatient(id as string),
          whatIfService.getBaseline(id as string),
        ]);

        if (cancelled) return;
        setPatient(patientData);
        setBaseline(baselineData);
        setValues(buildInitialValues(baselineData.modifiable_fields));
      } catch (error: unknown) {
        if (!cancelled) {
          showDialog('What-if unavailable', formatApiError(error, 'Unable to load the what-if workspace.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, id, showDialog]);

  const changedCount = useMemo(() => {
    if (!baseline) return 0;
    return baseline.modifiable_fields.filter((field) => !areEqualValues(field, values[field.field] ?? '')).length;
  }, [baseline, values]);

  const resetToBaseline = () => {
    if (!baseline) return;
    setValues(buildInitialValues(baseline.modifiable_fields));
    setFieldErrors({});
    setScenarioName('');
  };

  const runScenario = async () => {
    if (!baseline) return;

    const nextErrors: Record<string, string> = {};
    const modifications: Record<string, unknown> = {};

    baseline.modifiable_fields.forEach((field) => {
      const value = values[field.field] ?? '';
      if (areEqualValues(field, value)) {
        return;
      }

      if (value.trim() === '') {
        nextErrors[field.field] = 'Enter a value or reset to baseline.';
        return;
      }

      if (field.input_type === 'number') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          nextErrors[field.field] = 'Enter a valid number.';
          return;
        }
        if (typeof field.min_value === 'number' && numeric < field.min_value) {
          nextErrors[field.field] = `Minimum ${field.min_value}`;
          return;
        }
        if (typeof field.max_value === 'number' && numeric > field.max_value) {
          nextErrors[field.field] = `Maximum ${field.max_value}`;
          return;
        }
      }

      modifications[field.field] = compareValue(field, value);
    });

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      showDialog('Check scenario values', 'Fix the highlighted fields before running the analysis.');
      return;
    }

    if (Object.keys(modifications).length === 0) {
      showDialog(
        'No changes detected',
        'Adjust at least one feature from the patient’s current metrics to run a what-if scenario.',
      );
      return;
    }

    try {
      setRunning(true);
      const response = await whatIfService.compareRisk(id as string, {
        scenario_name: scenarioName.trim() || undefined,
        modifications,
      });
      setResult(response);
      setHistory((current) => [
        {
          id: `${Date.now()}`,
          createdAt: new Date().toISOString(),
          scenario: response,
        },
        ...current,
      ]);
    } catch (error: unknown) {
      showDialog('Analysis failed', formatApiError(error, 'Unable to run the scenario right now.'));
    } finally {
      setRunning(false);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="What-If Analysis" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (role !== 'doctor') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="What-If Analysis" showBack />
        <View className="flex-1 justify-center px-6">
          <Card>
            <Text className="text-lg font-semibold text-text mb-2">Doctor-only analysis</Text>
            <Text className="text-sm text-text-secondary leading-6">
              What-if risk analysis is restricted to doctor and admin accounts because it runs a clinician-facing scenario simulation.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const baselineRisk = baseline?.baseline;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={hideDialog}
      />
      <Header title="What-If Analysis" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-4">
          <Card className="mb-5 bg-primary/5 border border-primary/20">
            <Text className="text-2xl font-bold text-text mb-2">
              {patient?.full_name || baseline?.patient_name || 'Patient'} scenario workspace
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              Modify model-linked features, rerun the real GraphSAGE risk pipeline, and review the baseline-versus-scenario change before discussing it in the chatbot.
            </Text>
          </Card>

          {baselineRisk ? (
            <Card className="mb-5">
              <SectionHeader title="Baseline Risk" />
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text className="text-4xl font-bold text-text">{formatPercent(baselineRisk.risk_score)}</Text>
                  <Text className="text-sm text-text-secondary mt-1">
                    Current recalculated model risk for this patient
                  </Text>
                </View>
                <Badge variant={riskVariant(baselineRisk.risk_label)} size="md">
                  {baselineRisk.risk_label.toUpperCase()}
                </Badge>
              </View>
              <View className="flex-row flex-wrap">
                {baseline.modifiable_fields.slice(0, 6).map((field) => (
                  <View
                    key={field.field}
                    className="mr-2 mb-2 px-3 py-2 rounded-xl bg-bg-secondary border border-border"
                  >
                    <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary">
                      {field.label}
                    </Text>
                    <Text className="text-sm font-semibold text-text mt-1">
                      {formatFieldValue(field.baseline_value, field.unit)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card className="mb-5">
            <SectionHeader title="Scenario Setup" />
            <Input
              label="Scenario name"
              placeholder="Improved glycemic control"
              value={scenarioName}
              onChangeText={setScenarioName}
              helperText="Optional label for the comparison card and chatbot handoff."
            />

            {baseline?.modifiable_fields.map((field) => (
              <View key={field.field} className="mb-2">
                <Input
                  label={field.unit ? `${field.label} (${field.unit})` : field.label}
                  placeholder={valueToString(field.baseline_value) || 'Enter scenario value'}
                  value={values[field.field] ?? ''}
                  onChangeText={(text) =>
                    setValues((current) => ({
                      ...current,
                      [field.field]: text,
                    }))
                  }
                  type={field.input_type === 'number' ? 'number' : 'text'}
                  error={fieldErrors[field.field]}
                  helperText={`Current patient metric: ${formatFieldValue(field.baseline_value, field.unit)}`}
                />
              </View>
            ))}

            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-sm text-text-secondary">
                {changedCount} feature{changedCount === 1 ? '' : 's'} changed from current patient metrics
              </Text>
              <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary">
                Simulation only
              </Text>
            </View>

            <Button onPress={runScenario} loading={running} fullWidth className="mb-3">
              Run What-If Analysis
            </Button>
            <Button variant="outline" onPress={resetToBaseline} fullWidth>
              Reset to Patient Metrics
            </Button>
          </Card>

          {result ? (
            <>
              <Card className="mb-5">
                <SectionHeader title="Comparison" />
                <View className="flex-row items-start justify-between mb-4">
                  <View className="flex-1 mr-3">
                    <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary mb-1">
                      Baseline
                    </Text>
                    <Text className="text-3xl font-bold text-text mb-2">
                      {formatPercent(result.baseline.risk_score)}
                    </Text>
                    <Badge variant={riskVariant(result.baseline.risk_label)} size="sm">
                      {result.baseline.risk_label.toUpperCase()}
                    </Badge>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary mb-1">
                      Scenario
                    </Text>
                    <Text className="text-3xl font-bold text-text mb-2">
                      {formatPercent(result.scenario.risk_score)}
                    </Text>
                    <Badge variant={riskVariant(result.scenario.risk_label)} size="sm">
                      {result.scenario.risk_label.toUpperCase()}
                    </Badge>
                  </View>
                </View>
                <View className="px-4 py-3 rounded-2xl bg-bg-secondary border border-border">
                  <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary mb-1">
                    Risk delta
                  </Text>
                  <Text className="text-base font-semibold text-text">
                    {result.risk_delta.absolute > 0 ? '+' : ''}
                    {result.risk_delta.absolute.toFixed(2)} ({result.risk_delta.relative_percent}%)
                  </Text>
                  <Text className="text-sm text-text-secondary mt-1">
                    Direction: {result.risk_delta.direction.replace('_', ' ')}
                  </Text>
                </View>
              </Card>

              <Card className="mb-5">
                <SectionHeader title="Changed Features" />
                {result.changes.map((change) => (
                  <View
                    key={change.feature}
                    className="py-3 border-b border-border last:border-b-0"
                  >
                    <Text className="text-sm font-semibold text-text mb-1">{change.label}</Text>
                    <Text className="text-sm text-text-secondary">
                      {formatFieldValue(change.baseline_value, change.unit)} {'->'}{' '}
                      {formatFieldValue(change.scenario_value, change.unit)}
                    </Text>
                  </View>
                ))}
              </Card>

              <Card className="mb-5">
                <SectionHeader title="Clinical Interpretation" />
                <Text className="text-sm text-text-secondary leading-6 mb-4">
                  {result.analysis.summary}
                </Text>
                <Text className="text-sm text-text leading-6 mb-4">
                  {result.analysis.clinical_interpretation}
                </Text>

                {result.analysis.drivers.length > 0 ? (
                  <View className="mb-4">
                    <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary mb-2">
                      Likely drivers
                    </Text>
                    {result.analysis.drivers.map((driver, index) => (
                      <Text key={`${driver}-${index}`} className="text-sm text-text-secondary leading-6 mb-2">
                        - {driver}
                      </Text>
                    ))}
                  </View>
                ) : null}

                {result.analysis.cautions.length > 0 ? (
                  <View>
                    <Text className="text-xs uppercase tracking-[0.8px] text-text-secondary mb-2">
                      Cautions
                    </Text>
                    {result.analysis.cautions.map((caution, index) => (
                      <Text key={`${caution}-${index}`} className="text-sm text-text-secondary leading-6 mb-2">
                        - {caution}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Card>

              {history.length > 1 ? (
                <Card className="mb-5">
                  <SectionHeader title="Previous Simulations" />
                  {history.slice(1).map((entry) => (
                    <TouchableOpacity
                      key={entry.id}
                      activeOpacity={0.85}
                      onPress={() => setResult(entry.scenario)}
                      className="py-3 border-b border-border last:border-b-0"
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-sm font-semibold text-text">
                          {entry.scenario.scenario_name || 'What-if scenario'}
                        </Text>
                        <Badge variant={riskVariant(entry.scenario.scenario.risk_label)} size="sm">
                          {entry.scenario.scenario.risk_label.toUpperCase()}
                        </Badge>
                      </View>
                      <Text className="text-sm text-text-secondary">
                        {formatPercent(entry.scenario.baseline.risk_score)} {'->'}{' '}
                        {formatPercent(entry.scenario.scenario.risk_score)} |{' '}
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Card>
              ) : null}

              <Button
                variant="outline"
                fullWidth
                onPress={() =>
                  router.push({
                    pathname: '/chatbot',
                    params: {
                      patientId: patient?.id || baseline?.patient_id || '',
                      seedPrompt: buildChatbotPrompt(result),
                      autoSend: '1',
                    },
                  } as any)
                }
              >
                Continue in Chatbot
              </Button>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
