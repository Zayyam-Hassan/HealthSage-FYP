import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { PatientFormValues, PatientFormErrors } from '@/interfaces/patient';
import { validatePatientForm, hasValidationErrors } from '@/utils/patientValidation';
import { ClinicalProfileForm } from '@/src/features/patients/forms/ClinicalProfileForm';
import { createClinicalFormHandlers } from '@/src/features/patients/forms/clinicalFormHandlers';

export default function EditPatientScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [formData, setFormData] = useState<PatientFormValues>({
    patient_id: '',
    age: '',
    gender: '',
    lab_tests: {},
    vital_signs: {},
    lifestyle: {},
    conditions: [],
  });

  const [errors, setErrors] = useState<PatientFormErrors>({});

  const handlers = useMemo(() => createClinicalFormHandlers(setFormData, setErrors), []);

  useEffect(() => {
    loadPatient();
  }, [id]);

  const loadPatient = async () => {
    if (!id) return;

    try {
      const { patientsService } = await import('@/services/patients');
      const patientData = await patientsService.getPatient(id as string);

      setFormData({
        patient_id: patientData.patient_id,
        age: patientData.demographics.age.toString(),
        gender: patientData.demographics.gender,
        lab_tests: {
          hba1c: patientData.lab_tests?.hba1c?.toString() || '',
          glucose: patientData.lab_tests?.glucose?.toString() || '',
          cholesterol: patientData.lab_tests?.cholesterol?.toString() || '',
          hdl: patientData.lab_tests?.hdl?.toString() || '',
          ldl: patientData.lab_tests?.ldl?.toString() || '',
          triglycerides: patientData.lab_tests?.triglycerides?.toString() || '',
          urea: patientData.lab_tests?.urea?.toString() || '',
          creatinine: patientData.lab_tests?.creatinine?.toString() || '',
        },
        vital_signs: {
          bmi: patientData.vital_signs?.bmi?.toString() || '',
          systolic_bp: patientData.vital_signs?.systolic_bp?.toString() || '',
          diastolic_bp: patientData.vital_signs?.diastolic_bp?.toString() || '',
        },
        lifestyle: {
          smoking: patientData.lifestyle?.smoking || '',
          drinking: patientData.lifestyle?.drinking || '',
          exercise: patientData.lifestyle?.exercise || '',
        },
        conditions: patientData.conditions || [],
      });
    } catch (error: any) {
      console.error('Error loading patient:', error);
      Alert.alert('Error', 'Failed to load patient data');
    }
  };

  const handleSave = async () => {
    const validationErrors = validatePatientForm(formData);
    setErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      const { patientsService } = await import('@/services/patients');
      await patientsService.updatePatient(id as string, formData);

      Alert.alert('Success', `Patient ${formData.patient_id} updated successfully`, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Error updating patient:', error);
      Alert.alert('Error', error.message || 'Failed to update patient. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header variant="coral" title="Edit Patient" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <Card className="mb-4 bg-bg-secondary border-primary/12 shadow-sm">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">Record</Text>
            <Text className="text-base font-semibold text-text leading-6">Edit clinical profile</Text>
            <Text className="text-sm text-text-secondary mt-1 leading-5">
              Changes apply to risk tools, reports, and care team views. Required fields are marked below.
            </Text>
          </Card>

          <ClinicalProfileForm mode="edit" formData={formData} errors={errors} handlers={handlers} />

          <Button variant="primary" onPress={handleSave} fullWidth className="mt-6">
            Save Changes
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
