import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import SectionHeader from '@/components/SectionHeader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { patientsService, type Patient } from '@/services/patients';
import {
  treatmentService,
  type DoctorTreatmentPlan,
  type DoctorTreatmentPlanPayload,
} from '@/services/treatment';

type MedicationFormItem = {
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  timing_instructions: string;
  special_instructions: string;
};

type TreatmentPlanForm = {
  assessment: {
    diagnosis: string;
    clinical_impression: string;
    risk_assessment: string;
    treatment_goal: string;
    follow_up_note: string;
    rationale: string;
  };
  medications: MedicationFormItem[];
  lifestyle_plan: {
    diet_plan: string;
    exercise_plan: string;
    sleep_guidance: string;
    stress_guidance: string;
    monitoring_guidance: string;
    general_lifestyle_note: string;
  };
  doctor_note: string;
};

type DialogState = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm?: () => void | Promise<void>;
};

const emptyMedication = (): MedicationFormItem => ({
  medication_name: '',
  dosage: '',
  frequency: '',
  route: '',
  duration: '',
  timing_instructions: '',
  special_instructions: '',
});

const emptyForm = (): TreatmentPlanForm => ({
  assessment: {
    diagnosis: '',
    clinical_impression: '',
    risk_assessment: '',
    treatment_goal: '',
    follow_up_note: '',
    rationale: '',
  },
  medications: [emptyMedication()],
  lifestyle_plan: {
    diet_plan: '',
    exercise_plan: '',
    sleep_guidance: '',
    stress_guidance: '',
    monitoring_guidance: '',
    general_lifestyle_note: '',
  },
  doctor_note: '',
});

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

function getStatusVariant(status: string) {
  if (status === 'active') return 'success' as const;
  if (status === 'completed') return 'info' as const;
  return 'warning' as const;
}

function toForm(plan: DoctorTreatmentPlan | null): TreatmentPlanForm {
  if (!plan) return emptyForm();
  return {
    assessment: {
      diagnosis: plan.assessment.diagnosis ?? '',
      clinical_impression: plan.assessment.clinical_impression ?? '',
      risk_assessment: plan.assessment.risk_assessment ?? '',
      treatment_goal: plan.assessment.treatment_goal ?? '',
      follow_up_note: plan.assessment.follow_up_note ?? '',
      rationale: plan.assessment.rationale ?? '',
    },
    medications:
      plan.medications.length > 0
        ? plan.medications.map((item) => ({
            medication_name: item.medication_name,
            dosage: item.dosage,
            frequency: item.frequency,
            route: item.route,
            duration: item.duration,
            timing_instructions: item.timing_instructions,
            special_instructions: item.special_instructions ?? '',
          }))
        : [emptyMedication()],
    lifestyle_plan: {
      diet_plan: plan.lifestyle_plan.diet_plan ?? '',
      exercise_plan: plan.lifestyle_plan.exercise_plan ?? '',
      sleep_guidance: plan.lifestyle_plan.sleep_guidance ?? '',
      stress_guidance: plan.lifestyle_plan.stress_guidance ?? '',
      monitoring_guidance: plan.lifestyle_plan.monitoring_guidance ?? '',
      general_lifestyle_note: plan.lifestyle_plan.general_lifestyle_note ?? '',
    },
    doctor_note: plan.doctor_note ?? '',
  };
}

function hasAnyMedicationValue(item: MedicationFormItem) {
  return Object.values(item).some((value) => value.trim());
}

export default function PatientTreatmentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [plans, setPlans] = useState<DoctorTreatmentPlan[]>([]);
  const [form, setForm] = useState<TreatmentPlanForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({
    visible: false,
    title: '',
    message: '',
  });

  const activePlan = useMemo(
    () => plans.find((item) => item.status === 'active') ?? null,
    [plans],
  );
  const history = useMemo(
    () => plans.filter((item) => item.status !== 'active'),
    [plans],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await refreshUser();
      if (currentUser?.role !== 'doctor') {
        setError('Only doctor accounts can manage doctor-authored treatment plans.');
        return;
      }

      const patientId = String(id ?? '');
      const [patientRecord, plansRes] = await Promise.all([
        patientsService.getPatient(patientId),
        treatmentService.getDoctorTreatmentPlans(patientId),
      ]);

      setPatient(patientRecord);
      setPlans(plansRes.items);
      setForm(toForm(plansRes.items.find((item) => item.status === 'active') ?? null));
    } catch (err: any) {
      console.error('Failed to load doctor treatment plan screen:', err);
      setError(err.message || 'Unable to load doctor treatment plans.');
    } finally {
      setLoading(false);
    }
  }, [id, refreshUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const closeDialog = () =>
    setDialog({ visible: false, title: '', message: '', onConfirm: undefined });

  const setAssessmentField = (
    field: keyof TreatmentPlanForm['assessment'],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      assessment: {
        ...current.assessment,
        [field]: value,
      },
    }));
  };

  const setLifestyleField = (
    field: keyof TreatmentPlanForm['lifestyle_plan'],
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      lifestyle_plan: {
        ...current.lifestyle_plan,
        [field]: value,
      },
    }));
  };

  const setMedicationField = (
    index: number,
    field: keyof MedicationFormItem,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      medications: current.medications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addMedication = () => {
    setForm((current) => ({
      ...current,
      medications: [...current.medications, emptyMedication()],
    }));
  };

  const removeMedication = (index: number) => {
    setForm((current) => {
      const nextItems = current.medications.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        medications: nextItems.length > 0 ? nextItems : [emptyMedication()],
      };
    });
  };

  const buildPayload = (): DoctorTreatmentPlanPayload => ({
    assessment: {
      diagnosis: form.assessment.diagnosis.trim() || undefined,
      clinical_impression: form.assessment.clinical_impression.trim() || undefined,
      risk_assessment: form.assessment.risk_assessment.trim() || undefined,
      treatment_goal: form.assessment.treatment_goal.trim() || undefined,
      follow_up_note: form.assessment.follow_up_note.trim() || undefined,
      rationale: form.assessment.rationale.trim() || undefined,
    },
    medications: form.medications
      .filter(hasAnyMedicationValue)
      .map((item) => ({
        medication_name: item.medication_name.trim(),
        dosage: item.dosage.trim(),
        frequency: item.frequency.trim(),
        route: item.route.trim(),
        duration: item.duration.trim(),
        timing_instructions: item.timing_instructions.trim(),
        special_instructions: item.special_instructions.trim() || undefined,
      })),
    lifestyle_plan: {
      diet_plan: form.lifestyle_plan.diet_plan.trim() || undefined,
      exercise_plan: form.lifestyle_plan.exercise_plan.trim() || undefined,
      sleep_guidance: form.lifestyle_plan.sleep_guidance.trim() || undefined,
      stress_guidance: form.lifestyle_plan.stress_guidance.trim() || undefined,
      monitoring_guidance: form.lifestyle_plan.monitoring_guidance.trim() || undefined,
      general_lifestyle_note:
        form.lifestyle_plan.general_lifestyle_note.trim() || undefined,
    },
    doctor_note: form.doctor_note.trim() || undefined,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = buildPayload();
      if (activePlan) {
        await treatmentService.updateDoctorTreatmentPlan(activePlan.id, payload);
      } else {
        await treatmentService.createDoctorTreatmentPlan(String(id), payload);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to save the doctor treatment plan.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscontinue = () => {
    if (!activePlan) return;
    setDialog({
      visible: true,
      title: 'Discontinue Plan',
      message:
        'This will remove the current doctor-authored treatment plan from the active patient view while keeping it in history.',
      onConfirm: async () => {
        try {
          await treatmentService.discontinueDoctorTreatmentPlan(activePlan.id);
          await loadData();
        } catch (err: any) {
          setError(err.message || 'Unable to discontinue the treatment plan.');
        }
      },
    });
  };

  const confirmComplete = () => {
    if (!activePlan) return;
    setDialog({
      visible: true,
      title: 'Complete Plan',
      message:
        'This marks the active doctor-authored treatment plan as completed and keeps it in the patient history.',
      onConfirm: async () => {
        try {
          await treatmentService.completeDoctorTreatmentPlan(activePlan.id);
          await loadData();
        } catch (err: any) {
          setError(err.message || 'Unable to complete the treatment plan.');
        }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Doctor Treatment Plan" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (error && !patient) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Doctor Treatment Plan" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-secondary text-center">{error}</Text>
          <Button className="mt-4" variant="outline" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Doctor Treatment Plan" showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="px-6 pt-4">
          <Card className="mb-4 border-primary/12 bg-bg-secondary shadow-sm">
            <Text className="text-xs uppercase tracking-[1px] text-text-secondary mb-2">
              Patient context
            </Text>
            <Text className="text-xl font-bold text-text mb-1">
              {patient?.full_name ?? 'Assigned patient'}
            </Text>
            <Text className="text-sm text-text-secondary">
              {patient?.patient_id ?? 'Patient'}
              {patient ? ` • ${patient.demographics.age} years` : ''}
            </Text>
          </Card>

          {error ? (
            <View className="mb-4 rounded-xl bg-error/10 px-4 py-3">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          ) : null}

          <Card className="mb-4 border-border/90">
            <SectionHeader title="Current Active Plan" />
            {activePlan ? (
              <View>
                <View className="mb-3 flex-row items-center justify-between">
                  <Badge variant={getStatusVariant(activePlan.status)} size="sm">
                    {activePlan.status}
                  </Badge>
                  <Text className="text-xs text-text-secondary">
                    Updated {formatDateTime(activePlan.updated_at)}
                  </Text>
                </View>

                {activePlan.assessment.diagnosis ||
                activePlan.assessment.clinical_impression ||
                activePlan.assessment.risk_assessment ||
                activePlan.assessment.treatment_goal ||
                activePlan.assessment.follow_up_note ||
                activePlan.assessment.rationale ? (
                  <View className="mb-4 rounded-2xl bg-background px-4 py-4">
                    <Text className="text-base font-semibold text-text mb-3">Assessment</Text>
                    {[
                      ['Diagnosis', activePlan.assessment.diagnosis],
                      ['Clinical impression', activePlan.assessment.clinical_impression],
                      ['Risk assessment', activePlan.assessment.risk_assessment],
                      ['Treatment goal', activePlan.assessment.treatment_goal],
                      ['Follow-up note', activePlan.assessment.follow_up_note],
                      ['Rationale', activePlan.assessment.rationale],
                    ].map(([label, value]) =>
                      value ? (
                        <View key={label} className="mb-2">
                          <Text className="text-sm font-semibold text-text">{label}</Text>
                          <Text className="text-sm text-text-secondary leading-5">
                            {value}
                          </Text>
                        </View>
                      ) : null,
                    )}
                  </View>
                ) : null}

                {activePlan.medications.length > 0 ? (
                  <View className="mb-4 rounded-2xl bg-background px-4 py-4">
                    <Text className="text-base font-semibold text-text mb-3">Medications</Text>
                    {activePlan.medications.map((item) => (
                      <View key={item.id} className="mb-3">
                        <Text className="text-sm font-semibold text-text">
                          {item.medication_name}
                        </Text>
                        <Text className="text-sm text-text-secondary">
                          {item.dosage} • {item.frequency} • {item.route}
                        </Text>
                        <Text className="text-sm text-text-secondary">
                          {item.duration} • {item.timing_instructions}
                        </Text>
                        {item.special_instructions ? (
                          <Text className="text-sm text-text-secondary">
                            Note: {item.special_instructions}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {activePlan.lifestyle_plan.diet_plan ||
                activePlan.lifestyle_plan.exercise_plan ||
                activePlan.lifestyle_plan.sleep_guidance ||
                activePlan.lifestyle_plan.stress_guidance ||
                activePlan.lifestyle_plan.monitoring_guidance ||
                activePlan.lifestyle_plan.general_lifestyle_note ? (
                  <View className="mb-4 rounded-2xl bg-background px-4 py-4">
                    <Text className="text-base font-semibold text-text mb-3">
                      Lifestyle guidance
                    </Text>
                    {[
                      ['Diet', activePlan.lifestyle_plan.diet_plan],
                      ['Exercise', activePlan.lifestyle_plan.exercise_plan],
                      ['Sleep', activePlan.lifestyle_plan.sleep_guidance],
                      ['Stress', activePlan.lifestyle_plan.stress_guidance],
                      ['Monitoring', activePlan.lifestyle_plan.monitoring_guidance],
                      ['General note', activePlan.lifestyle_plan.general_lifestyle_note],
                    ].map(([label, value]) =>
                      value ? (
                        <View key={label} className="mb-2">
                          <Text className="text-sm font-semibold text-text">{label}</Text>
                          <Text className="text-sm text-text-secondary leading-5">
                            {value}
                          </Text>
                        </View>
                      ) : null,
                    )}
                  </View>
                ) : null}

                {activePlan.doctor_note ? (
                  <View className="mb-4 rounded-2xl bg-background px-4 py-4">
                    <Text className="text-base font-semibold text-text mb-2">
                      Doctor note
                    </Text>
                    <Text className="text-sm text-text-secondary leading-5">
                      {activePlan.doctor_note}
                    </Text>
                  </View>
                ) : null}

                <Button variant="outline" className="mb-3" onPress={confirmComplete}>
                  Mark Plan Complete
                </Button>
                <Button variant="outline" onPress={confirmDiscontinue}>
                  Discontinue Plan
                </Button>
              </View>
            ) : (
              <Text className="text-sm text-text-secondary leading-5">
                No active doctor-authored plan yet. Save one below and the patient dashboard plus chatbot will read from the same stored backend record.
              </Text>
            )}
          </Card>

          <Card className="mb-4 border-border/90">
            <SectionHeader title={activePlan ? 'Update Doctor Plan' : 'Create Doctor Plan'} />

            <Text className="text-sm font-semibold text-text mb-3">Assessment</Text>
            <FormInput
              label="Diagnosis"
              value={form.assessment.diagnosis}
              onChangeText={(text) => setAssessmentField('diagnosis', text)}
              placeholder="Type 2 Diabetes Mellitus"
              className="mb-3"
            />
            <FormInput
              label="Clinical impression"
              value={form.assessment.clinical_impression}
              onChangeText={(text) => setAssessmentField('clinical_impression', text)}
              placeholder="Poor glycemic control with elevated HbA1c"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Risk assessment"
              value={form.assessment.risk_assessment}
              onChangeText={(text) => setAssessmentField('risk_assessment', text)}
              placeholder="High risk"
              className="mb-3"
            />
            <FormInput
              label="Treatment goal"
              value={form.assessment.treatment_goal}
              onChangeText={(text) => setAssessmentField('treatment_goal', text)}
              placeholder="Reduce HbA1c and improve weight control"
              multiline
              numberOfLines={2}
              className="mb-3"
            />
            <FormInput
              label="Follow-up note"
              value={form.assessment.follow_up_note}
              onChangeText={(text) => setAssessmentField('follow_up_note', text)}
              placeholder="Review after 2 weeks"
              multiline
              numberOfLines={2}
              className="mb-3"
            />
            <FormInput
              label="Rationale"
              value={form.assessment.rationale}
              onChangeText={(text) => setAssessmentField('rationale', text)}
              placeholder="Patient has persistently elevated glucose and BMI."
              multiline
              numberOfLines={3}
              className="mb-4"
            />

            <Text className="text-sm font-semibold text-text mb-3">Medications</Text>
            {form.medications.map((item, index) => (
              <View key={`medication-${index}`} className="mb-4 rounded-2xl bg-background p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="text-base font-semibold text-text">
                    Medication {index + 1}
                  </Text>
                  <Button variant="text" size="sm" onPress={() => removeMedication(index)}>
                    Remove
                  </Button>
                </View>
                <FormInput
                  label="Medication name"
                  value={item.medication_name}
                  onChangeText={(text) => setMedicationField(index, 'medication_name', text)}
                  placeholder="Metformin"
                  className="mb-3"
                />
                <FormInput
                  label="Dosage / strength"
                  value={item.dosage}
                  onChangeText={(text) => setMedicationField(index, 'dosage', text)}
                  placeholder="500 mg"
                  className="mb-3"
                />
                <FormInput
                  label="Frequency"
                  value={item.frequency}
                  onChangeText={(text) => setMedicationField(index, 'frequency', text)}
                  placeholder="Twice daily"
                  className="mb-3"
                />
                <FormInput
                  label="Route"
                  value={item.route}
                  onChangeText={(text) => setMedicationField(index, 'route', text)}
                  placeholder="Oral"
                  className="mb-3"
                />
                <FormInput
                  label="Duration"
                  value={item.duration}
                  onChangeText={(text) => setMedicationField(index, 'duration', text)}
                  placeholder="30 days"
                  className="mb-3"
                />
                <FormInput
                  label="Timing instructions"
                  value={item.timing_instructions}
                  onChangeText={(text) =>
                    setMedicationField(index, 'timing_instructions', text)
                  }
                  placeholder="After meals"
                  className="mb-3"
                />
                <FormInput
                  label="Special instructions"
                  value={item.special_instructions}
                  onChangeText={(text) =>
                    setMedicationField(index, 'special_instructions', text)
                  }
                  placeholder="Monitor GI symptoms"
                  multiline
                  numberOfLines={2}
                />
              </View>
            ))}

            <Button variant="outline" className="mb-4" onPress={addMedication}>
              Add Medication
            </Button>

            <Text className="text-sm font-semibold text-text mb-3">Lifestyle guidance</Text>
            <FormInput
              label="Diet guidance"
              value={form.lifestyle_plan.diet_plan}
              onChangeText={(text) => setLifestyleField('diet_plan', text)}
              placeholder="Reduce refined sugar and portion size"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Exercise guidance"
              value={form.lifestyle_plan.exercise_plan}
              onChangeText={(text) => setLifestyleField('exercise_plan', text)}
              placeholder="30 minutes brisk walk daily"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Sleep guidance"
              value={form.lifestyle_plan.sleep_guidance}
              onChangeText={(text) => setLifestyleField('sleep_guidance', text)}
              placeholder="Maintain 7 to 8 hours of sleep"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Stress guidance"
              value={form.lifestyle_plan.stress_guidance}
              onChangeText={(text) => setLifestyleField('stress_guidance', text)}
              placeholder="Reduce stress triggers and sedentary routine"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Monitoring guidance"
              value={form.lifestyle_plan.monitoring_guidance}
              onChangeText={(text) => setLifestyleField('monitoring_guidance', text)}
              placeholder="Check fasting glucose twice weekly"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="General lifestyle note"
              value={form.lifestyle_plan.general_lifestyle_note}
              onChangeText={(text) => setLifestyleField('general_lifestyle_note', text)}
              placeholder="Focus on consistency over intensity"
              multiline
              numberOfLines={3}
              className="mb-4"
            />

            <FormInput
              label="Doctor note"
              value={form.doctor_note}
              onChangeText={(text) =>
                setForm((current) => ({ ...current, doctor_note: text }))
              }
              placeholder="Escalate therapy if HbA1c remains high"
              multiline
              numberOfLines={3}
              className="mb-4"
            />

            <Button
              variant="outline"
              className="mb-3"
              onPress={() => router.push(`/patients/${String(id)}/compare-plan` as any)}
              disabled={!activePlan}
            >
              Compare With Model
            </Button>
            <Button onPress={handleSave} loading={saving}>
              {activePlan ? 'Update Doctor Treatment Plan' : 'Save Doctor Treatment Plan'}
            </Button>
          </Card>

          {history.length > 0 ? (
            <View className="mb-4">
              <SectionHeader title="Plan History" />
              {history.map((plan) => (
                <Card key={plan.id} className="mb-3 border-border/90">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-text">
                      {plan.assessment.diagnosis || 'Doctor treatment plan'}
                    </Text>
                    <Badge variant={getStatusVariant(plan.status)} size="sm">
                      {plan.status}
                    </Badge>
                  </View>
                  <Text className="text-sm text-text-secondary leading-5">
                    {plan.assessment.treatment_goal ||
                      plan.doctor_note ||
                      'Structured doctor-authored treatment record'}
                  </Text>
                  <Text className="mt-3 text-xs text-text-secondary">
                    Updated {formatDateTime(plan.updated_at)}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={closeDialog}
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => {},
          },
          {
            label: 'Confirm',
            variant: 'primary',
            onPress: () => {
              const action = dialog.onConfirm;
              if (action) {
                void action();
              }
            },
          },
        ]}
      />
    </SafeAreaView>
  );
}
