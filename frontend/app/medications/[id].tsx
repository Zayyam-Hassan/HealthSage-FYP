import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import SectionHeader from '@/components/SectionHeader';
import Loader from '@/components/Loader';
import { medicationsService, Medication } from '@/services/medications';

export default function MedicationDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMedication();
  }, [id]);

  const loadMedication = async () => {
    try {
      setLoading(true);
      setError(null);
      const medicationData = await medicationsService.getMedication(id as string);
      setMedication(medicationData);
    } catch (err: any) {
      console.error('Error loading medication:', err);
      setError(err.message || 'Failed to load medication');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Medication Details" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !medication) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Medication Details" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-secondary text-center mb-4">
            {error || 'Medication not found'}
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Medication Details" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          {/* Medication Header */}
          <Card className="mb-4 border-border/80">
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-text mb-2">
                  {medication.name}
                </Text>
                {medication.brand_name && (
                  <Text className="text-base text-text-secondary mb-2">
                    Brand: {medication.brand_name}
                  </Text>
                )}
              </View>
            </View>
            {medication.how_to_use && (
              <View className="pt-4 border-t border-border">
                <Text className="text-sm font-semibold text-text mb-2">
                  Recommended Dosage
                </Text>
                <Text className="text-base text-text-secondary">
                  {medication.how_to_use}
                </Text>
              </View>
            )}
          </Card>

          {/* Description */}
          {medication.description && (
            <Card className="mb-4 border-border/80">
              <SectionHeader title="Description" />
              <Text className="text-sm text-text-secondary leading-5">
                {medication.description}
              </Text>
            </Card>
          )}

          {/* Side Effects */}
          {medication.side_effects.length > 0 && (
            <Card className="mb-4 border-border/80">
              <SectionHeader title="Side Effects" />
              {medication.side_effects.map((effect, index) => (
                <View key={index} className="flex-row items-start mb-2">
                  <Text className="text-warning mr-2">•</Text>
                  <Text className="text-sm text-text-secondary flex-1">
                    {effect}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          {/* Warnings */}
          {medication.warnings.length > 0 && (
            <Card className="mb-4 border-border/80">
              <SectionHeader title="Warnings" />
              {medication.warnings.map((warning, index) => (
                <View key={index} className="flex-row items-start mb-2">
                  <Text className="text-error mr-2">⚠</Text>
                  <Text className="text-sm text-text-secondary flex-1">
                    {warning}
                  </Text>
                </View>
              ))}
            </Card>
          )}

          {/* Action Button */}
          <Button
            variant="primary"
            onPress={() => router.push('/compatibility' as any)}
            fullWidth
          >
            Check Compatibility
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
