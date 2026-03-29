import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import SectionHeader from '@/components/SectionHeader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { chatbotService } from '@/services/chatbot';
import { patientsService, type Patient } from '@/services/patients';
import { treatmentService, type DoctorTreatmentPlan } from '@/services/treatment';

type CompareAgentOutputs = {
  risk?: {
    risk_score?: number;
    risk_label?: string;
  };
  medication?: {
    data?: {
      primary_option?: { drug_name?: string };
      alternatives?: { drug_name?: string }[];
    };
  };
  lifestyle?: {
    data?: {
      plan?: Record<string, Array<string | { text?: string }>>;
    };
  };
  comparison?: {
    medication_diff?: {
      doctor_plan?: string[];
      model_primary?: string;
      model_alternatives?: string[];
      difference_summary?: string;
    };
    lifestyle_diff?: {
      doctor_plan?: string[];
      model_plan?: string[];
      difference_summary?: string;
    };
    doctor_note?: string;
  };
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getRiskVariant(label?: string) {
  const normalized = String(label || '').toLowerCase();
  if (normalized === 'high') return 'error' as const;
  if (normalized === 'medium') return 'warning' as const;
  if (normalized === 'low') return 'success' as const;
  return 'info' as const;
}

function extractLifestyleItems(plan: DoctorTreatmentPlan | null): string[] {
  if (!plan) return [];
  return [
    plan.lifestyle_plan.diet_plan,
    plan.lifestyle_plan.exercise_plan,
    plan.lifestyle_plan.sleep_guidance,
    plan.lifestyle_plan.stress_guidance,
    plan.lifestyle_plan.monitoring_guidance,
    plan.lifestyle_plan.general_lifestyle_note,
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function extractModelLifestyleItems(outputs: CompareAgentOutputs | null): string[] {
  const plan = outputs?.lifestyle?.data?.plan || {};
  const items: string[] = [];
  for (const key of ['diet', 'activity', 'sleep', 'other']) {
    for (const item of plan[key] || []) {
      if (typeof item === 'string' && item.trim()) {
        items.push(item.trim());
      } else if (item && typeof item === 'object' && item.text?.trim()) {
        items.push(item.text.trim());
      }
    }
  }
  return items;
}

export default function CompareDoctorPlanScreen() {
  const { id } = useLocalSearchParams();
  const patientId = String(id ?? '');
  const { refreshUser } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [activePlan, setActivePlan] = useState<DoctorTreatmentPlan | null>(null);
  const [outputs, setOutputs] = useState<CompareAgentOutputs | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelLifestyleItems = useMemo(() => extractModelLifestyleItems(outputs), [outputs]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await refreshUser();
      if (currentUser?.role !== 'doctor') {
        setError('Only doctor accounts can compare the doctor plan against model output.');
        return;
      }

      const [patientRecord, activePlanRes] = await Promise.all([
        patientsService.getPatient(patientId),
        treatmentService.getDoctorActiveTreatmentSummary(patientId),
      ]);

      setPatient(patientRecord);
      setActivePlan(activePlanRes.item);
    } catch (err: any) {
      console.error('Failed to load comparison screen:', err);
      setError(err.message || 'Unable to load doctor plan comparison.');
    } finally {
      setLoading(false);
    }
  }, [patientId, refreshUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runComparison = async () => {
    if (!activePlan) {
      setError('Save an active doctor treatment plan before running comparison.');
      return;
    }

    try {
      setRunning(true);
      setError(null);
      const response = await chatbotService.chat({
        patient_id: patientId,
        doctor_query: 'Compare the stored doctor-authored treatment plan with the current model outputs for this patient.',
        mode: 'compare',
        subject: 'Doctor plan comparison',
        start_new: true,
        doctor_assessment: {
          diagnosis: activePlan.assessment.diagnosis ?? undefined,
          planned_medications: activePlan.medications
            .map((item) => item.medication_name)
            .filter(Boolean),
          planned_lifestyle: extractLifestyleItems(activePlan),
        },
      });

      const agentOutputs = (response.response.agent_outputs || {}) as CompareAgentOutputs;
      setOutputs(agentOutputs);
      setSummary(
        response.response.detailed_message ||
          response.response.final_message ||
          response.response.summary_message ||
          null,
      );
    } catch (err: any) {
      console.error('Failed to run doctor plan comparison:', err);
      setError(err.message || 'Unable to run comparison right now.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Compare Doctor Plan" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Compare Doctor Plan" showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="px-6 pt-4">
          <Card className="mb-4 border border-primary/20 bg-primary/5">
            <Text className="text-xs uppercase tracking-[1px] text-text-secondary mb-2">
              Patient context
            </Text>
            <Text className="text-xl font-bold text-text mb-1">
              {patient?.full_name ?? 'Assigned patient'}
            </Text>
            <Text className="text-sm text-text-secondary">
              {activePlan
                ? `Active doctor plan updated ${formatDateTime(activePlan.updated_at)}`
                : 'No active doctor-authored treatment plan saved yet'}
            </Text>
          </Card>

          {error ? (
            <View className="mb-4 rounded-xl bg-error/10 px-4 py-3">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          ) : null}

          <Card className="mb-4 border border-border">
            <SectionHeader title="Doctor Plan Snapshot" />
            {!activePlan ? (
              <Text className="text-sm text-text-secondary leading-5">
                Save an active doctor treatment plan first, then use the comparison button to reflect it against the current model outputs.
              </Text>
            ) : (
              <View>
                {activePlan.assessment.diagnosis ? (
                  <View className="mb-3">
                    <Text className="text-sm font-semibold text-text">Diagnosis</Text>
                    <Text className="text-sm text-text-secondary leading-5">
                      {activePlan.assessment.diagnosis}
                    </Text>
                  </View>
                ) : null}
                {activePlan.assessment.treatment_goal ? (
                  <View className="mb-3">
                    <Text className="text-sm font-semibold text-text">Treatment goal</Text>
                    <Text className="text-sm text-text-secondary leading-5">
                      {activePlan.assessment.treatment_goal}
                    </Text>
                  </View>
                ) : null}
                <View className="mb-3">
                  <Text className="text-sm font-semibold text-text mb-2">Planned medications</Text>
                  {activePlan.medications.length === 0 ? (
                    <Text className="text-sm text-text-secondary">No medications in the active plan.</Text>
                  ) : (
                    activePlan.medications.map((item) => (
                      <Text key={item.id} className="text-sm text-text-secondary mb-1">
                        • {item.medication_name}
                      </Text>
                    ))
                  )}
                </View>
                <View>
                  <Text className="text-sm font-semibold text-text mb-2">Lifestyle guidance</Text>
                  {extractLifestyleItems(activePlan).length === 0 ? (
                    <Text className="text-sm text-text-secondary">
                      No lifestyle guidance in the active plan.
                    </Text>
                  ) : (
                    extractLifestyleItems(activePlan).map((item, index) => (
                      <Text key={`${item}-${index}`} className="text-sm text-text-secondary mb-1">
                        • {item}
                      </Text>
                    ))
                  )}
                </View>
              </View>
            )}
          </Card>

          <Button
            variant="primary"
            className="mb-4"
            onPress={runComparison}
            disabled={!activePlan}
            loading={running}
          >
            Run Comparison
          </Button>

          {outputs ? (
            <>
              <Card className="mb-4 border border-border">
                <SectionHeader title="Model Snapshot" />
                {outputs.risk?.risk_score !== undefined ? (
                  <View className="mb-3 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-text">Risk</Text>
                    <Badge variant={getRiskVariant(outputs.risk?.risk_label)} size="sm">
                      {`${outputs.risk?.risk_label || 'unknown'} ${
                        outputs.risk?.risk_score !== undefined
                          ? `(${outputs.risk.risk_score.toFixed(2)})`
                          : ''
                      }`}
                    </Badge>
                  </View>
                ) : null}
                <View className="mb-3">
                  <Text className="text-sm font-semibold text-text mb-2">Model medication output</Text>
                  {outputs.medication?.data?.primary_option?.drug_name ? (
                    <Text className="text-sm text-text-secondary mb-1">
                      Primary: {outputs.medication.data.primary_option.drug_name}
                    </Text>
                  ) : (
                    <Text className="text-sm text-text-secondary mb-1">
                      No primary medication option returned.
                    </Text>
                  )}
                  {(outputs.medication?.data?.alternatives || []).map((item, index) => (
                    <Text
                      key={`${item.drug_name || 'alt'}-${index}`}
                      className="text-sm text-text-secondary mb-1"
                    >
                      Alternative: {item.drug_name}
                    </Text>
                  ))}
                </View>
                <View>
                  <Text className="text-sm font-semibold text-text mb-2">
                    Model lifestyle output
                  </Text>
                  {modelLifestyleItems.length === 0 ? (
                    <Text className="text-sm text-text-secondary">
                      No lifestyle output returned.
                    </Text>
                  ) : (
                    modelLifestyleItems.slice(0, 8).map((item, index) => (
                      <Text key={`${item}-${index}`} className="text-sm text-text-secondary mb-1">
                        • {item}
                      </Text>
                    ))
                  )}
                </View>
              </Card>

              <Card className="mb-4 border border-border">
                <SectionHeader title="Comparison Result" />
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-text mb-2">Medication comparison</Text>
                  <Text className="text-sm text-text-secondary leading-5">
                    {outputs.comparison?.medication_diff?.difference_summary ||
                      'No medication comparison summary available.'}
                  </Text>
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-text mb-2">Lifestyle comparison</Text>
                  <Text className="text-sm text-text-secondary leading-5">
                    {outputs.comparison?.lifestyle_diff?.difference_summary ||
                      'No lifestyle comparison summary available.'}
                  </Text>
                </View>
                {outputs.comparison?.doctor_note ? (
                  <View>
                    <Text className="text-sm font-semibold text-text mb-2">Comparison note</Text>
                    <Text className="text-sm text-text-secondary leading-5">
                      {outputs.comparison.doctor_note}
                    </Text>
                  </View>
                ) : null}
              </Card>

              {summary ? (
                <Card className="mb-4 border border-border">
                  <SectionHeader title="Detailed Summary" />
                  <Text className="text-sm text-text-secondary leading-6">{summary}</Text>
                </Card>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
