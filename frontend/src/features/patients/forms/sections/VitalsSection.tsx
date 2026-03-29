import React from 'react';
import { Text, View } from 'react-native';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import SectionHeader from '@/components/SectionHeader';
import type { ClinicalFormHandlers } from '../clinicalFormHandlers';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

type Props = {
  formData: PatientFormValues;
  errors: PatientFormErrors;
  handlers: ClinicalFormHandlers;
  className?: string;
  /** 'unicode' matches edit.tsx (kg/m²); 'ascii' matches new.tsx (kg/m^2) */
  bmiLabelStyle?: 'unicode' | 'ascii';
};

export function VitalsSection({
  formData,
  errors,
  handlers,
  className = 'mt-4 border-border/80',
  bmiLabelStyle = 'unicode',
}: Props) {
  const bmiLabel = bmiLabelStyle === 'unicode' ? 'BMI (kg/m²)' : 'BMI (kg/m^2)';

  return (
    <Card className={className}>
      <SectionHeader title="Vital Signs" />
      <View className="mb-4">
        <Text className="text-xs text-text-secondary">
          Providing vital signs helps improve the accuracy of risk prediction.
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <View className="w-[48%]">
          <FormInput
            label={bmiLabel}
            value={formData.vital_signs.bmi?.toString() || ''}
            onChangeText={(text) => handlers.updateVital('bmi', text)}
            placeholder="25.3"
            type="number"
            error={errors.vital_signs?.bmi}
          />
        </View>
        <View className="w-[48%]">
          <FormInput
            label="Systolic BP (mmHg)"
            value={formData.vital_signs.systolic_bp?.toString() || ''}
            onChangeText={(text) => handlers.updateVital('systolic_bp', text)}
            placeholder="120"
            type="number"
            error={errors.vital_signs?.systolic_bp}
          />
        </View>
        <View className="w-[48%]">
          <FormInput
            label="Diastolic BP (mmHg)"
            value={formData.vital_signs.diastolic_bp?.toString() || ''}
            onChangeText={(text) => handlers.updateVital('diastolic_bp', text)}
            placeholder="80"
            type="number"
            error={errors.vital_signs?.diastolic_bp}
          />
        </View>
      </View>
    </Card>
  );
}
