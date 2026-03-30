import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ReportRecordStatusPill from '@/components/ReportRecordStatusPill';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { colors } from '@/constants/colors';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import {
  reportsService,
  type GeneratedReport,
  type UploadedReport,
} from '@/services/reports';

function ReportDetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="bg-coral px-4 pb-3 pt-2">
      <View className="flex-row items-center rounded-2xl bg-white px-1 py-1.5 shadow-sm shadow-black/5">
        <TouchableOpacity
          onPress={onBack}
          className="h-11 w-11 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
            size={Platform.OS === 'ios' ? 26 : 22}
            color={colors.text.primary}
          />
        </TouchableOpacity>
        <Text
          className="flex-1 text-center text-base font-bold text-text"
          numberOfLines={1}
        >
          {title}
        </Text>
        <View className="h-11 w-11" />
      </View>
    </View>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReportDetailsScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: 'uploaded' | 'generated' }>();
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [uploadedReport, setUploadedReport] = useState<UploadedReport | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const effectiveKind = useMemo(
    () => (kind === 'uploaded' ? 'uploaded' : 'generated'),
    [kind],
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        if (effectiveKind === 'uploaded') {
          setUploadedReport(await reportsService.getUploadedReport(id));
          setGeneratedReport(null);
        } else {
          setGeneratedReport(await reportsService.getGeneratedReport(id));
          setUploadedReport(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, [effectiveKind, id]);

  const openUploadedInApp = (report: UploadedReport) => {
    router.push({
      pathname: '/reports/viewer',
      params: {
        path: encodeURIComponent(report.file_url),
        title: encodeURIComponent(report.title),
        mime: report.mime_type,
        reportId: report.id,
        kind: 'uploaded',
      },
    } as any);
  };

  const openGeneratedPdfInApp = (report: GeneratedReport) => {
    if (!report.attachment_url) return;
    router.push({
      pathname: '/reports/viewer',
      params: {
        path: encodeURIComponent(report.attachment_url),
        title: encodeURIComponent(report.title),
        mime: 'application/pdf',
        reportId: report.id,
        kind: 'generated',
      },
    } as any);
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <ReportDetailHeader title="Report Details" onBack={() => router.back()} />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (error || (!uploadedReport && !generatedReport)) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <ReportDetailHeader title="Report Details" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-4 text-center text-base text-text-secondary">
            {error || 'Report not found'}
          </Text>
          <Button variant="outline" onPress={() => router.back()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <ReportDetailHeader title="Report Details" onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-4">
          {uploadedReport ? (
            <>
              <Card className="mb-4 border-border/90 bg-white">
                <View className="mb-3 flex-row items-start justify-between gap-2">
                  <Text className="min-w-0 flex-1 text-xl font-bold text-text">
                    {uploadedReport.title}
                  </Text>
                  <ReportRecordStatusPill
                    category={uploadedReport.category}
                    label={uploadedReport.category.replace(/_/g, ' ').toUpperCase()}
                  />
                </View>
                <View className="mb-3 flex-row items-center justify-between">
                  <Badge
                    variant={uploadedReport.uploaded_by_role === 'doctor' ? 'info' : 'warning'}
                  >
                    uploaded by {uploadedReport.uploaded_by_role}
                  </Badge>
                  <Text className="text-xs text-text-secondary">
                    {formatDate(uploadedReport.created_at)}
                  </Text>
                </View>
                <Text className="text-sm text-text-secondary">File: {uploadedReport.file_name}</Text>
                <Text className="text-sm text-text-secondary">Type: {uploadedReport.mime_type}</Text>
                {uploadedReport.file_size ? (
                  <Text className="text-sm text-text-secondary">
                    Size: {Math.round(uploadedReport.file_size / 1024)} KB
                  </Text>
                ) : null}
              </Card>

              {uploadedReport.description ? (
                <Card className="mb-4 border-border/80 bg-white">
                  <Text className="mb-2 text-base font-semibold text-text">Description</Text>
                  <Text className="text-sm leading-6 text-text-secondary">
                    {uploadedReport.description}
                  </Text>
                </Card>
              ) : null}

              <Button onPress={() => openUploadedInApp(uploadedReport)}>Open file in app</Button>
            </>
          ) : null}

          {generatedReport ? (
            <>
              <Card className="mb-4 border-border/90 bg-white">
                <View className="mb-3 flex-row items-start justify-between gap-2">
                  <Text className="min-w-0 flex-1 text-xl font-bold text-text">
                    {generatedReport.title}
                  </Text>
                  <ReportRecordStatusPill
                    category="system_generated"
                    label="SYSTEM GENERATED"
                  />
                </View>
                <View className="mb-3 flex-row justify-end">
                  <Text className="text-xs text-text-secondary">
                    {formatDate(generatedReport.created_at)}
                  </Text>
                </View>
                <Text className="mb-2 text-sm text-text-secondary">
                  Type: {generatedReport.report_type.replace(/_/g, ' ')}
                </Text>
                {generatedReport.summary ? (
                  <Text className="text-sm leading-6 text-text-secondary">
                    {generatedReport.summary}
                  </Text>
                ) : null}
              </Card>

              {Object.entries(generatedReport.structured_payload ?? {}).map(([key, value]) => {
                const text =
                  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

                return (
                  <Card key={key} className="mb-4 border-border/80 bg-white">
                    <Text className="mb-2 text-base font-semibold text-text">
                      {key.replace(/_/g, ' ')}
                    </Text>
                    <Text className="text-sm leading-6 text-text-secondary">{text}</Text>
                  </Card>
                );
              })}

              {generatedReport.attachment_url ? (
                <Button onPress={() => openGeneratedPdfInApp(generatedReport)}>
                  Open PDF in app
                </Button>
              ) : null}
            </>
          ) : null}

          {role === 'patient' ? (
            <View className="mt-4">
              <Text className="text-xs text-text-secondary">
                Visible from your patient report center.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
