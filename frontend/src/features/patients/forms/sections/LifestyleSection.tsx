import React from 'react';
import { Text, View } from 'react-native';
import Card from '@/components/Card';
import SectionHeader from '@/components/SectionHeader';
import ClinicalDropdown from '@/components/ClinicalDropdown';
import type { ClinicalFormHandlers } from '../clinicalFormHandlers';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

export type LifestyleVariant = 'doctor' | 'self-assessment';

type Props = {
  variant: LifestyleVariant;
  formData: PatientFormValues;
  errors: PatientFormErrors;
  handlers: ClinicalFormHandlers;
  className?: string;
};

const SMOKING_DOCTOR = ['Never', 'Occasionally', 'Regularly', 'Former'] as const;
const SMOKING_SELF = ['Never', 'Former', 'Occasionally', 'Regularly'] as const;
const DRINKING_DOCTOR = ['Never', 'Occasionally', 'Regularly', 'Former'] as const;
const DRINKING_SELF = ['Never', 'Former', 'Occasionally', 'Regularly'] as const;
const EXERCISE = ['None', 'Light', 'Moderate', 'Heavy'] as const;

export function LifestyleSection({
  variant,
  formData,
  errors,
  handlers,
  className = 'mt-4 border-border/80',
}: Props) {
  const smokingOptions = [...(variant === 'doctor' ? SMOKING_DOCTOR : SMOKING_SELF)];
  const drinkingOptions = [...(variant === 'doctor' ? DRINKING_DOCTOR : DRINKING_SELF)];

  return (
    <Card className={className}>
      <SectionHeader title="Lifestyle" />
      <Text className="text-xs text-text-secondary mb-4">
        Lifestyle factors can help improve health assessments.
      </Text>

      <View className="flex-row flex-wrap gap-3">
        <View className="w-full">
          <ClinicalDropdown
            label="Smoking"
            value={formData.lifestyle?.smoking || ''}
            options={smokingOptions}
            onSelect={(value) => handlers.updateLifestyle('smoking', value)}
            error={errors.lifestyle?.smoking}
          />
        </View>
        <View className="w-full">
          <ClinicalDropdown
            label="Drinking"
            value={formData.lifestyle?.drinking || ''}
            options={drinkingOptions}
            onSelect={(value) => handlers.updateLifestyle('drinking', value)}
            error={errors.lifestyle?.drinking}
          />
        </View>
        <View className="w-full">
          <ClinicalDropdown
            label="Exercise"
            value={formData.lifestyle?.exercise || ''}
            options={[...EXERCISE]}
            onSelect={(value) => handlers.updateLifestyle('exercise', value)}
            error={errors.lifestyle?.exercise}
          />
        </View>
      </View>
    </Card>
  );
}
