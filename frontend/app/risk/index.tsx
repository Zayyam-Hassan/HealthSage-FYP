import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppDialog from '@/components/AppDialog';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Loader from '@/components/Loader';
import { aiResultsService } from '@/services/aiResults';
import { authService, type UserRole } from '@/services/auth';
import { patientsService } from '@/services/patients';

type FeatureBar = {
  label: string;
  percent: number;
};

export default function RiskPredictionScreen() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskClass, setRiskClass] = useState<'low' | 'medium' | 'high'>('low');
  const [summary, setSummary] = useState('');
  const [featureBars, setFeatureBars] = useState<FeatureBar[]>([]);
  const [dialog, setDialog] = useState({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setRole(currentUser?.role ?? null);
        if (currentUser?.role !== 'doctor') {
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
  }, []);

  const runPrediction = async () => {
    if (!patientId) {
      setDialog({
        visible: true,
        title: 'Select a patient',
        message: 'Choose a patient before running the model.',
      });
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
    } catch (error: any) {
      setDialog({
        visible: true,
        title: 'Prediction failed',
        message: error.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (screenLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Risk Dashboard" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
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
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Risk Dashboard" showBack />
        <View className="flex-1 justify-center px-6">
          <Card>
            <Text className="text-lg font-semibold text-text mb-2">
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
    <SafeAreaView className="flex-1 bg-background">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog({ visible: false, title: '', message: '' })}
      />
      <Header title="Risk Dashboard" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <Card className="mb-5 bg-primary/5 border border-primary/20">
            <Text className="text-2xl font-bold text-text mb-2">
              Risk review workspace
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              Run the prediction and review only the key fields that influenced the result.
            </Text>
          </Card>

          <Card className="mb-5">
            <Text className="text-base font-semibold text-text mb-3">
              Select patient
            </Text>
            <View className="flex-row flex-wrap">
              {patients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  onPress={() => setPatientId(patient.id)}
                  className={`mr-2 mb-2 px-4 py-3 rounded-xl border-2 ${
                    patientId === patient.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
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
          </Card>

          {riskScore !== null && (
            <>
              <Card className="mb-5 border border-border">
                <Text className="text-xs uppercase tracking-[1px] text-text-secondary mb-2">
                  Prediction result
                </Text>
                <Text className="text-5xl font-bold text-text mb-1">
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
                <Card className="mb-5">
                  <Text className="text-base font-semibold text-text mb-2">
                    Clinical summary
                  </Text>
                  <Text className="text-sm text-text-secondary leading-6">
                    {summary}
                  </Text>
                </Card>
              ) : null}

              <Card>
                <Text className="text-base font-semibold text-text mb-4">
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
