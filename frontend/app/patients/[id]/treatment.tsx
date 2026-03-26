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
import Loader from '@/components/Loader';
import SectionHeader from '@/components/SectionHeader';
import { authService } from '@/services/auth';
import { patientsService, type Patient } from '@/services/patients';
import {
  treatmentService,
  type LifestylePlan,
  type LifestylePlanPayload,
  type Prescription,
  type PrescriptionPayload,
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

type DialogState = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
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

const emptyLifestyleForm: LifestylePlanPayload = {
  diet_plan: '',
  exercise_plan: '',
  sleep_guidance: '',
  stress_guidance: '',
  monitoring_guidance: '',
  follow_up_note: '',
  general_note: '',
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

function getStatusVariant(status: string) {
  if (status === 'active') return 'success' as const;
  if (status === 'completed') return 'info' as const;
  return 'warning' as const;
}

function toPrescriptionForm(prescription: Prescription | null) {
  if (!prescription) {
    return {
      diagnosis_context: '',
      general_note: '',
      medications: [emptyMedication()],
    };
  }

  return {
    diagnosis_context: prescription.diagnosis_context ?? '',
    general_note: prescription.general_note ?? '',
    medications:
      prescription.medications.length > 0
        ? prescription.medications.map((item) => ({
            medication_name: item.medication_name,
            dosage: item.dosage,
            frequency: item.frequency,
            route: item.route,
            duration: item.duration,
            timing_instructions: item.timing_instructions,
            special_instructions: item.special_instructions ?? '',
          }))
        : [emptyMedication()],
  };
}

function toLifestyleForm(plan: LifestylePlan | null): LifestylePlanPayload {
  if (!plan) {
    return { ...emptyLifestyleForm };
  }

  return {
    diet_plan: plan.diet_plan ?? '',
    exercise_plan: plan.exercise_plan ?? '',
    sleep_guidance: plan.sleep_guidance ?? '',
    stress_guidance: plan.stress_guidance ?? '',
    monitoring_guidance: plan.monitoring_guidance ?? '',
    follow_up_note: plan.follow_up_note ?? '',
    general_note: plan.general_note ?? '',
  };
}

export default function PatientTreatmentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [plans, setPlans] = useState<LifestylePlan[]>([]);
  const [prescriptionForm, setPrescriptionForm] = useState(toPrescriptionForm(null));
  const [lifestyleForm, setLifestyleForm] =
    useState<LifestylePlanPayload>(emptyLifestyleForm);
  const [loading, setLoading] = useState(true);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [savingLifestyle, setSavingLifestyle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({
    visible: false,
    title: '',
    message: '',
  });

  const activePrescription = useMemo(
    () => prescriptions.find((item) => item.status === 'active') ?? null,
    [prescriptions],
  );
  const activeLifestylePlan = useMemo(
    () => plans.find((item) => item.status === 'active') ?? null,
    [plans],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const currentUser = await authService.getCurrentUser();
      const currentRole = currentUser?.role ?? null;

      if (currentRole !== 'doctor') {
        setError('Only doctor accounts can manage treatment plans.');
        return;
      }

      const patientId = String(id ?? '');
      const [patientRecord, prescriptionRes, planRes] = await Promise.all([
        patientsService.getPatient(patientId),
        treatmentService.getDoctorPatientPrescriptions(patientId),
        treatmentService.getDoctorPatientLifestylePlans(patientId),
      ]);

      setPatient(patientRecord);
      setPrescriptions(prescriptionRes.items);
      setPlans(planRes.items);

      const nextActivePrescription =
        prescriptionRes.items.find((item) => item.status === 'active') ?? null;
      const nextActivePlan =
        planRes.items.find((item) => item.status === 'active') ?? null;

      setPrescriptionForm(toPrescriptionForm(nextActivePrescription));
      setLifestyleForm(toLifestyleForm(nextActivePlan));
    } catch (err: any) {
      console.error('Failed to load treatment screen:', err);
      setError(err.message || 'Unable to load treatment plans.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setMedicationField = (
    index: number,
    field: keyof MedicationFormItem,
    value: string,
  ) => {
    setPrescriptionForm((current) => ({
      ...current,
      medications: current.medications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const addMedication = () => {
    setPrescriptionForm((current) => ({
      ...current,
      medications: [...current.medications, emptyMedication()],
    }));
  };

  const removeMedication = (index: number) => {
    setPrescriptionForm((current) => {
      const nextItems = current.medications.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        medications: nextItems.length > 0 ? nextItems : [emptyMedication()],
      };
    });
  };

  const closeDialog = () =>
    setDialog({ visible: false, title: '', message: '', onConfirm: undefined });

  const handleSavePrescription = async () => {
    try {
      setSavingPrescription(true);
      setError(null);
      const payload: PrescriptionPayload = {
        diagnosis_context: prescriptionForm.diagnosis_context?.trim(),
        general_note: prescriptionForm.general_note?.trim(),
        medications: prescriptionForm.medications.map((item) => ({
          medication_name: item.medication_name.trim(),
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          route: item.route.trim(),
          duration: item.duration.trim(),
          timing_instructions: item.timing_instructions.trim(),
          special_instructions: item.special_instructions.trim() || undefined,
        })),
      };

      if (activePrescription) {
        await treatmentService.updateDoctorPrescription(activePrescription.id, payload);
      } else {
        await treatmentService.createDoctorPrescription(String(id), payload);
      }

      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to save prescription.');
    } finally {
      setSavingPrescription(false);
    }
  };

  const handleSaveLifestylePlan = async () => {
    try {
      setSavingLifestyle(true);
      setError(null);
      const payload: LifestylePlanPayload = {
        diet_plan: lifestyleForm.diet_plan?.trim(),
        exercise_plan: lifestyleForm.exercise_plan?.trim(),
        sleep_guidance: lifestyleForm.sleep_guidance?.trim(),
        stress_guidance: lifestyleForm.stress_guidance?.trim(),
        monitoring_guidance: lifestyleForm.monitoring_guidance?.trim(),
        follow_up_note: lifestyleForm.follow_up_note?.trim(),
        general_note: lifestyleForm.general_note?.trim(),
      };

      if (activeLifestylePlan) {
        await treatmentService.updateDoctorLifestylePlan(activeLifestylePlan.id, payload);
      } else {
        await treatmentService.createDoctorLifestylePlan(String(id), payload);
      }

      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to save lifestyle plan.');
    } finally {
      setSavingLifestyle(false);
    }
  };

  const confirmDiscontinuePrescription = () => {
    if (!activePrescription) return;
    setDialog({
      visible: true,
      title: 'Discontinue Prescription',
      message:
        'This will move the current prescription out of the active patient view. The history will remain visible.',
      onConfirm: async () => {
        try {
          await treatmentService.discontinueDoctorPrescription(activePrescription.id);
          await loadData();
        } catch (err: any) {
          setError(err.message || 'Unable to discontinue prescription.');
        }
      },
    });
  };

  const confirmDiscontinueLifestylePlan = () => {
    if (!activeLifestylePlan) return;
    setDialog({
      visible: true,
      title: 'Discontinue Lifestyle Plan',
      message:
        'This will remove the current lifestyle plan from the active patient dashboard while keeping the record in history.',
      onConfirm: async () => {
        try {
          await treatmentService.discontinueDoctorLifestylePlan(activeLifestylePlan.id);
          await loadData();
        } catch (err: any) {
          setError(err.message || 'Unable to discontinue lifestyle plan.');
        }
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Treatment Plan" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !patient) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Treatment Plan" showBack />
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
      <Header title="Treatment Plan" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-4">
          <Card className="mb-4 border border-primary/20 bg-primary/5">
            <Text className="text-xs uppercase tracking-[1px] text-text-secondary mb-2">
              Patient context
            </Text>
            <Text className="text-xl font-bold text-text mb-1">
              {patient?.full_name ?? 'Assigned patient'}
            </Text>
            <Text className="text-sm text-text-secondary">
              {patient?.patient_id ?? 'Patient'}{patient ? ` • ${patient.demographics.age} years` : ''}
            </Text>
          </Card>

          {error ? (
            <View className="mb-4 rounded-xl bg-error/10 px-4 py-3">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          ) : null}

          <Card className="mb-4 border border-border">
            <SectionHeader title="Active Prescription" />
            {activePrescription ? (
              <View>
                <View className="mb-3 flex-row items-center justify-between">
                  <Badge variant={getStatusVariant(activePrescription.status)} size="sm">
                    {activePrescription.status}
                  </Badge>
                  <Text className="text-xs text-text-secondary">
                    Updated {formatDateTime(activePrescription.updated_at)}
                  </Text>
                </View>
                {activePrescription.medications.map((item) => (
                  <View key={item.id} className="mb-3 rounded-2xl bg-background px-4 py-3">
                    <Text className="text-base font-semibold text-text">
                      {item.medication_name}
                    </Text>
                    <Text className="mt-1 text-sm text-text-secondary">
                      {item.dosage} • {item.frequency} • {item.route}
                    </Text>
                    <Text className="mt-1 text-sm text-text-secondary">
                      {item.duration} • {item.timing_instructions}
                    </Text>
                    {item.special_instructions ? (
                      <Text className="mt-1 text-sm text-text-secondary">
                        Note: {item.special_instructions}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {activePrescription.general_note ? (
                  <Text className="text-sm leading-6 text-text-secondary">
                    {activePrescription.general_note}
                  </Text>
                ) : null}
                <Button
                  variant="outline"
                  className="mt-4"
                  onPress={confirmDiscontinuePrescription}
                >
                  Discontinue Prescription
                </Button>
              </View>
            ) : (
              <Text className="text-sm text-text-secondary">
                No active prescription yet. Save one below and it will appear on the patient dashboard immediately.
              </Text>
            )}
          </Card>

          <Card className="mb-4 border border-border">
            <SectionHeader title={activePrescription ? 'Update Prescription' : 'Create Prescription'} />
            <FormInput
              label="Diagnosis context"
              value={prescriptionForm.diagnosis_context}
              onChangeText={(text) =>
                setPrescriptionForm((current) => ({ ...current, diagnosis_context: text }))
              }
              placeholder="Type 2 diabetes follow-up"
              className="mb-3"
            />
            <FormInput
              label="Doctor note"
              value={prescriptionForm.general_note}
              onChangeText={(text) =>
                setPrescriptionForm((current) => ({ ...current, general_note: text }))
              }
              placeholder="Overall treatment note"
              multiline
              numberOfLines={3}
              className="mb-4"
            />
            {prescriptionForm.medications.map((item, index) => (
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
                  numberOfLines={3}
                />
              </View>
            ))}
            <Button variant="outline" onPress={addMedication}>
              Add medication
            </Button>
            <Button
              className="mt-3"
              onPress={handleSavePrescription}
              loading={savingPrescription}
            >
              {activePrescription ? 'Update prescription' : 'Save prescription'}
            </Button>
          </Card>

          <Card className="mb-4 border border-border">
            <SectionHeader title="Active Lifestyle Plan" />
            {activeLifestylePlan ? (
              <View>
                <View className="mb-3 flex-row items-center justify-between">
                  <Badge variant={getStatusVariant(activeLifestylePlan.status)} size="sm">
                    {activeLifestylePlan.status}
                  </Badge>
                  <Text className="text-xs text-text-secondary">
                    Updated {formatDateTime(activeLifestylePlan.updated_at)}
                  </Text>
                </View>
                {[
                  ['Diet guidance', activeLifestylePlan.diet_plan],
                  ['Exercise guidance', activeLifestylePlan.exercise_plan],
                  ['Sleep guidance', activeLifestylePlan.sleep_guidance],
                  ['Stress guidance', activeLifestylePlan.stress_guidance],
                  ['Monitoring guidance', activeLifestylePlan.monitoring_guidance],
                  ['Follow-up note', activeLifestylePlan.follow_up_note],
                  ['General note', activeLifestylePlan.general_note],
                ].map(([label, value]) =>
                  value ? (
                    <View key={label} className="mb-3 rounded-2xl bg-background px-4 py-3">
                      <Text className="text-sm font-semibold text-text">{label}</Text>
                      <Text className="mt-1 text-sm leading-6 text-text-secondary">
                        {value}
                      </Text>
                    </View>
                  ) : null,
                )}
                <Button
                  variant="outline"
                  className="mt-2"
                  onPress={confirmDiscontinueLifestylePlan}
                >
                  Discontinue Lifestyle Plan
                </Button>
              </View>
            ) : (
              <Text className="text-sm text-text-secondary">
                No active lifestyle guidance yet. Save one below and the patient will see it right away.
              </Text>
            )}
          </Card>

          <Card className="mb-4 border border-border">
            <SectionHeader
              title={activeLifestylePlan ? 'Update Lifestyle Plan' : 'Create Lifestyle Plan'}
            />
            <FormInput
              label="Diet guidance"
              value={lifestyleForm.diet_plan ?? ''}
              onChangeText={(text) => setLifestyleForm((current) => ({ ...current, diet_plan: text }))}
              placeholder="Low sugar, high fiber meal guidance"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Exercise guidance"
              value={lifestyleForm.exercise_plan ?? ''}
              onChangeText={(text) =>
                setLifestyleForm((current) => ({ ...current, exercise_plan: text }))
              }
              placeholder="30 minutes brisk walk five times weekly"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Sleep guidance"
              value={lifestyleForm.sleep_guidance ?? ''}
              onChangeText={(text) =>
                setLifestyleForm((current) => ({ ...current, sleep_guidance: text }))
              }
              placeholder="Aim for a stable 7 to 8 hour sleep routine"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Stress / routine guidance"
              value={lifestyleForm.stress_guidance ?? ''}
              onChangeText={(text) =>
                setLifestyleForm((current) => ({ ...current, stress_guidance: text }))
              }
              placeholder="Keep meal timing consistent and reduce late-night stressors"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Monitoring guidance"
              value={lifestyleForm.monitoring_guidance ?? ''}
              onChangeText={(text) =>
                setLifestyleForm((current) => ({
                  ...current,
                  monitoring_guidance: text,
                }))
              }
              placeholder="Check fasting glucose three mornings per week"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="Follow-up note"
              value={lifestyleForm.follow_up_note ?? ''}
              onChangeText={(text) =>
                setLifestyleForm((current) => ({ ...current, follow_up_note: text }))
              }
              placeholder="Review readings in two weeks"
              multiline
              numberOfLines={3}
              className="mb-3"
            />
            <FormInput
              label="General note"
              value={lifestyleForm.general_note ?? ''}
              onChangeText={(text) =>
                setLifestyleForm((current) => ({ ...current, general_note: text }))
              }
              placeholder="Additional care guidance"
              multiline
              numberOfLines={3}
            />
            <Button
              className="mt-4"
              onPress={handleSaveLifestylePlan}
              loading={savingLifestyle}
            >
              {activeLifestylePlan ? 'Update lifestyle plan' : 'Save lifestyle plan'}
            </Button>
          </Card>

          <Card className="mb-4 border border-border">
            <SectionHeader title="Treatment History" />
            {[...prescriptions.filter((item) => item.status !== 'active'), ...plans.filter((item) => item.status !== 'active')].length === 0 ? (
              <Text className="text-sm text-text-secondary">
                Older discontinued or completed treatment records will appear here.
              </Text>
            ) : (
              <View>
                {prescriptions
                  .filter((item) => item.status !== 'active')
                  .map((item) => (
                    <View key={item.id} className="mb-3 rounded-2xl bg-background px-4 py-3">
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-text">Prescription</Text>
                        <Badge variant={getStatusVariant(item.status)} size="sm">
                          {item.status}
                        </Badge>
                      </View>
                      <Text className="text-sm text-text-secondary">
                        {item.medications.map((medication) => medication.medication_name).join(', ')}
                      </Text>
                      <Text className="mt-1 text-xs text-text-secondary">
                        Updated {formatDateTime(item.updated_at)}
                      </Text>
                    </View>
                  ))}
                {plans
                  .filter((item) => item.status !== 'active')
                  .map((item) => (
                    <View key={item.id} className="mb-3 rounded-2xl bg-background px-4 py-3">
                      <View className="mb-2 flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-text">Lifestyle plan</Text>
                        <Badge variant={getStatusVariant(item.status)} size="sm">
                          {item.status}
                        </Badge>
                      </View>
                      <Text className="text-sm text-text-secondary">
                        {item.follow_up_note || item.general_note || 'Lifestyle guidance record'}
                      </Text>
                      <Text className="mt-1 text-xs text-text-secondary">
                        Updated {formatDateTime(item.updated_at)}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </Card>
        </View>
      </ScrollView>

      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={closeDialog}
        actions={[
          {
            label: 'Keep active',
            variant: 'secondary',
            onPress: () => undefined,
          },
          {
            label: 'Confirm',
            variant: 'primary',
            onPress: () => dialog.onConfirm?.(),
          },
        ]}
      />
    </SafeAreaView>
  );
}
