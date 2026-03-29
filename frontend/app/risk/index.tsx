import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { formatApiError } from '@/src/shared/utils/formatApiError';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import { aiResultsService } from '@/services/aiResults';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { patientsService } from '@/services/patients';

type FeatureBar = {
  label: string;
  percent: number;
};

export default function RiskPredictionScreen() {
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
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
        <Header title="Risk Dashboard" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  const selectedPatient = patients.find((patient) => patient.id === patientId);
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
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <Header title="Risk Dashboard" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          <Card className="mb-6 bg-bg-secondary border-primary/12 shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary mb-2">
              Clinical decision support
            </Text>
            <Text className="text-2xl font-bold text-text mb-2 tracking-tight">Risk review</Text>
            <Text className="text-sm text-text-secondary leading-6">
              Select a patient, run the model, then review score, summary, and contributing factors.
            </Text>
          </Card>

          <Card className="mb-5 border-border/80">
            <Text className="text-base font-semibold text-text mb-3 tracking-tight">
              Select patient
            </Text>
            <View className="flex-row flex-wrap">
              {patients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  onPress={() => setPatientId(patient.id)}
                  className={`mr-2 mb-2 px-4 py-3 rounded-2xl border ${
                    patientId === patient.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border/90 bg-background'
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      patientId === patient.id ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {patient.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button
              onPress={runPrediction}
              loading={loading}
              disabled={!patientId}
              fullWidth
              className="mt-4"
            >
              Run risk prediction
            </Button>
            <TouchableOpacity
              onPress={() => patientId && router.push(`/patients/${patientId}/what-if` as any)}
              disabled={!patientId}
              className="mt-4 py-2"
              accessibilityRole="link"
              accessibilityLabel="Open what-if workspace for selected patient"
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  patientId ? 'text-primary' : 'text-text-disabled'
                }`}
              >
                Open what-if workspace for this patient
              </Text>
            </TouchableOpacity>
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
