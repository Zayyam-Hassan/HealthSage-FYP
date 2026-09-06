import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Card from '@/components/Card';
import SearchBar from '@/components/searchbar';
import RecordForPatientHeader from '@/components/RecordForPatientHeader';
import GlucoseTrendChart from '@/components/GlucoseTrendChart';
import VitalsTrendChart from '@/components/VitalsTrendChart';
import RiskProgressionChart from '@/components/RiskProgressionChart';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { colors } from '@/constants/colors';
import { patientsService, type Patient } from '@/services/patients';

export default function TrendsScreen() {
  const { role, isLoading: authLoading } = useAuth();
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadError(null);
        if (role === 'doctor') {
          const response = await patientsService.getPatients({ limit: 50 });
          if (cancelled) return;
          setPatients(response.items);
          if (response.items.length > 0) {
            setPatientId(response.items[0].id);
          }
        } else {
          const profile = await patientsService.getMyPatientProfile();
          if (cancelled) return;
          setPatientId(profile.id);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            role === 'doctor'
              ? 'Could not load your patient list.'
              : 'Could not load your health profile.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, role]);

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId) ?? null,
    [patients, patientId],
  );

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(query) ||
        p.patient_id?.toLowerCase().includes(query),
    );
  }, [patients, searchQuery]);

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header variant="coral" title="Health trends" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      {role === 'doctor' && (
        <Modal
          visible={pickerVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPickerVisible(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setPickerVisible(false)}
          >
            <Pressable
              className="max-h-[70%] rounded-t-3xl bg-white px-4 pb-8 pt-4"
              onPress={(e) => e.stopPropagation()}
            >
              <Text className="mb-3 text-center text-base font-bold text-text">
                Trends for
              </Text>
              <View className="mb-3">
                <SearchBar
                  placeholder="Search assigned patients"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView>
                {filteredPatients.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    className="border-b border-border/40 py-3"
                    onPress={() => {
                      setPatientId(p.id);
                      setPickerVisible(false);
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
      )}

      <Header variant="coral" title="Health trends" showBack />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          <Card className="mb-5 overflow-hidden rounded-2xl border border-white/25 bg-coral shadow-sm">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90 mb-2">
              Patient analytics
            </Text>
            <Text className="text-2xl font-bold text-white mb-2 tracking-tight">
              Trends overview
            </Text>
            <Text className="text-sm text-white/90 leading-6">
              Glucose, blood pressure, HbA1c, and diabetes risk over time — all in
              one place.
            </Text>
          </Card>

          {loadError ? (
            <Card className="border-border/80">
              <View className="items-center py-3">
                <View className="w-12 h-12 rounded-2xl bg-error/10 items-center justify-center mb-3">
                  <Ionicons
                    name="alert-circle-outline"
                    size={26}
                    color={colors.status.error}
                  />
                </View>
                <Text className="text-sm text-text-secondary text-center leading-6">
                  {loadError}
                </Text>
              </View>
            </Card>
          ) : role === 'doctor' && !patientId ? (
            <Card className="border-border/80">
              <Text className="text-sm text-text-secondary leading-6">
                No assigned patients yet. Once patients are linked to you, their
                trends will appear here.
              </Text>
            </Card>
          ) : (
            <>
              {role === 'doctor' && (
                <View className="mb-5 overflow-hidden rounded-t-[20px] bg-white shadow-sm">
                  <RecordForPatientHeader
                    label="Trends for"
                    name={selectedPatient?.full_name?.trim() || 'Select patient'}
                    subtitle={
                      selectedPatient
                        ? `ID: ${selectedPatient.patient_id} · ${selectedPatient.demographics.age} yrs · ${selectedPatient.demographics.gender}`
                        : undefined
                    }
                    onPressEdit={() => {
                      setSearchQuery('');
                      setPickerVisible(true);
                    }}
                  />
                </View>
              )}

              {patientId ? (
                <View key={patientId}>
                  <GlucoseTrendChart patientId={patientId} />

                  <VitalsTrendChart
                    patientId={patientId}
                    eyebrow="Trends"
                    title="Blood pressure"
                    subtitle="Systolic and diastolic over the last 30 days."
                    unit="mmHg"
                    range="30d"
                    emptyIcon="heart-outline"
                    series={[
                      {
                        code: 'BLOOD_PRESSURE_SYSTOLIC',
                        label: 'Systolic',
                        color: colors.status.error,
                      },
                      {
                        code: 'BLOOD_PRESSURE_DIASTOLIC',
                        label: 'Diastolic',
                        color: colors.accent.main,
                      },
                    ]}
                    referenceLines={[
                      {
                        value: 130,
                        color: colors.status.warning,
                        label: 'High systolic 130',
                      },
                    ]}
                  />

                  <VitalsTrendChart
                    patientId={patientId}
                    eyebrow="Trends"
                    title="HbA1c"
                    subtitle="Long-term glycemic control over the past year."
                    unit="%"
                    range="1y"
                    emptyIcon="water-outline"
                    series={[
                      {
                        code: 'HBA1C',
                        label: 'HbA1c',
                        color: colors.accent.main,
                      },
                    ]}
                    referenceLines={[
                      {
                        value: 6.5,
                        color: colors.status.error,
                        label: 'Diabetes 6.5',
                      },
                      {
                        value: 5.7,
                        color: colors.status.warning,
                        label: 'Prediabetes 5.7',
                      },
                    ]}
                  />

                  <RiskProgressionChart patientId={patientId} />
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
