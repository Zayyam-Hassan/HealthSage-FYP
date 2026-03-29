import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ConditionsTags from '@/components/ConditionsTags';
import FormInput from '@/components/FormInput';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import SectionHeader from '@/components/SectionHeader';
import Select from '@/components/Select';
import { authService } from '@/services/auth';
import { patientsService } from '@/services/patients';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';
import { hasValidationErrors, validatePatientForm } from '@/utils/patientValidation';

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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  }>({ visible: false, title: '', message: '' });
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

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUserRole(currentUser?.role ?? null);

        if (currentUser?.role !== 'patient') {
          setLoading(false);
          return;
        }

        const patient = await patientsService.getMyPatientProfile();
        setFormData({
          patient_id: patient.patient_id,
          age: patient.demographics.age ? String(patient.demographics.age) : '',
          gender: patient.demographics.gender,
          height_cm: patient.height_cm ? String(patient.height_cm) : '',
          weight_kg: patient.weight_kg ? String(patient.weight_kg) : '',
          lab_tests: {
            hba1c: patient.lab_tests?.hba1c ? String(patient.lab_tests.hba1c) : '',
            fasting_glucose: patient.lab_tests?.fasting_glucose
              ? String(patient.lab_tests.fasting_glucose)
              : '',
            glucose: patient.lab_tests?.glucose ? String(patient.lab_tests.glucose) : '',
            cholesterol: patient.lab_tests?.cholesterol
              ? String(patient.lab_tests.cholesterol)
              : '',
            hdl: patient.lab_tests?.hdl ? String(patient.lab_tests.hdl) : '',
            ldl: patient.lab_tests?.ldl ? String(patient.lab_tests.ldl) : '',
            triglycerides: patient.lab_tests?.triglycerides
              ? String(patient.lab_tests.triglycerides)
              : '',
            urea: patient.lab_tests?.urea ? String(patient.lab_tests.urea) : '',
            creatinine: patient.lab_tests?.creatinine
              ? String(patient.lab_tests.creatinine)
              : '',
          },
          vital_signs: {
            bmi: patient.vital_signs?.bmi ? String(patient.vital_signs.bmi) : '',
            systolic_bp: patient.vital_signs?.systolic_bp
              ? String(patient.vital_signs.systolic_bp)
              : '',
            diastolic_bp: patient.vital_signs?.diastolic_bp
              ? String(patient.vital_signs.diastolic_bp)
              : '',
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
  }, []);

  const progressLabel = useMemo(
    () => `${stepIndex + 1} / ${steps.length}`,
    [stepIndex],
  );

  const saveProfile = async () => {
    const validationErrors = validatePatientForm(formData);
    setErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      setDialog({
        visible: true,
        title: 'Please complete the form',
        message: 'A few fields still need attention before we can save your profile.',
      });
      return;
    }

    try {
      setSaving(true);
      await patientsService.updateMyClinicalProfile(formData);
      setDialog({
        visible: true,
        title: 'Profile updated',
        message: 'Your health profile has been saved and is ready for prediction.',
        actions: [
          { label: 'Stay here', onPress: () => {}, variant: 'secondary' },
          { label: 'Back to home', onPress: () => router.replace('/(tabs)' as any) },
        ],
      });
    } catch (error: any) {
      setDialog({
        visible: true,
        title: 'Unable to save profile',
        message: error.message || 'Please try again in a moment.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Health Assessment" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (userRole !== 'patient') {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Health Assessment" showBack />
        <View className="flex-1 justify-center px-6">
          <Card>
            <Text className="text-lg font-semibold text-text mb-2">
              Patient-only screen
            </Text>
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
        onClose={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <Header title="Health Assessment" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          <Card className="mb-6 bg-bg-secondary border-primary/12 shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
              Step {progressLabel}
            </Text>
            <Text className="text-2xl font-bold text-text mb-2 tracking-tight">
              {steps[stepIndex].title}
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              {steps[stepIndex].description}
            </Text>
            <View className="mt-5 h-2 rounded-full bg-white/80 border border-border/40 overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
              />
            </View>
          </Card>

          {stepIndex === 0 && (
            <Card className="mb-4 border-border/80">
              <SectionHeader title="Patient basics" />
              <FormInput
                label="Patient ID"
                value={formData.patient_id}
                onChangeText={(text) => setFormData({ ...formData, patient_id: text })}
                placeholder="Profile identifier"
                required
                error={errors.patient_id}
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormInput
                    label="Age"
                    value={String(formData.age ?? '')}
                    onChangeText={(text) => setFormData({ ...formData, age: text })}
                    placeholder="Age"
                    type="number"
                    required
                    error={errors.age}
                  />
                </View>
                <View className="flex-1">
                  <Select
                    label="Gender"
                    value={formData.gender}
                    options={['Male', 'Female', 'Other']}
                    onSelect={(value) =>
                      setFormData({
                        ...formData,
                        gender: value as 'Male' | 'Female' | 'Other',
                      })
                    }
                    required
                    error={errors.gender}
                  />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FormInput
                    label="Height (cm)"
                    value={String(formData.height_cm ?? '')}
                    onChangeText={(text) =>
                      setFormData({ ...formData, height_cm: text })
                    }
                    placeholder="170"
                    type="number"
                  />
                </View>
                <View className="flex-1">
                  <FormInput
                    label="Weight (kg)"
                    value={String(formData.weight_kg ?? '')}
                    onChangeText={(text) =>
                      setFormData({ ...formData, weight_kg: text })
                    }
                    placeholder="75"
                    type="number"
                  />
                </View>
              </View>
            </Card>
          )}

          {stepIndex === 1 && (
            <Card className="mb-4 border-border/80">
              <SectionHeader title="Prediction lab inputs" />
              <View className="flex-row flex-wrap justify-between">
                {[
                  ['hba1c', 'HbA1c (%)', '6.8'],
                  ['fasting_glucose', 'Fasting Glucose', '95'],
                  ['glucose', 'Random Glucose', '140'],
                  ['cholesterol', 'Total Cholesterol', '190'],
                  ['hdl', 'HDL', '48'],
                  ['ldl', 'LDL', '120'],
                  ['triglycerides', 'Triglycerides', '160'],
                  ['urea', 'Urea', '28'],
                  ['creatinine', 'Creatinine', '1.0'],
                ].map(([key, label, placeholder]) => (
                  <View className="w-[48%]" key={key}>
                    <FormInput
                      label={label}
                      value={String(
                        (formData.lab_tests as Record<string, string | number | undefined>)[
                          key
                        ] ?? '',
                      )}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          lab_tests: {
                            ...formData.lab_tests,
                            [key]: text,
                          },
                        })
                      }
                      placeholder={placeholder}
                      type="number"
                    />
                  </View>
                ))}
              </View>
            </Card>
          )}

          {stepIndex === 2 && (
            <>
              <Card className="mb-4 border-border/80">
                <SectionHeader title="Vitals" />
                <View className="flex-row flex-wrap justify-between">
                  {[
                    ['bmi', 'BMI', '27.5'],
                    ['systolic_bp', 'Systolic BP', '120'],
                    ['diastolic_bp', 'Diastolic BP', '80'],
                  ].map(([key, label, placeholder]) => (
                    <View className="w-[48%]" key={key}>
                      <FormInput
                        label={label}
                        value={String(
                          (formData.vital_signs as Record<
                            string,
                            string | number | undefined
                          >)[key] ?? '',
                        )}
                        onChangeText={(text) =>
                          setFormData({
                            ...formData,
                            vital_signs: {
                              ...formData.vital_signs,
                              [key]: text,
                            },
                          })
                        }
                        placeholder={placeholder}
                        type="number"
                      />
                    </View>
                  ))}
                </View>
              </Card>

              <Card className="mb-4 border-border/80">
                <SectionHeader title="Lifestyle" />
                <Select
                  label="Smoking"
                  value={formData.lifestyle?.smoking || ''}
                  options={['Never', 'Former', 'Occasionally', 'Regularly']}
                  onSelect={(value) =>
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, smoking: value },
                    })
                  }
                />
                <Select
                  label="Drinking"
                  value={formData.lifestyle?.drinking || ''}
                  options={['Never', 'Former', 'Occasionally', 'Regularly']}
                  onSelect={(value) =>
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, drinking: value },
                    })
                  }
                />
                <Select
                  label="Exercise"
                  value={formData.lifestyle?.exercise || ''}
                  options={['None', 'Light', 'Moderate', 'Heavy']}
                  onSelect={(value) =>
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, exercise: value },
                    })
                  }
                />
              </Card>

              <Card className="mb-4 border-border/80">
                <SectionHeader title="Conditions" />
                <ConditionsTags
                  label=""
                  conditions={formData.conditions}
                  onChange={(conditions) =>
                    setFormData({ ...formData, conditions })
                  }
                  error={errors.conditions}
                />
              </Card>
            </>
          )}

          <View className="flex-row mt-2">
            <Button
              variant="outline"
              className="flex-1 mr-2"
              onPress={() =>
                stepIndex === 0 ? router.back() : setStepIndex(stepIndex - 1)
              }
            >
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </Button>
            {stepIndex < steps.length - 1 ? (
              <Button
                className="flex-1"
                onPress={() => setStepIndex(stepIndex + 1)}
              >
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
