import React from 'react';
import { Text, View } from 'react-native';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import SectionHeader from '@/components/SectionHeader';
import type { ClinicalFormHandlers } from '../clinicalFormHandlers';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';
import { LAB_FIELDS_DOCTOR, LAB_FIELDS_SELF_ASSESSMENT } from '../labFieldConfig';

type Variant = 'doctor' | 'self-assessment';

type Props = {
  variant: Variant;
  formData: PatientFormValues;
  errors: PatientFormErrors;
  handlers: ClinicalFormHandlers;
  className?: string;
};

export function LabTestsSection({ variant, formData, errors, handlers, className = 'mt-4 border-border/80' }: Props) {
  const fields = variant === 'doctor' ? LAB_FIELDS_DOCTOR : LAB_FIELDS_SELF_ASSESSMENT;

  return (
    <Card className={className}>
      <SectionHeader title="Lab Tests" />
      <Text className="text-xs text-text-secondary mb-4">
        Providing lab tests helps improve the accuracy of risk prediction.
      </Text>

      <View className="flex-row flex-wrap gap-3">
        {fields.map(({ key, label, placeholder }) => (
          <View className="w-[48%]" key={key}>
            <FormInput
              label={label}
              value={formData.lab_tests?.[key]?.toString() || ''}
              onChangeText={(text) => handlers.updateLab(key, text)}
              placeholder={placeholder}
              type="number"
              error={errors.lab_tests?.[key]}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}
