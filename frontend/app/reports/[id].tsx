import React, { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { API_BASE_URL } from '@/services/config';
import { authService, type UserRole } from '@/services/auth';
import {
  reportsService,
  type GeneratedReport,
  type UploadedReport,
} from '@/services/reports';

function resolveApiUrl(relativeUrl: string) {
  if (relativeUrl.startsWith('http')) return relativeUrl;
  return `${API_BASE_URL}${relativeUrl}`;
}

async function openAuthorizedUrl(relativeUrl: string) {
  const token = await authService.getAccessToken();
  const url = resolveApiUrl(relativeUrl);
  const separator = url.includes('?') ? '&' : '?';
  const authorizedUrl = token
    ? `${url}${separator}access_token=${encodeURIComponent(token)}`
    : url;
  await Linking.openURL(authorizedUrl);
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
  const [role, setRole] = useState<UserRole | null>(null);
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
        const currentUser = await authService.getCurrentUser();
        setRole(currentUser?.role ?? null);

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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Report Details" showBack />
        <View className="flex-1 items-center justify-center">
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  if (error || (!uploadedReport && !generatedReport)) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <Header title="Report Details" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-secondary text-center mb-4">
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
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Report Details" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-4">
          {uploadedReport ? (
            <>
              <Card className="mb-4 border border-border">
                <Text className="text-xl font-bold text-text mb-2">{uploadedReport.title}</Text>
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
                <Text className="text-sm text-text-secondary mb-2">
                  Category: {uploadedReport.category.replace(/_/g, ' ')}
                </Text>
                <Text className="text-sm text-text-secondary">
                  File: {uploadedReport.file_name}
                </Text>
                <Text className="text-sm text-text-secondary">
                  Type: {uploadedReport.mime_type}
                </Text>
                {uploadedReport.file_size ? (
                  <Text className="text-sm text-text-secondary">
                    Size: {Math.round(uploadedReport.file_size / 1024)} KB
                  </Text>
                ) : null}
              </Card>

              {uploadedReport.description ? (
                <Card className="mb-4">
                  <Text className="text-base font-semibold text-text mb-2">Description</Text>
                  <Text className="text-sm text-text-secondary leading-6">
                    {uploadedReport.description}
                  </Text>
                </Card>
              ) : null}

              <Button onPress={() => void openAuthorizedUrl(uploadedReport.file_url)}>
                Open file
              </Button>
            </>
          ) : null}

          {generatedReport ? (
            <>
              <Card className="mb-4 border border-border">
                <Text className="text-xl font-bold text-text mb-2">{generatedReport.title}</Text>
                <View className="mb-3 flex-row items-center justify-between">
                  <Badge variant="success">generated by system</Badge>
                  <Text className="text-xs text-text-secondary">
                    {formatDate(generatedReport.created_at)}
                  </Text>
                </View>
                <Text className="text-sm text-text-secondary mb-2">
                  Type: {generatedReport.report_type.replace(/_/g, ' ')}
                </Text>
                {generatedReport.summary ? (
                  <Text className="text-sm text-text-secondary leading-6">
                    {generatedReport.summary}
                  </Text>
                ) : null}
              </Card>

              {Object.entries(generatedReport.structured_payload ?? {}).map(([key, value]) => {
                const text =
                  typeof value === 'string'
                    ? value
                    : JSON.stringify(value, null, 2);

                return (
                  <Card key={key} className="mb-4">
                    <Text className="text-base font-semibold text-text mb-2">
                      {key.replace(/_/g, ' ')}
                    </Text>
                    <Text className="text-sm text-text-secondary leading-6">{text}</Text>
                  </Card>
                );
              })}

              {generatedReport.attachment_url ? (
                <Button onPress={() => void openAuthorizedUrl(generatedReport.attachment_url!)}>
                  Open PDF
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
