import React, { useState } from 'react';
import { View, ScrollView, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import Select from '@/components/Select';
import ConditionsTags from '@/components/ConditionsTags';
import SectionHeader from '@/components/SectionHeader';
import SuccessPopup from '@/components/SuccessPopup';
import { PatientFormValues, PatientFormErrors } from '@/interfaces/patient';
import { validatePatientForm, hasValidationErrors } from '@/utils/patientValidation';

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
      
      // Show cute success popup
      setSuccessMessage(`${patient.full_name || patient.patient_id} added successfully.`);
      setShowSuccessPopup(true);
    } catch (error: any) {
      console.error('Error creating patient:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to create patient. Please try again.'
      );
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
          {/* Patient Basic Info - Required */}
          <Card className="border-border/80">
            <SectionHeader title="Patient Basic Info" />
            <View className="mb-4">
              <Text className="text-xs text-text-secondary">
                Fields marked with <Text className="text-error">*</Text> are required
              </Text>
            </View>
            
            <FormInput
              label="Name or ID"
              value={formData.patient_id}
              onChangeText={(text) => {
                setFormData({ ...formData, patient_id: text });
                if (errors.patient_id) {
                  setErrors({ ...errors, patient_id: undefined });
                }
              }}
              placeholder="UoM2301 or Patient123"
              required
              error={errors.patient_id}
              helperText="Example: UoM2301 or Patient123"
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <FormInput
                  label="Age"
                  value={formData.age.toString()}
                  onChangeText={(text) => {
                    setFormData({ ...formData, age: text });
                    if (errors.age) {
                      setErrors({ ...errors, age: undefined });
                    }
                  }}
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
                  onSelect={(value) => {
                    setFormData({ ...formData, gender: value as "Male" | "Female" | "Other" });
                    if (errors.gender) {
                      setErrors({ ...errors, gender: undefined });
                    }
                  }}
                  required
                  error={errors.gender}
                />
              </View>
            </View>
          </Card>

          {/* Lab Tests - Optional but Recommended */}
          <Card className="mt-4 border-border/80">
            <SectionHeader title="Lab Tests" />
            <Text className="text-xs text-text-secondary mb-4">
              Providing lab tests helps improve the accuracy of risk prediction.
            </Text>
            
            <View className="flex-row flex-wrap gap-3">
              <View className="w-[48%]">
                <FormInput
                  label="HbA1c (%)"
                  value={formData.lab_tests.hba1c?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, hba1c: text },
                    });
                    if (errors.lab_tests?.hba1c) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, hba1c: undefined },
                      });
                    }
                  }}
                  placeholder="7.2"
                  type="number"
                  error={errors.lab_tests?.hba1c}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Glucose (mg/dL)"
                  value={formData.lab_tests.glucose?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, glucose: text },
                    });
                    if (errors.lab_tests?.glucose) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, glucose: undefined },
                      });
                    }
                  }}
                  placeholder="145"
                  type="number"
                  error={errors.lab_tests?.glucose}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Total Cholesterol (mg/dL)"
                  value={formData.lab_tests.cholesterol?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, cholesterol: text },
                    });
                    if (errors.lab_tests?.cholesterol) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, cholesterol: undefined },
                      });
                    }
                  }}
                  placeholder="200"
                  type="number"
                  error={errors.lab_tests?.cholesterol}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="HDL (mg/dL)"
                  value={formData.lab_tests.hdl?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, hdl: text },
                    });
                    if (errors.lab_tests?.hdl) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, hdl: undefined },
                      });
                    }
                  }}
                  placeholder="50"
                  type="number"
                  error={errors.lab_tests?.hdl}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="LDL (mg/dL)"
                  value={formData.lab_tests.ldl?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, ldl: text },
                    });
                    if (errors.lab_tests?.ldl) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, ldl: undefined },
                      });
                    }
                  }}
                  placeholder="130"
                  type="number"
                  error={errors.lab_tests?.ldl}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Triglycerides (mg/dL)"
                  value={formData.lab_tests.triglycerides?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, triglycerides: text },
                    });
                    if (errors.lab_tests?.triglycerides) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, triglycerides: undefined },
                      });
                    }
                  }}
                  placeholder="150"
                  type="number"
                  error={errors.lab_tests?.triglycerides}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Urea (mg/dL)"
                  value={formData.lab_tests.urea?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, urea: text },
                    });
                    if (errors.lab_tests?.urea) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, urea: undefined },
                      });
                    }
                  }}
                  placeholder="20"
                  type="number"
                  error={errors.lab_tests?.urea}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Creatinine (mg/dL)"
                  value={formData.lab_tests.creatinine?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      lab_tests: { ...formData.lab_tests, creatinine: text },
                    });
                    if (errors.lab_tests?.creatinine) {
                      setErrors({
                        ...errors,
                        lab_tests: { ...errors.lab_tests, creatinine: undefined },
                      });
                    }
                  }}
                  placeholder="1.0"
                  type="number"
                  error={errors.lab_tests?.creatinine}
                />
              </View>
            </View>
          </Card>

          {/* Vital Signs - Optional but Recommended */}
          <Card className="mt-4 border-border/80">
            <SectionHeader title="Vital Signs" />
            <View className="mb-4">
              <Text className="text-xs text-text-secondary">
                Providing vital signs helps improve the accuracy of risk prediction.
              </Text>
            </View>
            
            <View className="flex-row flex-wrap gap-3">
              <View className="w-[48%]">
                <FormInput
                  label="BMI (kg/m^2)"
                  value={formData.vital_signs.bmi?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      vital_signs: { ...formData.vital_signs, bmi: text },
                    });
                    if (errors.vital_signs?.bmi) {
                      setErrors({
                        ...errors,
                        vital_signs: { ...errors.vital_signs, bmi: undefined },
                      });
                    }
                  }}
                  placeholder="25.3"
                  type="number"
                  error={errors.vital_signs?.bmi}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Systolic BP (mmHg)"
                  value={formData.vital_signs.systolic_bp?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      vital_signs: { ...formData.vital_signs, systolic_bp: text },
                    });
                    if (errors.vital_signs?.systolic_bp) {
                      setErrors({
                        ...errors,
                        vital_signs: { ...errors.vital_signs, systolic_bp: undefined },
                      });
                    }
                  }}
                  placeholder="120"
                  type="number"
                  error={errors.vital_signs?.systolic_bp}
                />
              </View>
              <View className="w-[48%]">
                <FormInput
                  label="Diastolic BP (mmHg)"
                  value={formData.vital_signs.diastolic_bp?.toString() || ''}
                  onChangeText={(text) => {
                    setFormData({
                      ...formData,
                      vital_signs: { ...formData.vital_signs, diastolic_bp: text },
                    });
                    if (errors.vital_signs?.diastolic_bp) {
                      setErrors({
                        ...errors,
                        vital_signs: { ...errors.vital_signs, diastolic_bp: undefined },
                      });
                    }
                  }}
                  placeholder="80"
                  type="number"
                  error={errors.vital_signs?.diastolic_bp}
                />
              </View>
            </View>
          </Card>

          {/* Lifestyle - Optional */}
          <Card className="mt-4 border-border/80">
            <SectionHeader title="Lifestyle" />
            <Text className="text-xs text-text-secondary mb-4">
              Lifestyle factors can help improve health assessments.
            </Text>
            
            <View className="flex-row flex-wrap gap-3">
              <View className="w-full">
                <Select
                  label="Smoking"
                  value={formData.lifestyle?.smoking || ''}
                  options={['Never', 'Occasionally', 'Regularly', 'Former']}
                  onSelect={(value) => {
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, smoking: value },
                    });
                    if (errors.lifestyle?.smoking) {
                      setErrors({
                        ...errors,
                        lifestyle: { ...errors.lifestyle, smoking: undefined },
                      });
                    }
                  }}
                  error={errors.lifestyle?.smoking}
                />
              </View>
              <View className="w-full">
                <Select
                  label="Drinking"
                  value={formData.lifestyle?.drinking || ''}
                  options={['Never', 'Occasionally', 'Regularly', 'Former']}
                  onSelect={(value) => {
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, drinking: value },
                    });
                    if (errors.lifestyle?.drinking) {
                      setErrors({
                        ...errors,
                        lifestyle: { ...errors.lifestyle, drinking: undefined },
                      });
                    }
                  }}
                  error={errors.lifestyle?.drinking}
                />
              </View>
              <View className="w-full">
                <Select
                  label="Exercise"
                  value={formData.lifestyle?.exercise || ''}
                  options={['None', 'Light', 'Moderate', 'Heavy']}
                  onSelect={(value) => {
                    setFormData({
                      ...formData,
                      lifestyle: { ...formData.lifestyle, exercise: value },
                    });
                    if (errors.lifestyle?.exercise) {
                      setErrors({
                        ...errors,
                        lifestyle: { ...errors.lifestyle, exercise: undefined },
                      });
                    }
                  }}
                  error={errors.lifestyle?.exercise}
                />
              </View>
            </View>
          </Card>

          {/* Conditions - Optional */}
          <Card className="mt-4 border-border/80">
            <SectionHeader title="Conditions" />
            <ConditionsTags
              label=""
              conditions={formData.conditions}
              onChange={(conditions) => {
                setFormData({ ...formData, conditions });
                if (errors.conditions) {
                  setErrors({ ...errors, conditions: undefined });
                }
              }}
              error={errors.conditions}
            />
          </Card>

          <Button
            variant="primary"
            onPress={handleSave}
            fullWidth
            className="mt-6"
          >
            Save Patient
          </Button>
        </View>
      </ScrollView>

      {/* Success Popup */}
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
