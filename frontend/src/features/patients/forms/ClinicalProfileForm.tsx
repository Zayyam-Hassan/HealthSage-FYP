import React from 'react';
import type { ClinicalFormHandlers } from './clinicalFormHandlers';
import { ConditionsSection } from './sections/ConditionsSection';
import { DemographicsSection } from './sections/DemographicsSection';
import { LabTestsSection } from './sections/LabTestsSection';
import { LifestyleSection } from './sections/LifestyleSection';
import { VitalsSection } from './sections/VitalsSection';
import type { PatientFormErrors, PatientFormValues } from '@/interfaces/patient';

type Mode = 'create' | 'edit';

type Props = {
  mode: Mode;
  formData: PatientFormValues;
  errors: PatientFormErrors;
  handlers: ClinicalFormHandlers;
};

/**
 * Full clinical profile field stack for doctor create / edit flows (non-stepped).
 * New vs edit only differ in DemographicsSection presentation.
 */
export function ClinicalProfileForm({ mode, formData, errors, handlers }: Props) {
  return (
    <>
      <DemographicsSection mode={mode} formData={formData} errors={errors} handlers={handlers} />

      <LabTestsSection variant="doctor" formData={formData} errors={errors} handlers={handlers} />

      <VitalsSection
        formData={formData}
        errors={errors}
        handlers={handlers}
        bmiLabelStyle={mode === 'create' ? 'ascii' : 'unicode'}
      />

      <LifestyleSection variant="doctor" formData={formData} errors={errors} handlers={handlers} />

      <ConditionsSection formData={formData} errors={errors} handlers={handlers} />
    </>
  );
}
