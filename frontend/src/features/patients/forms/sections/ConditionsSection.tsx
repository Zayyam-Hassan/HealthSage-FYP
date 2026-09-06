import React from 'react';
import Card from '@/components/Card';
import ConditionsTags from '@/components/ConditionsTags';
import SectionHeader from '@/components/SectionHeader';
import type { ClinicalFormHandlers } from '../clinicalFormHandlers';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

type Props = {
  formData: PatientFormValues;
  errors: PatientFormErrors;
  handlers: ClinicalFormHandlers;
  className?: string;
};

export function ConditionsSection({ formData, errors, handlers, className = 'mt-4 border-border/80' }: Props) {
  return (
    <Card className={className}>
      <SectionHeader title="Conditions" />
      <ConditionsTags
        label=""
        conditions={formData.conditions}
        onChange={handlers.updateConditions}
        error={errors.conditions}
      />
    </Card>
  );
}
