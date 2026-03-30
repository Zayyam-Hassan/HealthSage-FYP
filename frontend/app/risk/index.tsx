import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import RecordForPatientHeader from '@/components/RecordForPatientHeader';
import SearchBar from '@/components/searchbar';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { aiResultsService } from '@/services/aiResults';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { patientsService, type Patient } from '@/services/patients';

type FeatureBar = {
  label: string;
  percent: number;
};

export default function RiskPredictionScreen() {
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskClass, setRiskClass] = useState<'low' | 'medium' | 'high'>('low');
  const [summary, setSummary] = useState('');
  const [featureBars, setFeatureBars] = useState<FeatureBar[]>([]);
  const { dialog, hideDialog, showDialog } = useAppDialog();

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        if (role !== 'doctor') {
          setPatients([]);
          setPatientId('');
          return;
        }
        const response = await patientsService.getPatients({ limit: 50 });
        setPatients(response.items);
        if (response.items.length > 0) {
          setPatientId(response.items[0].id);
        }
      } catch (error) {
        console.error('Failed to load patients for risk screen:', error);
      } finally {
        setScreenLoading(false);
      }
    })();
  }, [authLoading, role]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) ?? null,
    [patients, patientId],
  );

  const filteredPatients = useMemo(() => {
    const query = patientSearchQuery.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (patient) =>
        patient.full_name?.toLowerCase().includes(query) ||
        patient.patient_id?.toLowerCase().includes(query) ||
        patient.conditions?.some((c) => c.toLowerCase().includes(query)),
    );
  }, [patients, patientSearchQuery]);

  const runPrediction = async () => {
    if (!patientId) {
      showDialog('Select a patient', 'Choose a patient before running the model.');
      return;
    }

    try {
      setLoading(true);
      setFeatureBars([]);
      const prediction = await aiResultsService.predictRisk(patientId);
      setRiskScore(Math.round((prediction.risk_score ?? 0) * 100));
      setRiskClass(prediction.risk_class);
      setSummary(prediction.clinical_summary);
      setFeatureBars(
        (prediction.factors.clinical ?? []).slice(0, 6).map((item, index) => ({
          label: item.split('(')[0].trim() || `Feature ${index + 1}`,
          percent: Math.max(8, 100 - index * 12),
        })),
      );
    } catch (error: unknown) {
      showDialog('Prediction failed', formatApiError(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || screenLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header
          variant="coral"
          title="Risk dashboard"
          showBack
        />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  const barColor =
    riskClass === 'high'
      ? 'bg-error'
      : riskClass === 'medium'
        ? 'bg-warning'
        : 'bg-success';

  if (role !== 'doctor') {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Risk Dashboard" showBack />
        <View className="flex-1 justify-center px-6">
          <Card className="border-border/80 bg-bg-card">
            <Text className="text-lg font-semibold text-text mb-2 tracking-tight">
              Doctor-only dashboard
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              Risk prediction and explainability are available to doctors only. Patients should update their assessment form and review the reports shared with them.
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Modal
        visible={patientPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPatientPickerVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setPatientPickerVisible(false)}
        >
          <Pressable
            className="max-h-[70%] rounded-t-3xl bg-white px-4 pb-8 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-3 text-center text-base font-bold text-text">Record for</Text>
            <View className="mb-3">
              <SearchBar
                placeholder="Search assigned patients"
                value={patientSearchQuery}
                onChangeText={setPatientSearchQuery}
              />
            </View>
            <ScrollView>
              {filteredPatients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  className="border-b border-border/40 py-3"
                  onPress={() => {
                    setPatientId(p.id);
                    setPatientPickerVisible(false);
                  }}
                >
                  <Text className="text-base font-semibold text-text">
                    {p.full_name?.trim() || 'Patient'}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {p.demographics?.age != null ? `${p.demographics.age} yrs` : ''}
                    {p.demographics?.age != null && p.demographics?.gender ? ' · ' : ''}
                    {p.demographics?.gender ?? ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <Header variant="coral" title="Risk dashboard" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          <Card className="mb-6 overflow-hidden rounded-2xl border border-white/25 bg-coral shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90 mb-2">
              Clinical decision support
            </Text>
            <Text className="text-2xl font-bold text-white mb-2 tracking-tight">Risk review</Text>
            <Text className="text-sm text-white/90 leading-6">
              Select a patient, run the model, then review score, summary, and contributing factors.
            </Text>
          </Card>

          <View className="mb-5 overflow-hidden rounded-t-[20px] bg-white shadow-sm">
            <RecordForPatientHeader
              label="Risk review for"
              name={selectedPatient?.full_name?.trim() || 'Select patient'}
              subtitle={
                selectedPatient
                  ? `ID: ${selectedPatient.patient_id} · ${selectedPatient.demographics.age} yrs · ${selectedPatient.demographics.gender}`
                  : undefined
              }
              onPressEdit={() => {
                setPatientSearchQuery('');
                setPatientPickerVisible(true);
              }}
            />
          </View>

          <Card className="mb-5 border-border/80">
            <Button
              onPress={runPrediction}
              loading={loading}
              disabled={!patientId}
              fullWidth
            >
              Run risk prediction
            </Button>
            <Button
              variant="outline"
              fullWidth
              className="mt-3"
              disabled={!patientId}
              onPress={() => router.push(`/patients/${patientId}/what-if` as any)}
            >
              What-if analysis
            </Button>
          </Card>

          {riskScore !== null && (
            <>
              <Card className="mb-5 border-border/90">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
                  Prediction result
                </Text>
                <Text className="text-5xl font-bold text-text mb-1 tracking-tight">
                  {riskScore}%
                </Text>
                <Text className="text-sm text-text-secondary mb-4">
                  {selectedPatient?.full_name || 'Selected patient'} is currently in the{' '}
                  {riskClass} risk band.
                </Text>
                <View className="h-3 bg-bg-secondary rounded-full overflow-hidden">
                  <View
                    className={`h-full ${barColor}`}
                    style={{ width: `${Math.min(riskScore, 100)}%` }}
                  />
                </View>
              </Card>

              {summary ? (
                <Card className="mb-5 border-border/80">
                  <Text className="text-base font-semibold text-text mb-2 tracking-tight">
                    Clinical summary
                  </Text>
                  <Text className="text-sm text-text-secondary leading-6">
                    {summary}
                  </Text>
                </Card>
              ) : null}

              <Card className="border-border/80">
                <Text className="text-base font-semibold text-text mb-4 tracking-tight">
                  Key contributing fields
                </Text>
                {featureBars.length > 0 ? (
                  featureBars.map((feature) => (
                    <View key={feature.label} className="mb-4 last:mb-0">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-sm font-medium text-text">
                          {feature.label}
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          {feature.percent}%
                        </Text>
                      </View>
                      <View className="h-3 bg-bg-secondary rounded-full overflow-hidden">
                        <View
                          className="h-full bg-error rounded-full"
                          style={{ width: `${Math.min(feature.percent, 100)}%` }}
                        />
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className="text-sm text-text-secondary">
                    The model did not return feature bars for this prediction.
                  </Text>
                )}
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
