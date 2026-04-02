import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import MedicalReportHeader from '@/components/MedicalReportHeader';
import ReportRecordStatusPill from '@/components/ReportRecordStatusPill';
import SectionHeader from '@/components/SectionHeader';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { colors } from '@/constants/colors';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import {
  reportsService,
  type GeneratedReport,
  type UploadedReport,
} from '@/services/reports';

type SectionGroup = 'all' | 'profile' | 'recommendations' | 'monitoring';

const SECTION_TABS: { id: SectionGroup; label: string; a11yLabel: string }[] = [
  { id: 'all', label: 'All', a11yLabel: 'All sections' },
  { id: 'profile', label: 'Profile', a11yLabel: 'Patient and doctor profile' },
  { id: 'recommendations', label: 'Guidance', a11yLabel: 'Lifestyle and medication guidance' },
  { id: 'monitoring', label: 'Care plan', a11yLabel: 'Monitoring and next steps' },
];

function viewerParamsForUploaded(report: UploadedReport) {
  return {
    path: encodeURIComponent(report.file_url),
    title: encodeURIComponent(report.title),
    mime: report.mime_type,
    reportId: report.id,
    kind: 'uploaded',
  };
}

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function prettifyKey(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function flattenPayloadText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenPayloadText(item))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const nestedText = flattenPayloadText(nested);
        return nestedText ? `${prettifyKey(key)}: ${nestedText}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function iconForGroup(group: SectionGroup): keyof typeof Ionicons.glyphMap {
  switch (group) {
    case 'profile':
      return 'person-outline';
    case 'recommendations':
      return 'leaf-outline';
    case 'monitoring':
      return 'pulse-outline';
    default:
      return 'layers-outline';
  }
}

export default function ReportDetailsScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: 'uploaded' | 'generated' }>();
  const router = useRouter();
  const { role, isLoading: authLoading } = useAuth();
  const [uploadedReport, setUploadedReport] = useState<UploadedReport | null>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionGroup, setSectionGroup] = useState<SectionGroup>('all');
  const [sharing, setSharing] = useState(false);

  const effectiveKind = useMemo(
    () => (kind === 'uploaded' ? 'uploaded' : 'generated'),
    [kind],
  );

  const headerTitle = useMemo(() => {
    if (generatedReport?.title) {
      const t = generatedReport.title.trim();
      return t.length > 36 ? `${t.slice(0, 33)}…` : t;
    }
    if (uploadedReport?.title) {
      const t = uploadedReport.title.trim();
      return t.length > 36 ? `${t.slice(0, 33)}…` : t;
    }
    return 'Report';
  }, [generatedReport?.title, uploadedReport?.title]);

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

  const canOpenInViewer =
    !loading &&
    !authLoading &&
    !error &&
    effectiveKind === 'uploaded' &&
    Boolean(
      uploadedReport?.file_url && String(uploadedReport.file_url).trim(),
    );

  useEffect(() => {
    if (!canOpenInViewer) return;
    if (uploadedReport?.file_url) {
      router.replace({
        pathname: '/reports/viewer',
        params: viewerParamsForUploaded(uploadedReport),
      } as any);
    }
  }, [canOpenInViewer, uploadedReport, router]);

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <MedicalReportHeader title="Report" onBack={() => router.back()} />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  if (error || (!uploadedReport && !generatedReport)) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <MedicalReportHeader title="Report" onBack={() => router.back()} />
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

  if (canOpenInViewer) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <MedicalReportHeader title="Report" onBack={() => router.back()} />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  const generatedSections = generatedReport
    ? (() => {
        const payload = generatedReport.structured_payload ?? {};
        const orderedKeys = [
          'patient_details',
          'doctor_details',
          'patient_metrics_context',
          'lifestyle_suggestions',
          'medication_suggestions',
          'monitoring_plan',
          'next_steps',
          'doctor_considerations',
        ];
        const seen = new Set<string>();
        const sections: Array<{ key: string; title: string; text: string; group: SectionGroup }> = [];
        const groupForKey = (key: string): SectionGroup => {
          if (
            ['patient_details', 'doctor_details', 'patient_metrics_context', 'clinical_snapshot'].includes(
              key,
            )
          ) {
            return 'profile';
          }
          if (['lifestyle_suggestions', 'medication_suggestions'].includes(key)) {
            return 'recommendations';
          }
          if (['monitoring_plan', 'next_steps', 'doctor_considerations'].includes(key)) {
            return 'monitoring';
          }
          return 'monitoring';
        };
        for (const key of orderedKeys) {
          if (!(key in payload)) continue;
          seen.add(key);
          const text = flattenPayloadText(payload[key]);
          if (!text.trim()) continue;
          sections.push({ key, title: prettifyKey(key), text, group: groupForKey(key) });
        }
        return sections;
      })()
    : [];

  const filteredSections =
    sectionGroup === 'all'
      ? generatedSections
      : generatedSections.filter((section) => section.group === sectionGroup);

  const visibleSectionTabs = SECTION_TABS;

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <MedicalReportHeader title={headerTitle} onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="px-6 pt-4">
          {uploadedReport ? (
            <>
              <Card className="mb-4 border-border/90 bg-white">
                <View className="mb-3 flex-row items-start">
                  <View className="mr-4 h-12 w-12 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                    <Ionicons name="document-text-outline" size={24} color={colors.primary.main} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="mb-1 text-base font-semibold tracking-tight text-text">
                      {uploadedReport.title}
                    </Text>
                    <View className="mb-2 self-start rounded-full border border-primary/10 bg-primary/10 px-3 py-1">
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {uploadedReport.category.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <ReportRecordStatusPill
                      category={uploadedReport.category}
                      label={uploadedReport.category.replace(/_/g, ' ').toUpperCase()}
                    />
                  </View>
                </View>
                <View className="mb-3 flex-row items-center justify-between border-t border-border/60 pt-3">
                  <Badge
                    variant={uploadedReport.uploaded_by_role === 'doctor' ? 'info' : 'warning'}
                  >
                    uploaded by {uploadedReport.uploaded_by_role}
                  </Badge>
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                    <Text className="ml-1.5 text-xs text-text-tertiary">
                      {formatDateShort(uploadedReport.created_at)}
                    </Text>
                  </View>
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
            </>
          ) : null}

          {generatedReport ? (
            <>
              {/* Matches Saved → Records library hero + ReportCard document treatment */}
              <View className="mb-5 overflow-hidden rounded-2xl border border-white/25 bg-coral shadow-sm">
                <View className="px-5 pb-4 pt-5">
                  <Text className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                    AI report
                  </Text>
                  <Text className="mb-2 text-2xl font-bold tracking-tight text-white">
                    {generatedReport.title}
                  </Text>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <View className="rounded-full border border-white/30 bg-white/15 px-3 py-1">
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-white">
                        {generatedReport.report_type.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
                      <Text className="ml-1.5 text-xs text-white/90">
                        {formatDateShort(generatedReport.created_at)}
                      </Text>
                    </View>
                  </View>
                  {role === 'doctor' ? (
                    <View className="mt-4">
                      <TouchableOpacity
                        disabled={sharing || generatedReport.is_sent_to_patient}
                        onPress={async () => {
                          try {
                            setSharing(true);
                            const updated = await reportsService.shareGeneratedReport(generatedReport.id);
                            setGeneratedReport(updated);
                          } finally {
                            setSharing(false);
                          }
                        }}
                        activeOpacity={0.85}
                        className={`rounded-2xl px-4 py-3 ${
                          generatedReport.is_sent_to_patient
                            ? 'bg-white/25 border border-white/30'
                            : 'bg-white'
                        }`}
                      >
                        <Text
                          className={`text-center text-sm font-semibold ${
                            generatedReport.is_sent_to_patient ? 'text-white' : 'text-coral-ink'
                          }`}
                        >
                          {generatedReport.is_sent_to_patient
                            ? `Shared with patient${generatedReport.sent_to_patient_at ? ` • ${formatDateShort(generatedReport.sent_to_patient_at)}` : ''}`
                            : sharing
                              ? 'Sharing...'
                              : 'Share to patient'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Same segmented shell as ReportsRecordFilterBar */}
              <View
                className="mb-4 flex-row rounded-[20px] border border-coral-soft bg-white p-1"
                accessibilityRole="tablist"
              >
                {visibleSectionTabs.map((tab) => {
                  const active = sectionGroup === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => setSectionGroup(tab.id)}
                      activeOpacity={0.85}
                      accessibilityRole="tab"
                      accessibilityLabel={tab.a11yLabel}
                      accessibilityState={{ selected: active }}
                      className={`min-w-0 flex-1 rounded-2xl py-2.5 ${active ? 'bg-coral-soft' : ''}`}
                    >
                      <Text
                        className={`text-center text-xs font-bold ${
                          active ? 'text-coral-ink' : 'text-text-secondary'
                        }`}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <SectionHeader
                eyebrow="Contents"
                title="Report sections"
                subtitle={
                  filteredSections.length === 0
                    ? 'No sections match this filter.'
                    : `${filteredSections.length} section${filteredSections.length === 1 ? '' : 's'}`
                }
              />

              {filteredSections.map((section) => (
                <View
                  key={section.key}
                  className="mb-3 rounded-[18px] border border-coral-soft bg-surface-soft p-4"
                >
                  <View className="mb-3 flex-row items-start">
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10">
                      <Ionicons
                        name={iconForGroup(section.group)}
                        size={22}
                        color={colors.primary.main}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-base font-semibold tracking-tight text-text">
                        {section.title}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm leading-6 text-text-secondary">{section.text}</Text>
                </View>
              ))}
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
