import React, { useMemo, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Button from '@/components/Button';
import SuccessPopup from '@/components/SuccessPopup';
import { PatientFormValues, PatientFormErrors } from '@/interfaces/patient';
import { validatePatientForm, hasValidationErrors } from '@/utils/patientValidation';
import { ClinicalProfileForm } from '@/src/features/patients/forms/ClinicalProfileForm';
import { createClinicalFormHandlers } from '@/src/features/patients/forms/clinicalFormHandlers';

export default function NewPatientScreen() {
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
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handlers = useMemo(() => createClinicalFormHandlers(setFormData, setErrors), []);

  const handleSave = async () => {
    const validationErrors = validatePatientForm(formData);
    setErrors(validationErrors);

    if (hasValidationErrors(validationErrors)) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      const { patientsService } = await import('@/services/patients');
      const patient = await patientsService.createPatient(formData);

      setSuccessMessage(`${patient.full_name || patient.patient_id} added successfully.`);
      setShowSuccessPopup(true);
    } catch (error: any) {
      console.error('Error creating patient:', error);
      Alert.alert('Error', error.message || 'Failed to create patient. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Add New Patient" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <ClinicalProfileForm mode="create" formData={formData} errors={errors} handlers={handlers} />

          <Button variant="primary" onPress={handleSave} fullWidth className="mt-6">
            Save Patient
          </Button>
        </View>
      </ScrollView>

      <SuccessPopup
        visible={showSuccessPopup}
        message={successMessage}
        onClose={() => {
          setShowSuccessPopup(false);
          router.back();
        }}
        duration={3000}
      />
    </SafeAreaView>
  );
}
