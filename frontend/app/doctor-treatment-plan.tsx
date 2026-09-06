import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { useFocusedPolling } from '@/src/shared/hooks/useFocusedPolling';
import {
  isTreatmentNotificationType,
  subscribeNotificationEvents,
} from '@/src/shared/services/notificationEvents';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { treatmentService, type DoctorTreatmentPlan } from '@/services/treatment';
import { colors } from '@/constants/colors';

type PlanTab = 'diagnosis' | 'medication' | 'lifestyle';

const TABS: { key: PlanTab; label: string }[] = [
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'medication', label: 'Medication' },
  { key: 'lifestyle', label: 'Lifestyle' },
];
const TREATMENT_REFRESH_MS = 15_000;

function FieldBlock({ title, body }: { title: string; body: string | null | undefined }) {
  const t = (body ?? '').trim();
  if (!t) return null;
  return (
    <View className="mb-4">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {title}
      </Text>
      <Text className="text-sm leading-6 text-text">{t}</Text>
    </View>
  );
}

export default function PatientDoctorTreatmentPlanScreen() {
  const isFocused = useIsFocused();
  const { role, isLoading: authLoading, user } = useAuth();
  const patientNameSubtitle = user?.display_name?.trim() || undefined;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DoctorTreatmentPlan | null>(null);
  const [tab, setTab] = useState<PlanTab>('diagnosis');

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await treatmentService.getPatientActiveDoctorTreatmentPlan();
      setPlan(res.item);
    } catch (e: unknown) {
      setError(formatApiError(e, 'Could not load your treatment plan.'));
      setPlan(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (role !== 'patient') {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [authLoading, role, load]);

  useFocusEffect(
    React.useCallback(() => {
      if (role === 'patient') {
        void load();
      }
    }, [load, role]),
  );

  useFocusedPolling(() => load(), TREATMENT_REFRESH_MS, !authLoading && role === 'patient');

  useEffect(() => {
    if (!isFocused || authLoading || role !== 'patient') {
      return undefined;
    }

    return subscribeNotificationEvents((event) => {
      if (event.kind !== 'received' || !isTreatmentNotificationType(event.type)) {
        return;
      }

      void load().catch(() => undefined);
    });
  }, [authLoading, isFocused, load, role]);

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header
          variant="coral"
          title="Treatment plan"
          subtitle={patientNameSubtitle}
          showBack
        />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (role !== 'patient') {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header variant="coral" title="Treatment plan" showBack />
        <View className="flex-1 justify-center px-6">
          <Text className="text-center text-text-secondary">
            This view is for patient accounts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header
        variant="coral"
        title="Treatment plan"
        subtitle={patientNameSubtitle}
        showBack
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          {error ? (
            <Card className="mb-4 border-error/30 bg-error/5">
              <Text className="text-sm text-error">{error}</Text>
            </Card>
          ) : null}

          {!plan ? (
            <Card className="border-border/80">
              <Text className="text-center text-base font-semibold text-text">
                No active treatment plan yet
              </Text>
              <Text className="mt-2 text-center text-sm leading-6 text-text-secondary">
                When your doctor saves an active treatment plan for you, it will appear here.
              </Text>
            </Card>
          ) : (
            <>
              <View className="mb-4 overflow-hidden rounded-2xl border border-white/25 bg-coral shadow-sm">
                <View className="px-5 pt-4 pb-4">
                  <View className="mb-2 flex-row flex-wrap items-center justify-between gap-2">
                    <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                      Your care
                    </Text>
                    <Text className="rounded-full bg-white/25 px-3 py-1 text-xs font-bold uppercase text-white">
                      {plan.status}
                    </Text>
                  </View>
                  <Text className="text-xl font-bold tracking-tight text-white">From your doctor</Text>
                  {plan.doctor_name ? (
                    <Text className="mt-1 text-sm text-white/90">Dr. {plan.doctor_name}</Text>
                  ) : null}
                </View>
              </View>

              <View
                className="mb-4 flex-row rounded-[20px] border border-coral-soft bg-white p-1"
                accessibilityRole="tablist"
              >
                {TABS.map(({ key, label }) => {
                  const active = tab === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setTab(key)}
                      activeOpacity={0.85}
                      className={`min-w-0 flex-1 rounded-2xl py-2.5 ${
                        active ? 'bg-coral-soft' : ''
                      }`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        className={`text-center text-xs font-bold ${
                          active ? 'text-coral-ink' : 'text-text-secondary'
                        }`}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {tab === 'diagnosis' ? (
                <Card className="border-border/80">
                  <FieldBlock title="Diagnosis" body={plan.assessment.diagnosis} />
                  <FieldBlock title="Clinical impression" body={plan.assessment.clinical_impression} />
                  <FieldBlock title="Risk assessment" body={plan.assessment.risk_assessment} />
                  <FieldBlock title="Treatment goal" body={plan.assessment.treatment_goal} />
                  <FieldBlock title="Follow-up" body={plan.assessment.follow_up_note} />
                  <FieldBlock title="Rationale" body={plan.assessment.rationale} />
                  {plan.doctor_note ? (
                    <View className="mt-2 border-t border-border/50 pt-4">
                      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Doctor note
                      </Text>
                      <Text className="text-sm leading-6 text-text">{plan.doctor_note}</Text>
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {tab === 'medication' ? (
                <Card className="border-border/80">
                  {plan.medications.length === 0 ? (
                    <Text className="text-center text-sm text-text-secondary">
                      No medications listed on this plan.
                    </Text>
                  ) : (
                    plan.medications.map((m) => (
                      <View
                        key={m.id}
                        className="mb-4 border-b border-border/50 pb-4 last:mb-0 last:border-b-0 last:pb-0"
                      >
                        <Text className="text-base font-semibold text-text">{m.medication_name}</Text>
                        <Text className="mt-1 text-sm text-text-secondary">
                          {m.dosage} · {m.frequency} · {m.route}
                          {m.duration ? ` · ${m.duration}` : ''}
                        </Text>
                        {m.timing_instructions ? (
                          <Text className="mt-2 text-sm leading-5 text-text">{m.timing_instructions}</Text>
                        ) : null}
                        {m.special_instructions ? (
                          <Text className="mt-1 text-sm leading-5 text-text-secondary">
                            {m.special_instructions}
                          </Text>
                        ) : null}
                      </View>
                    ))
                  )}
                </Card>
              ) : null}

              {tab === 'lifestyle' ? (
                <Card className="border-border/80">
                  <FieldBlock title="Diet" body={plan.lifestyle_plan.diet_plan} />
                  <FieldBlock title="Exercise" body={plan.lifestyle_plan.exercise_plan} />
                  <FieldBlock title="Sleep" body={plan.lifestyle_plan.sleep_guidance} />
                  <FieldBlock title="Stress" body={plan.lifestyle_plan.stress_guidance} />
                  <FieldBlock title="Monitoring" body={plan.lifestyle_plan.monitoring_guidance} />
                  <FieldBlock title="Notes" body={plan.lifestyle_plan.general_lifestyle_note} />
                </Card>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
