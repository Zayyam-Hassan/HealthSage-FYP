import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import CompatibilityGauge from '@/components/CompatibilityGauge';
import Loader from '@/components/Loader';
import { aiResultsService } from '@/services/aiResults';
import { patientsService } from '@/services/patients';
import { medicationsService } from '@/services/medications';

export default function CompatibilityCheckScreen() {
  const router = useRouter();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [compatibilityResult, setCompatibilityResult] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [patientsRes, medicationsRes] = await Promise.all([
        patientsService.getPatients({ limit: 100 }),
        medicationsService.getMedications({ limit: 100 }),
      ]);
      setPatients(patientsRes.items);
      setMedications(medicationsRes.items);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCheckCompatibility = async () => {
    if (!selectedPatientId || !selectedMedicationId) {
      Alert.alert('Error', 'Please select both a patient and a medication');
      return;
    }

    setLoading(true);
    setCompatibilityResult(null);

    try {
      const result = await aiResultsService.checkCompatibility(
        selectedPatientId,
        selectedMedicationId
      );
      setCompatibilityResult({
        score: result.compatibility_score,
        summary: result.summary,
        contraindications: result.contraindications,
        interactions: result.interactions,
      });
    } catch (error: any) {
      console.error('Error checking compatibility:', error);
      Alert.alert('Error', error.message || 'Failed to check compatibility. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const selectedMedication = medications.find((m) => m.id === selectedMedicationId);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Compatibility Check" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          {/* Patient Selection */}
          <Card className="mb-4">
            <Text className="text-base font-semibold text-text mb-3">
              Select Patient
            </Text>
            <View className="flex-row flex-wrap">
              {patients.map((patient) => (
                <TouchableOpacity
                  key={patient.id}
                  onPress={() => setSelectedPatientId(patient.id)}
                  className={`mr-2 mb-2 px-4 py-2 rounded-lg border-2 ${
                    selectedPatientId === patient.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selectedPatientId === patient.id ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {patient.full_name || patient.patient_id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Medication Selection */}
          <Card className="mb-4">
            <Text className="text-base font-semibold text-text mb-3">
              Select Medication
            </Text>
            <View className="flex-row flex-wrap">
              {medications.map((medication) => (
                <TouchableOpacity
                  key={medication.id}
                  onPress={() => setSelectedMedicationId(medication.id)}
                  className={`mr-2 mb-2 px-4 py-2 rounded-lg border-2 ${
                    selectedMedicationId === medication.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selectedMedicationId === medication.id ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {medication.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Check Button */}
          <Button
            onPress={handleCheckCompatibility}
            loading={loading}
            disabled={!selectedPatientId || !selectedMedicationId}
            fullWidth
            className="mb-4"
          >
            Check Compatibility
          </Button>

          {/* Loading State */}
          {loading && (
            <View className="items-center py-8">
              <Loader />
              <Text className="text-sm text-text-secondary mt-4">
                Analyzing compatibility...
              </Text>
            </View>
          )}

          {/* Results */}
          {compatibilityResult && !loading && (
            <>
              <Card className="mb-4">
                <CompatibilityGauge score={compatibilityResult.score} />
              </Card>

              {compatibilityResult.summary && (
                <Card className="mb-4">
                  <Text className="text-base font-semibold text-text mb-3">Summary</Text>
                  <Text className="text-sm text-text-secondary leading-5">
                    {compatibilityResult.summary}
                  </Text>
                </Card>
              )}

              {compatibilityResult.contraindications &&
                compatibilityResult.contraindications.length > 0 && (
                  <Card className="mb-4">
                    <Text className="text-base font-semibold text-text mb-3">
                      Contraindications
                    </Text>
                    {compatibilityResult.contraindications.map((contra: string, index: number) => (
                      <View key={index} className="flex-row items-start mb-2">
                        <Text className="text-error mr-2">✕</Text>
                        <Text className="text-sm text-text-secondary flex-1">{contra}</Text>
                      </View>
                    ))}
                  </Card>
                )}

              {compatibilityResult.interactions &&
                compatibilityResult.interactions.length > 0 && (
                  <Card className="mb-4">
                    <Text className="text-base font-semibold text-text mb-3">Interactions</Text>
                    {compatibilityResult.interactions.map((interaction: string, index: number) => (
                      <View key={index} className="flex-row items-start mb-2">
                        <Text className="text-warning mr-2">⚠</Text>
                        <Text className="text-sm text-text-secondary flex-1">{interaction}</Text>
                      </View>
                    ))}
                  </Card>
                )}

              {/* Medical Disclaimer */}
              <Card className="mt-4 bg-warning/10 border-warning/20">
                <Text className="text-xs text-text-secondary leading-4">
                  <Text className="font-semibold">Medical Disclaimer:</Text> This compatibility
                  check is for informational purposes only and should not replace professional
                  medical advice. Always consult with a healthcare provider before making any
                  medication decisions.
                </Text>
              </Card>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
