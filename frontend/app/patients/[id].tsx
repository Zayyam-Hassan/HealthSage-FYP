import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import SectionHeader from '@/components/SectionHeader';
import RiskIndicator from '@/components/RiskIndicator';
import Loader from '@/components/Loader';
import { authService, type UserRole } from '@/services/auth';
import { patientsService, Patient } from '@/services/patients';
import { aiResultsService } from '@/services/aiResults';
import type { RiskPrediction } from '@/constants/mockRisk';

export default function PatientDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [riskData, setRiskData] = useState<RiskPrediction | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
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
    authService.getCurrentUser().then((user) => setRole(user?.role ?? null));
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
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Patient Details" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !patient) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Patient Details" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-secondary text-center mb-4">
            {error || 'Patient not found'}
          </Text>
          <Button
            variant="outline"
            onPress={() => router.back()}
            className="mt-4"
          >
            Go Back
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Patient Details" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          {/* Basic Info */}
          <Card className="mb-4">
            <SectionHeader title="Basic Info" />
            <View className="flex-row items-center mb-4">
              <Avatar name={patient.full_name || patient.patient_id} size="lg" className="mr-4" />
              <View className="flex-1">
                <Text className="text-xl font-bold text-text mb-1">
                  {patient.full_name || `Patient ${patient.patient_id}`}
                </Text>
                <Text className="text-sm text-text-secondary">
                  ID: {patient.patient_id}
                </Text>
              </View>
            </View>
            <View className="border-t border-border pt-4">
              <View className="mb-3">
                <Text className="text-sm text-text-secondary mb-1">Patient ID</Text>
                <Text className="text-base text-text font-semibold">
                  {patient.patient_id}
                </Text>
              </View>
              <View className="mb-3">
                <Text className="text-sm text-text-secondary mb-1">Age</Text>
                <Text className="text-base text-text">
                  {patient.demographics.age} years old
                </Text>
              </View>
              <View>
                <Text className="text-sm text-text-secondary mb-1">Gender</Text>
                <Text className="text-base text-text">
                  {patient.demographics.gender}
                </Text>
              </View>
            </View>
          </Card>

          {/* Risk Assessment — detailed dashboard */}
          <Card className="mb-4">
            <SectionHeader title="Risk Prediction Dashboard" />
            {riskData ? (
              <RiskIndicator risk={riskData} showDetails />
            ) : (
              <Text className="text-sm text-text-tertiary py-2">Loading risk assessment...</Text>
            )}
          </Card>

          {/* Lab Tests */}
          {hasLabTests && (
            <Card className="mb-4">
              <SectionHeader title="Lab Tests" />
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
            <Card className="mb-4">
              <SectionHeader title="Vital Signs" />
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
            <Card className="mb-4">
              <SectionHeader title="Conditions" />
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
            <Card className="mb-4">
              <Text className="text-sm text-text-tertiary text-center py-4">
                Lab tests and vital signs not recorded
              </Text>
            </Card>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-4">
            <Button
              variant="outline"
              onPress={() => router.push(`/patients/${patient.id}/edit` as any)}
              className="flex-1"
            >
              Edit Patient
            </Button>
            {role === 'doctor' ? (
              <Button
                variant="primary"
                onPress={() => router.push(`/patients/${patient.id}/treatment` as any)}
                className="flex-1"
              >
                Treatment Plan
              </Button>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
