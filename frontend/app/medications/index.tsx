import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import SearchBar from '@/components/searchbar';
import MedicationCard from '@/components/MedicationCard';
import EmptyState from '@/components/EmptyState';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { medicationsService, Medication } from '@/services/medications';

export default function MedicationsListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMedications = async () => {
    try {
      setError(null);
      const response = await medicationsService.getMedications({
        search: searchQuery || undefined,
        page: 1,
        limit: 100,
      });
      setMedications(response.items);
    } catch (err: any) {
      console.error('Error loading medications:', err);
      setError(err.message || 'Failed to load medications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMedications();
  }, []);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        loadMedications();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMedications();
  };

  if (loading && medications.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header variant="coral" title="Medications" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header variant="coral" title="Medications" showBack />
      <View className="px-6 pt-4 pb-4">
        <SearchBar
          placeholder="Search medications by name, brand, or category..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      {error && (
        <View className="mx-6 mb-4 p-4 bg-error/10 rounded-lg">
          <Text className="text-error text-sm">{error}</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="px-6">
          <Text className="text-base font-semibold text-text mb-4">
            {medications.length} Medication{medications.length !== 1 ? 's' : ''}
          </Text>

          {medications.length > 0 ? (
            medications.map((medication) => (
              <MedicationCard
                key={medication.id}
                medication={{
                  id: medication.id,
                  name: medication.name,
                  brand: medication.brand_name || '',
                  description: medication.description || '',
                  dosage: medication.how_to_use || '',
                  sideEffects: medication.side_effects,
                  warnings: medication.warnings,
                  contraindications: [],
                  category: 'Medication',
                }}
                onPress={() => router.push(`/medications/${medication.medication_id}` as any)}
              />
            ))
          ) : (
            <EmptyState
              title="No medications found"
              message="Try adjusting your search terms"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
