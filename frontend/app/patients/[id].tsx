import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import SectionHeader from '@/components/SectionHeader';
import RiskIndicator from '@/components/RiskIndicator';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { patientsService, Patient } from '@/services/patients';
import { aiResultsService } from '@/services/aiResults';
import type { RiskPrediction } from '@/constants/mockRisk';

export default function PatientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { role } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [riskData, setRiskData] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPatient = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await patientsService.getPatient(id as string);
      setPatient(data);
    } catch (err: any) {
      console.error('Error loading patient:', err);
      setError(err.message || 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  useEffect(() => {
    if (!patient?.id) return;
    let cancelled = false;
    aiResultsService
      .predictRisk(patient.id)
      .then((res) => {
        if (!cancelled) {
          setRiskData({
            risk_score: res.risk_score,
            risk_class: res.risk_class,
            confidence: res.confidence,
            factors: res.factors,
            recommendations: res.recommendations,
            clinicalSummary: res.clinical_summary,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setRiskData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [patient?.id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Patient Details" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (error || !patient) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Patient Details" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Card className="w-full max-w-sm border-border/80">
            <View className="items-center py-2">
              <View className="w-12 h-12 rounded-2xl bg-error/10 items-center justify-center mb-3">
                <Ionicons name="alert-circle-outline" size={28} color={colors.status.error} />
              </View>
              <Text className="text-base text-text-secondary text-center leading-6">
                {error || 'Patient not found'}
              </Text>
            </View>
          </Card>
          <Button variant="outline" onPress={() => router.back()} className="mt-6 min-w-[200px]">
            Go back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Parse blood pressure if it exists
  let systolic_bp: number | undefined;
  let diastolic_bp: number | undefined;
  if (patient.vital_signs?.systolic_bp && patient.vital_signs?.diastolic_bp) {
    systolic_bp = patient.vital_signs.systolic_bp;
    diastolic_bp = patient.vital_signs.diastolic_bp;
  }

  // Check if patient has any lab test values
  const hasLabTests = patient.lab_tests && Object.values(patient.lab_tests).some(v => v !== undefined && v !== null);

  // Check if patient has any vital sign values
  const hasVitalSigns = patient.vital_signs && (
    patient.vital_signs.bmi !== undefined ||
    systolic_bp !== undefined ||
    diastolic_bp !== undefined
  );

  const doctorSecondaryActions =
    role === 'doctor'
      ? [
          {
            id: 'edit',
            label: 'Edit patient record',
            onPress: () => router.push(`/patients/${patient.id}/edit` as any),
          },
          {
            id: 'whatif',
            label: 'What-if analysis',
            onPress: () => router.push(`/patients/${patient.id}/what-if` as any),
          },
          {
            id: 'compare',
            label: 'Compare doctor plan',
            onPress: () => router.push(`/patients/${patient.id}/compare-plan` as any),
          },
          {
            id: 'reports',
            label: 'Reports workspace',
            onPress: () =>
              router.push({
                pathname: '/reports',
                params: { patientId: patient.id },
              } as any),
          },
        ]
      : [];

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title="Patient chart" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-primary px-6 pt-4 pb-7 rounded-b-[28px] mb-5">
          <View className="flex-row items-center">
            <Avatar
              name={patient.full_name || patient.patient_id}
              size="lg"
              className="mr-4 border-2 border-white/35"
            />
            <View className="flex-1 min-w-0">
              <Text className="text-xl font-bold text-white mb-1 tracking-tight" numberOfLines={2}>
                {patient.full_name || `Patient ${patient.patient_id}`}
              </Text>
              <Text className="text-sm text-white/88">ID {patient.patient_id}</Text>
              <Text className="text-sm text-white/80 mt-1">
                {patient.demographics.age} yrs · {patient.demographics.gender}
              </Text>
            </View>
          </View>
        </View>

        <View className="px-6">
          {/* Risk Assessment — detailed dashboard */}
          <Card className="mb-4 border-border/80">
            <SectionHeader
              eyebrow="Clinical"
              title="Risk overview"
              subtitle="Model output and drivers for this patient."
            />
            {riskData ? (
              <RiskIndicator risk={riskData} showDetails />
            ) : (
              <Text className="text-sm text-text-tertiary py-2">Loading risk assessment…</Text>
            )}
          </Card>

          <Card className="mb-4 border-border/80">
            <SectionHeader eyebrow="Record" title="Demographics" />
            <View className="flex-row flex-wrap gap-x-6 gap-y-3">
              <View>
                <Text className="text-xs font-medium text-text-secondary mb-0.5">Patient ID</Text>
                <Text className="text-base font-semibold text-text">{patient.patient_id}</Text>
              </View>
              <View>
                <Text className="text-xs font-medium text-text-secondary mb-0.5">Age</Text>
                <Text className="text-base text-text">{patient.demographics.age} years</Text>
              </View>
              <View>
                <Text className="text-xs font-medium text-text-secondary mb-0.5">Gender</Text>
                <Text className="text-base text-text">{patient.demographics.gender}</Text>
              </View>
            </View>
          </Card>

          {/* Lab Tests */}
          {hasLabTests && (
            <Card className="mb-4 border-border/80">
              <SectionHeader eyebrow="Labs" title="Laboratory values" />
              <View>
                {patient.lab_tests?.hba1c !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">HbA1c</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.hba1c} %
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.glucose !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">Glucose</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.glucose} mg/dL
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.cholesterol !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">Cholesterol</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.cholesterol} mg/dL
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.hdl !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">HDL</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.hdl} mg/dL
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.ldl !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">LDL</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.ldl} mg/dL
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.triglycerides !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">Triglycerides</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.triglycerides} mg/dL
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.urea !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">Urea</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.urea} mg/dL
                    </Text>
                  </View>
                )}
                {patient.lab_tests?.creatinine !== undefined && (
                  <View className="flex-row justify-between items-center py-2">
                    <Text className="text-sm text-text-secondary">Creatinine</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.lab_tests.creatinine} mg/dL
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Vital Signs */}
          {hasVitalSigns && (
            <Card className="mb-4 border-border/80">
              <SectionHeader eyebrow="Vitals" title="Vital signs" />
              <View>
                {patient.vital_signs?.bmi !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">BMI</Text>
                    <Text className="text-base font-semibold text-text">
                      {patient.vital_signs.bmi} kg/m²
                    </Text>
                  </View>
                )}
                {systolic_bp !== undefined && diastolic_bp !== undefined && (
                  <View className="flex-row justify-between items-center py-2 border-b border-border">
                    <Text className="text-sm text-text-secondary">Blood Pressure</Text>
                    <Text className="text-base font-semibold text-text">
                      {systolic_bp} / {diastolic_bp} mmHg
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Conditions */}
          {patient.conditions && patient.conditions.length > 0 && (
            <Card className="mb-4 border-border/80">
              <SectionHeader eyebrow="Problems" title="Conditions" />
              <View className="flex-row flex-wrap gap-2">
                {patient.conditions.map((condition, index) => (
                  <Badge key={index} variant="warning" size="sm">
                    {condition}
                  </Badge>
                ))}
              </View>
            </Card>
          )}

          {/* Show "Not recorded" message if no lab tests or vital signs */}
          {!hasLabTests && !hasVitalSigns && (
            <Card className="mb-4 bg-bg-secondary/50 border-border/80">
              <View className="flex-row items-start py-1">
                <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center mr-3 mt-0.5">
                  <Ionicons name="pulse-outline" size={20} color={colors.primary.main} />
                </View>
                <Text className="text-sm text-text-secondary flex-1 leading-6">
                  Lab tests and vital signs are not recorded yet. Update the health assessment to enrich this chart.
                </Text>
              </View>
            </Card>
          )}

          <View className="mb-6">
            {role === 'doctor' ? (
              <>
                <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2 px-0.5">
                  Clinical actions
                </Text>
                <Button
                  variant="primary"
                  fullWidth
                  onPress={() => router.push(`/patients/${patient.id}/treatment` as any)}
                  className="mb-3"
                >
                  Treatment plan
                </Button>
                <View className="rounded-2xl border border-border/90 bg-bg-card overflow-hidden shadow-sm">
                  {doctorSecondaryActions.map((action, index) => (
                    <TouchableOpacity
                      key={action.id}
                      onPress={action.onPress}
                      activeOpacity={0.7}
                      className={`flex-row items-center justify-between px-4 py-3.5 ${
                        index < doctorSecondaryActions.length - 1 ? 'border-b border-border' : ''
                      }`}
                      accessibilityRole="button"
                      accessibilityLabel={action.label}
                    >
                      <Text className="text-base font-medium text-text pr-2 flex-1">{action.label}</Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <Button
                variant="primary"
                fullWidth
                onPress={() => router.push(`/patients/${patient.id}/edit` as any)}
              >
                Edit my health record
              </Button>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
