import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  Alert,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ClinicalDropdown from '@/components/ClinicalDropdown';
import CompatibilityGauge from '@/components/CompatibilityGauge';
import Loader from '@/components/Loader';
import RecordForPatientHeader from '@/components/RecordForPatientHeader';
import SearchBar from '@/components/searchbar';
import { aiResultsService } from '@/services/aiResults';
import { patientsService } from '@/services/patients';
import { medicationsService } from '@/services/medications';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

type PatientRow = { id: string; full_name?: string; patient_id?: string };
type MedicationRow = { id: string; name: string };

export default function CompatibilityCheckScreen() {
  const { role } = useAuth();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [compatibilityResult, setCompatibilityResult] = useState<any>(null);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [patientsRes, medicationsRes] = await Promise.all([
        patientsService.getPatients({ limit: 100 }),
        medicationsService.getMedications({ limit: 100 }),
      ]);
      setPatients(patientsRes.items as PatientRow[]);
      setMedications(medicationsRes.items as MedicationRow[]);
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
        selectedMedicationId,
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

  const patientDisplayName = selectedPatient?.full_name?.trim() || selectedPatient?.patient_id || 'Select patient';

  const filteredPatients = useMemo(() => {
    const q = patientSearchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        (p.full_name && p.full_name.toLowerCase().includes(q)) ||
        (p.patient_id && p.patient_id.toLowerCase().includes(q)),
    );
  }, [patients, patientSearchQuery]);

  const medicationNames = useMemo(() => medications.map((m) => m.name), [medications]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header
        variant="coral"
        title="Compatibility check"
        subtitle={
          role === 'doctor' && selectedPatientId
            ? selectedPatient?.full_name?.trim() || selectedPatient?.patient_id || undefined
            : undefined
        }
        showBack
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <View className="mb-4 overflow-hidden rounded-t-[20px] bg-white shadow-sm">
            <RecordForPatientHeader
              name={patientDisplayName}
              subtitle={selectedPatient?.patient_id ? `ID: ${selectedPatient.patient_id}` : undefined}
              onPressEdit={() => {
                setPatientSearchQuery('');
                setPatientPickerVisible(true);
              }}
            />
          </View>

          <Card className="mb-4 border-border/80">
            <ClinicalDropdown
              label="Medication"
              value={selectedMedication?.name ?? ''}
              options={medicationNames}
              placeholder="Choose medication…"
              onSelect={(name) => {
                const med = medications.find((m) => m.name === name);
                if (med) setSelectedMedicationId(med.id);
              }}
            />
          </Card>

          <Button
            onPress={handleCheckCompatibility}
            loading={loading}
            disabled={!selectedPatientId || !selectedMedicationId}
            fullWidth
            className="mb-4"
          >
            Check Compatibility
          </Button>

          {loading && (
            <View className="items-center py-8">
              <Loader />
              <Text className="mt-4 text-sm text-text-secondary">Analyzing compatibility...</Text>
            </View>
          )}

          {compatibilityResult && !loading && (
            <>
              <Card className="mb-4">
                <CompatibilityGauge score={compatibilityResult.score} />
              </Card>

              {compatibilityResult.summary && (
                <Card className="mb-4">
                  <Text className="mb-3 text-base font-semibold text-text">Summary</Text>
                  <Text className="text-sm leading-5 text-text-secondary">
                    {compatibilityResult.summary}
                  </Text>
                </Card>
              )}

              {compatibilityResult.contraindications &&
                compatibilityResult.contraindications.length > 0 && (
                  <Card className="mb-4">
                    <Text className="mb-3 text-base font-semibold text-text">Contraindications</Text>
                    {compatibilityResult.contraindications.map((contra: string, index: number) => (
                      <View key={index} className="mb-2 flex-row items-start">
                        <Text className="mr-2 text-error">✕</Text>
                        <Text className="flex-1 text-sm text-text-secondary">{contra}</Text>
                      </View>
                    ))}
                  </Card>
                )}

              {compatibilityResult.interactions &&
                compatibilityResult.interactions.length > 0 && (
                  <Card className="mb-4">
                    <Text className="mb-3 text-base font-semibold text-text">Interactions</Text>
                    {compatibilityResult.interactions.map((interaction: string, index: number) => (
                      <View key={index} className="mb-2 flex-row items-start">
                        <Text className="mr-2 text-warning">⚠</Text>
                        <Text className="flex-1 text-sm text-text-secondary">{interaction}</Text>
                      </View>
                    ))}
                  </Card>
                )}

              <Card className="mt-4 border-warning/20 bg-warning/10">
                <Text className="text-xs leading-4 text-text-secondary">
                  <Text className="font-semibold">Medical Disclaimer:</Text> This compatibility check is
                  for informational purposes only and should not replace professional medical advice.
                  Always consult with a healthcare provider before making any medication decisions.
                </Text>
              </Card>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={patientPickerVisible}
        transparent
        animationType="fade"
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
                placeholder="Search by name or ID"
                value={patientSearchQuery}
                onChangeText={setPatientSearchQuery}
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {filteredPatients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  className="border-b border-border/40 py-3"
                  onPress={() => {
                    setSelectedPatientId(p.id);
                    setPatientPickerVisible(false);
                  }}
                >
                  <Text className="text-base font-semibold text-text">
                    {p.full_name?.trim() || p.patient_id || 'Patient'}
                  </Text>
                  {p.patient_id ? (
                    <Text className="mt-0.5 text-xs text-text-secondary">{p.patient_id}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
