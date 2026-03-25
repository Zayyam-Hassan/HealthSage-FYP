import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Card from '@/components/Card';
import Header from '@/components/Header';
import ReportCard from '@/components/Card/ReportCard';
import EmptyState from '@/components/EmptyState';
import Loader from '@/components/Loader';
import { authService, type UserRole } from '@/services/auth';
import { reportsService, Report } from '@/services/reports';

export default function ReportsScreen() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async () => {
    try {
      setError(null);
      const currentUser = await authService.getCurrentUser();
      setRole(currentUser?.role ?? null);
      const response = await reportsService.getReports({
        page: 1,
        limit: 100,
      });
      setReports(response.items);
    } catch (err: any) {
      console.error('Error loading reports:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadReports();
    }, []),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      lab_report: 'Lab Report',
      ai_summary: 'AI Summary',
      visit_summary: 'Visit Summary',
      other: 'Report',
    };
    return labels[type] || type;
  };

  const getPreview = (report: Report) => {
    if (typeof report.content !== 'object' || !report.content) {
      return String(report.content).substring(0, 120);
    }

    const content = report.content as Record<string, unknown>;
    const summary =
      (content.overview as string) ||
      (content.latest_risk_summary as string) ||
      (content.patient_friendly_title as string) ||
      'Open this report to review the latest care guidance.';

    return summary.length > 120 ? `${summary.substring(0, 117)}...` : summary;
  };

  if (loading && reports.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="My Reports" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="My Reports" showBack />
      <View className="px-6 pt-4">
        <Card className="mb-4 bg-primary/5 border border-primary/20">
          <Text className="text-lg font-semibold text-text mb-1">
            {role === 'doctor' ? 'Care reports' : 'Shared reports'}
          </Text>
          <Text className="text-sm text-text-secondary">
            {role === 'doctor'
              ? 'Draft, review, and send patient-friendly PDF reports from here.'
              : 'Reports shared by your doctor will appear here once they are sent.'}
          </Text>
        </Card>
      </View>
      {error && (
        <View className="mx-6 mt-0 p-4 bg-error/10 rounded-lg">
          <Text className="text-error text-sm">{error}</Text>
        </View>
      )}
      {reports.length > 0 ? (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-6">
              <ReportCard
                title={item.title}
                date={formatDate(item.generated_at)}
                type={getTypeLabel(item.type)}
                preview={getPreview(item)}
                onPress={() => router.push(`/reports/${item.id}`)}
              />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <EmptyState
          title="No Reports"
          message="You don't have any reports yet"
        />
      )}
    </SafeAreaView>
  );
}
