import React from 'react';
import { Text, View } from 'react-native';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import SectionHeader from '@/components/SectionHeader';
import ClinicalDropdown from '@/components/ClinicalDropdown';
import type { ClinicalFormHandlers } from '../clinicalFormHandlers';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

export type DemographicsMode = 'create' | 'edit' | 'self-assessment';

type Props = {
  mode: DemographicsMode;
  formData: PatientFormValues;
  errors: PatientFormErrors;
  handlers: ClinicalFormHandlers;
};

export function DemographicsSection({ mode, formData, errors, handlers }: Props) {
  if (mode === 'create') {
    return (
      <Card className="border-border/80">
        <SectionHeader title="Patient Basic Info" />
        <View className="mb-4">
          <Text className="text-xs text-text-secondary">
            Fields marked with <Text className="text-error">*</Text> are required
          </Text>
        </View>

        <FormInput
          label="Full name"
          value={formData.full_name ?? ''}
          onChangeText={handlers.updateFullName}
          placeholder="e.g. Jane Doe"
          required
          error={errors.full_name}
        />

        <FormInput
          label="Patient ID"
          value={formData.patient_id}
          onChangeText={handlers.updatePatientId}
          placeholder="UoM2301 or Patient123"
          required
          error={errors.patient_id}
          helperText="External or clinic identifier (separate from display name)"
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormInput
              label="Age"
              value={formData.age.toString()}
              onChangeText={handlers.updateAge}
              placeholder="Age"
              type="number"
              required
              error={errors.age}
            />
          </View>
          <View className="flex-1">
            <ClinicalDropdown
              label="Gender"
              value={formData.gender}
              options={['Male', 'Female', 'Other']}
              onSelect={(value) => handlers.updateGender(value as 'Male' | 'Female' | 'Other')}
              required
              error={errors.gender}
            />
          </View>
        </View>
      </Card>
    );
  }

  if (mode === 'edit') {
    return (
      <Card>
        <SectionHeader eyebrow="Demographics" title="Patient basics" />

        <FormInput
          label="Patient ID"
          value={formData.patient_id}
          onChangeText={handlers.updatePatientId}
          placeholder="UoM2301 or Patient123"
          required
          error={errors.patient_id}
        />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormInput
              label="Age"
              value={formData.age.toString()}
              onChangeText={handlers.updateAge}
              placeholder="Age"
              type="number"
              required
              error={errors.age}
            />
          </View>
          <View className="flex-1">
            <ClinicalDropdown
              label="Gender"
              value={formData.gender}
              options={['Male', 'Female', 'Other']}
              onSelect={(value) => handlers.updateGender(value as 'Male' | 'Female' | 'Other')}
              required
              error={errors.gender}
            />
          </View>
        </View>
      </Card>
    );
  }

  // self-assessment
  return (
    <Card className="mb-4 border-border/80">
      <SectionHeader title="Patient basics" />
      <FormInput
        label="Patient ID"
        value={formData.patient_id}
        onChangeText={handlers.updatePatientId}
        placeholder="Profile identifier"
        required
        error={errors.patient_id}
        disabled
        helperText="Patient ID cannot be changed here. Contact your clinic if it is wrong."
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <FormInput
            label="Age"
            value={String(formData.age ?? '')}
            onChangeText={handlers.updateAge}
            placeholder="Age"
            type="number"
            required
            error={errors.age}
          />
        </View>
        <View className="flex-1">
          <ClinicalDropdown
            label="Gender"
            value={formData.gender}
            options={['Male', 'Female', 'Other']}
            onSelect={(value) => handlers.updateGender(value as 'Male' | 'Female' | 'Other')}
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
            onChangeText={handlers.updateHeightCm}
            placeholder="170"
            type="number"
          />
        </View>
        <View className="flex-1">
          <FormInput
            label="Weight (kg)"
            value={String(formData.weight_kg ?? '')}
            onChangeText={handlers.updateWeightKg}
            placeholder="75"
            type="number"
          />
        </View>
      </View>
    </Card>
  );
}
