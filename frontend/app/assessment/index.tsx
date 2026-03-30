import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Button from '@/components/Button';
import Card from '@/components/Card';
import MedicalReportHeader from '@/components/MedicalReportHeader';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { patientsService } from '@/services/patients';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';
import { hasValidationErrors, validatePatientForm } from '@/utils/patientValidation';
import {
  bmiFromHeightWeight,
  createClinicalFormHandlers,
} from '@/src/features/patients/forms/clinicalFormHandlers';
import { DemographicsSection } from '@/src/features/patients/forms/sections/DemographicsSection';
import { LabTestsSection } from '@/src/features/patients/forms/sections/LabTestsSection';
import { VitalsSection } from '@/src/features/patients/forms/sections/VitalsSection';
import { LifestyleSection } from '@/src/features/patients/forms/sections/LifestyleSection';
import { ConditionsSection } from '@/src/features/patients/forms/sections/ConditionsSection';

const steps = [
  {
    id: 'basics',
    title: 'Basics',
    description: 'Core identity and body measurements used by the model.',
  },
  {
    id: 'labs',
    title: 'Lab values',
    description: 'Glucose and lipid values that strongly influence prediction.',
  },
  {
    id: 'lifestyle',
    title: 'Vitals and lifestyle',
    description: 'Blood pressure, BMI, daily habits, and conditions.',
  },
] as const;

export default function AssessmentScreen() {
  const router = useRouter();
  const { role: userRole, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const { dialog, hideDialog, showDialog } = useAppDialog();
  const [formData, setFormData] = useState<PatientFormValues>({
    patient_id: '',
    age: '',
    gender: '',
    height_cm: '',
    weight_kg: '',
    lab_tests: {},
    vital_signs: {},
    lifestyle: {},
    conditions: [],
  });

  const handlers = useMemo(() => createClinicalFormHandlers(setFormData, setErrors), []);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        if (userRole !== 'patient') {
          setLoading(false);
          return;
        }

        const patient = await patientsService.getMyPatientProfile();
        const hStr = patient.height_cm ? String(patient.height_cm) : '';
        const wStr = patient.weight_kg ? String(patient.weight_kg) : '';
        const autoBmi = bmiFromHeightWeight(hStr, wStr);
        const bmiStr =
          autoBmi ||
          (patient.vital_signs?.bmi != null ? String(patient.vital_signs.bmi) : '');
        setFormData({
          patient_id: patient.patient_id,
          age: patient.demographics.age ? String(patient.demographics.age) : '',
          gender: patient.demographics.gender,
          height_cm: hStr,
          weight_kg: wStr,
          lab_tests: {
            hba1c: patient.lab_tests?.hba1c ? String(patient.lab_tests.hba1c) : '',
            fasting_glucose: patient.lab_tests?.fasting_glucose
              ? String(patient.lab_tests.fasting_glucose)
              : '',
            glucose: patient.lab_tests?.glucose ? String(patient.lab_tests.glucose) : '',
            cholesterol: patient.lab_tests?.cholesterol ? String(patient.lab_tests.cholesterol) : '',
            hdl: patient.lab_tests?.hdl ? String(patient.lab_tests.hdl) : '',
            ldl: patient.lab_tests?.ldl ? String(patient.lab_tests.ldl) : '',
            triglycerides: patient.lab_tests?.triglycerides
              ? String(patient.lab_tests.triglycerides)
              : '',
            urea: patient.lab_tests?.urea ? String(patient.lab_tests.urea) : '',
            creatinine: patient.lab_tests?.creatinine ? String(patient.lab_tests.creatinine) : '',
          },
          vital_signs: {
            bmi: bmiStr,
            systolic_bp: patient.vital_signs?.systolic_bp ? String(patient.vital_signs.systolic_bp) : '',
            diastolic_bp: patient.vital_signs?.diastolic_bp ? String(patient.vital_signs.diastolic_bp) : '',
          },
          lifestyle: {
            smoking: patient.lifestyle?.smoking || '',
            drinking: patient.lifestyle?.drinking || '',
            exercise: patient.lifestyle?.exercise || '',
          },
          conditions: patient.conditions ?? [],
        });
      } catch (error) {
        console.error('Failed to load patient assessment:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, userRole]);

  const progressLabel = useMemo(() => `${stepIndex + 1} / ${steps.length}`, [stepIndex]);

  const saveProfile = async () => {
    const validationErrors = validatePatientForm(formData);
    setErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      showDialog(
        'Please complete the form',
        'A few fields still need attention before we can save your profile.',
      );
      return;
    }

    try {
      setSaving(true);
      await patientsService.updateMyClinicalProfile(formData);
      showDialog('Profile updated', 'Your health profile has been saved and is ready for prediction.', [
        { label: 'Stay here', onPress: () => {}, variant: 'secondary' },
        { label: 'Back to home', onPress: () => router.replace('/(tabs)' as any) },
      ]);
    } catch (error: unknown) {
      showDialog('Unable to save profile', formatApiError(error, 'Please try again in a moment.'));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <MedicalReportHeader title="Health Assessment" onBack={() => router.back()} />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (userRole !== 'patient') {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <MedicalReportHeader title="Health Assessment" onBack={() => router.back()} />
        <View className="flex-1 justify-center px-6">
          <Card>
            <Text className="text-lg font-semibold text-text mb-2">Patient-only screen</Text>
            <Text className="text-sm text-text-secondary leading-5 mb-4">
              This form updates the patient health profile used for prediction and doctor review.
            </Text>
            <Button onPress={() => router.push('/patients' as any)} fullWidth>
              Go to patients
            </Button>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <MedicalReportHeader title="Health Assessment" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          <View className="mb-6 overflow-hidden rounded-2xl border border-white/25 bg-coral shadow-sm">
            <View className="px-5 pt-5 pb-4">
              <Text className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                Step {progressLabel}
              </Text>
              <Text className="mb-2 text-2xl font-bold tracking-tight text-white">
                {steps[stepIndex].title}
              </Text>
              <Text className="text-sm leading-6 text-white/90">{steps[stepIndex].description}</Text>
              <View className="mt-5 h-2 overflow-hidden rounded-full bg-white/25">
                <View
                  className="h-full rounded-full bg-white"
                  style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                />
              </View>
            </View>
          </View>

          {stepIndex === 0 && (
            <DemographicsSection
              mode="self-assessment"
              formData={formData}
              errors={errors}
              handlers={handlers}
            />
          )}

          {stepIndex === 1 && (
            <LabTestsSection
              variant="self-assessment"
              formData={formData}
              errors={errors}
              handlers={handlers}
              className="mb-4 border-border/80"
            />
          )}

          {stepIndex === 2 && (
            <>
              <VitalsSection
                formData={formData}
                errors={errors}
                handlers={handlers}
                className="mb-4 border-border/80"
                bmiLabelStyle="unicode"
              />
              <LifestyleSection
                variant="self-assessment"
                formData={formData}
                errors={errors}
                handlers={handlers}
                className="mb-4 border-border/80"
              />
              <ConditionsSection
                formData={formData}
                errors={errors}
                handlers={handlers}
                className="mb-4 border-border/80"
              />
            </>
          )}

          <View className="flex-row mt-2">
            <Button
              variant="outline"
              className="flex-1 mr-2"
              onPress={() => (stepIndex === 0 ? router.back() : setStepIndex(stepIndex - 1))}
            >
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button className="flex-1" onPress={() => setStepIndex(stepIndex + 1)}>
                Next
              </Button>
            ) : (
              <Button className="flex-1" onPress={saveProfile} loading={saving}>
                Save profile
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
