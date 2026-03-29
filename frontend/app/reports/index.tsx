import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import Header from '@/components/Header';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import SuccessPopup from '@/components/SuccessPopup';
import { colors } from '@/constants/colors';
import { API_BASE_URL } from '@/services/config';
import { authService } from '@/services/auth';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import { doctorsService } from '@/services/doctors';
import { type Patient } from '@/services/patients';
import {
  reportsService,
  type GeneratedReport,
  type ReportOverviewResponse,
  type UploadedReport,
  type UploadedReportCategory,
} from '@/services/reports';

const categoryOptions: { value: UploadedReportCategory; label: string }[] = [
  { value: 'lab_report', label: 'Lab report' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'discharge_summary', label: 'Discharge summary' },
  { value: 'test_result', label: 'Test result' },
  { value: 'doctor_note', label: 'Doctor note' },
  { value: 'general_document', label: 'General document' },
];

type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  base64: string;
};

type UploadDialogState = {
  visible: boolean;
  title: string;
  message: string;
};

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

function fileToBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Unable to read selected file'));
    reader.readAsDataURL(file);
  });
}

async function assetToBase64(asset: DocumentPicker.DocumentPickerAsset) {
  if ((asset as any).file) {
    return fileToBase64((asset as any).file as Blob);
  }

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return fileToBase64(blob);
}

function getGeneratedPreview(report: GeneratedReport) {
  if (report.summary) return report.summary;
  const payload = report.structured_payload ?? {};
  const overview =
    typeof payload.overview === 'string'
      ? payload.overview
      : typeof payload.latest_risk_summary === 'string'
        ? payload.latest_risk_summary
        : typeof payload.patient_snapshot === 'object'
          ? 'Generated report available for review.'
          : 'Generated report available for review.';
  return overview;
}

export default function ReportsScreen() {
  const router = useRouter();
  const { patientId: queryPatientId } = useLocalSearchParams<{ patientId?: string }>();
  const { role, refreshUser, isLoading: authLoading } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [overview, setOverview] = useState<ReportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<UploadedReportCategory>('lab_report');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadDialog, setUploadDialog] = useState<UploadDialogState>({
    visible: false,
    title: '',
    message: '',
  });

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const resetUploadForm = () => {
    setTitle('');
    setDescription('');
    setCategory('lab_report');
    setPickedFile(null);
  };

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const currentUser = await refreshUser();
      const currentRole = currentUser?.role ?? null;

      if (currentRole === 'doctor') {
        const doctorPatients = (await doctorsService.getMyPatients()).items;
        setPatients(doctorPatients);
        const resolvedPatientId =
          selectedPatientId ||
          String(queryPatientId ?? '') ||
          doctorPatients[0]?.id ||
          '';
        setSelectedPatientId(resolvedPatientId);

        if (!resolvedPatientId) {
          setOverview({ uploaded_reports: [], generated_reports: [] });
          return;
        }

        const reportOverview = await reportsService.getDoctorPatientReportsOverview(
          resolvedPatientId,
        );
        setOverview(reportOverview);
      } else {
        setPatients([]);
        setSelectedPatientId('');
        const reportOverview = await reportsService.getPatientReportsOverview();
        setOverview(reportOverview);
      }
    } catch (err: any) {
      console.error('Error loading reports workspace:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [queryPatientId, selectedPatientId, refreshUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pickFile = async () => {
    try {
      setError(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const base64 = await assetToBase64(asset);
      setPickedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/pdf',
        size: asset.size,
        base64,
      });
      if (!title.trim()) {
        setTitle(asset.name.replace(/\.[^.]+$/, ''));
      }
    } catch (err: any) {
      setError(err.message || 'Unable to pick file');
    }
  };

  const validateUploadForm = () => {
    if (!pickedFile) {
      return 'Select a PDF or image file first.';
    }

    if (!title.trim()) {
      return 'Enter a report title before uploading.';
    }

    if (pickedFile.size && pickedFile.size > MAX_UPLOAD_SIZE_BYTES) {
      return 'Selected file is larger than the 10MB upload limit.';
    }

    if (role === 'doctor' && !selectedPatientId) {
      return 'Select a patient first.';
    }

    return null;
  };

  const performUpload = async () => {
    if (!pickedFile) {
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const payload = {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        file_name: pickedFile.name,
        mime_type: pickedFile.mimeType,
        file_data_base64: pickedFile.base64,
      };

      if (role === 'doctor') {
        await reportsService.uploadDoctorReport(selectedPatientId, payload);
      } else {
        await reportsService.uploadPatientReport(payload);
      }

      resetUploadForm();
      await loadData();
      setSuccessMessage(
        role === 'doctor'
          ? 'Report uploaded and shared successfully.'
          : 'Your report was uploaded successfully.',
      );
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Unable to upload report');
    } finally {
      setUploading(false);
    }
  };

  const submitUpload = async () => {
    const validationMessage = validateUploadForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const reportOwner =
      role === 'doctor'
        ? selectedPatient?.full_name || 'this patient'
        : 'your doctor';

    setUploadDialog({
      visible: true,
      title: 'Confirm upload',
      message: `Upload "${title.trim()}" and share it with ${reportOwner}?`,
    });
  };

  const generateReport = async (kind: 'risk' | 'treatment' | 'overview') => {
    if (!selectedPatientId) {
      setError('Select a patient first.');
      return;
    }

    try {
      setGenerating(kind);
      setError(null);
      if (kind === 'risk') {
        await reportsService.generateRiskSummary(selectedPatientId);
      } else if (kind === 'treatment') {
        await reportsService.generateTreatmentSummary(selectedPatientId);
      } else {
        await reportsService.generateOverview(selectedPatientId);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const openUploaded = (report: UploadedReport) =>
    router.push({
      pathname: '/reports/[id]',
      params: { id: report.id, kind: 'uploaded' },
    } as any);

  const openGenerated = (report: GeneratedReport) =>
    router.push({
      pathname: '/reports/[id]',
      params: { id: report.id, kind: 'generated' },
    } as any);

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <AppDialog
          visible={uploadDialog.visible}
          title={uploadDialog.title}
          message={uploadDialog.message}
          onClose={() => setUploadDialog({ visible: false, title: '', message: '' })}
          actions={[
            {
              label: 'Cancel',
              variant: 'secondary',
              onPress: () => undefined,
            },
            {
              label: 'Upload',
              variant: 'primary',
              onPress: () => {
                void performUpload();
              },
            },
          ]}
        />
        <SuccessPopup
          visible={showSuccess}
          message={successMessage}
          onClose={() => setShowSuccess(false)}
        />
        <Header title="Reports" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <AppDialog
        visible={uploadDialog.visible}
        title={uploadDialog.title}
        message={uploadDialog.message}
        onClose={() => setUploadDialog({ visible: false, title: '', message: '' })}
        actions={[
          {
            label: 'Cancel',
            variant: 'secondary',
            onPress: () => undefined,
          },
          {
            label: 'Upload',
            variant: 'primary',
            onPress: () => {
              void performUpload();
            },
          },
        ]}
      />
      <SuccessPopup
        visible={showSuccess}
        message={successMessage}
        onClose={() => setShowSuccess(false)}
      />
      <Header title="Reports" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.coral.main}
            colors={[colors.coral.main]}
          />
        }
      >
        <View className="px-6 pt-4">
          <Card className="mb-4 bg-surface-soft border-coral-soft shadow-sm">
            <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-1">
              {role === 'doctor' ? 'Workspace' : 'Your documents'}
            </Text>
            <Text className="text-lg font-semibold text-text mb-1 leading-6">
              {role === 'doctor' ? 'Patient reports' : 'Report center'}
            </Text>
            <Text className="text-sm text-text-secondary leading-6">
              {role === 'doctor'
                ? 'Pick a patient, upload files, and generate structured reports in separate sections.'
                : 'Upload for your care team and review uploads separately from generated summaries.'}
            </Text>
          </Card>

          {role === 'doctor' ? (
            <Card className="mb-4 border-coral-soft bg-surface-soft">
              <Text className="text-base font-semibold text-text mb-1">Select patient</Text>
              <Text className="text-sm text-text-secondary mb-3 leading-5">
                Reports load for the patient you select below.
              </Text>
              {patients.length === 0 ? (
                <Text className="text-sm text-text-secondary">
                  No assigned patients available yet.
                </Text>
              ) : (
                <View className="flex-row flex-wrap">
                  {patients.map((patient) => {
                    const selected = patient.id === selectedPatientId;
                    return (
                      <TouchableOpacity
                        key={patient.id}
                        className={`mr-2 mb-2 rounded-2xl border px-4 py-3 ${
                          selected
                            ? 'border-coral-deep bg-coral-soft'
                            : 'border-border bg-white'
                        }`}
                        onPress={() => setSelectedPatientId(patient.id)}
                        activeOpacity={0.85}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            selected ? 'text-coral-ink' : 'text-text'
                          }`}
                        >
                          {patient.full_name}
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          {patient.patient_id}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Card>
          ) : null}

          {error ? (
            <View className="mb-4 rounded-xl bg-error/10 px-4 py-3">
              <Text className="text-sm text-error">{error}</Text>
            </View>
          ) : null}

          <Card className="mb-4 border-coral-soft bg-surface-soft">
            <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep mb-2">
              Add document
            </Text>
            <Text className="text-base font-semibold text-text mb-3">
              {role === 'doctor'
                ? `Upload document${selectedPatient ? ` for ${selectedPatient.full_name}` : ''}`
                : 'Upload report for doctor'}
            </Text>
            <FormInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="April lab report"
              className="mb-2"
            />
            <Text className="text-sm font-medium text-text mb-2">Category</Text>
            <View className="mb-4 flex-row flex-wrap">
              {categoryOptions.map((option) => {
                const selected = option.value === category;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setCategory(option.value)}
                    className={`mr-2 mb-2 rounded-full border px-3 py-2 ${
                      selected ? 'border-coral-deep bg-coral-soft' : 'border-border bg-white'
                    }`}
                  >
                    <Text className={`text-sm ${selected ? 'text-coral-ink' : 'text-text'}`}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <FormInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional note for the doctor or patient"
              multiline
              numberOfLines={3}
            />
            <Button variant="outline" onPress={pickFile}>
              {pickedFile ? 'Change file' : 'Choose file'}
            </Button>
            {pickedFile ? (
              <View className="mt-3 rounded-2xl border border-dashed border-coral-soft bg-coral-soft px-4 py-4">
                <Text className="text-sm font-semibold text-text">{pickedFile.name}</Text>
                <Text className="text-xs text-text-secondary">
                  {pickedFile.mimeType}
                  {pickedFile.size ? ` • ${Math.round(pickedFile.size / 1024)} KB` : ''}
                </Text>
              </View>
            ) : null}
            <Button className="mt-4" onPress={submitUpload} loading={uploading}>
              Upload report
            </Button>
          </Card>

          {role === 'doctor' ? (
            <Card className="mb-4 border-coral-soft bg-white">
              <Text className="text-base font-semibold text-text mb-3">
                System-generated reports
              </Text>
              <Text className="text-sm text-text-secondary leading-5 mb-4">
                Create structured reports from current system data without mixing them into uploaded files.
              </Text>
              <Button
                variant="outline"
                className="mb-3"
                onPress={() => generateReport('risk')}
                loading={generating === 'risk'}
              >
                Generate risk summary
              </Button>
              <Button
                variant="outline"
                className="mb-3"
                onPress={() => generateReport('treatment')}
                loading={generating === 'treatment'}
              >
                Generate treatment summary
              </Button>
              <Button
                onPress={() => generateReport('overview')}
                loading={generating === 'overview'}
              >
                Generate patient overview
              </Button>
            </Card>
          ) : null}

          <Card padding="none" className="mb-4 border-coral-soft bg-surface-soft overflow-hidden shadow-sm">
            <View className="border-b border-coral-soft bg-white/80 px-4 py-3">
              <Text className="text-lg font-semibold text-text tracking-tight">Report library</Text>
              <Text className="text-sm text-text-secondary leading-5 mt-0.5">
                Uploads and system summaries in one place—each row opens the full detail view.
              </Text>
            </View>

            <View className="border-b border-coral-soft/80 bg-coral-soft/35 px-4 py-2.5">
              <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep">
                Uploaded
              </Text>
              <Text className="text-xs text-text-secondary mt-0.5">
                Files shared with your care team
              </Text>
            </View>
            {(overview?.uploaded_reports.length ?? 0) === 0 ? (
              <View className="px-4 py-4 border-b border-border/50">
                <Text className="text-sm text-text-secondary leading-5">
                  No uploaded reports yet. Add a file above to populate this list.
                </Text>
              </View>
            ) : (
              overview?.uploaded_reports.map((report, index) => (
                <TouchableOpacity
                  key={report.id}
                  onPress={() => openUploaded(report)}
                  activeOpacity={0.85}
                  className={`px-4 py-4 ${index < (overview?.uploaded_reports.length ?? 0) - 1 ? 'border-b border-border/40' : ''}`}
                >
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-text flex-1 pr-2">{report.title}</Text>
                    <Badge
                      variant={report.uploaded_by_role === 'doctor' ? 'info' : 'warning'}
                      size="sm"
                    >
                      uploaded by {report.uploaded_by_role}
                    </Badge>
                  </View>
                  <Text className="text-sm text-text-secondary">
                    {categoryOptions.find((option) => option.value === report.category)?.label ??
                      report.category}
                  </Text>
                  {report.description ? (
                    <Text className="mt-2 text-sm text-text-secondary leading-5">
                      {report.description}
                    </Text>
                  ) : null}
                  <Text className="mt-3 text-xs text-text-secondary">
                    {report.file_name} • {formatDate(report.created_at)}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <View className="border-t border-coral-soft/80 bg-coral-soft/35 px-4 py-2.5">
              <Text className="text-xs font-semibold uppercase tracking-wide text-coral-deep">
                System-generated
              </Text>
              <Text className="text-xs text-text-secondary mt-0.5">
                Structured summaries from your record
              </Text>
            </View>
            {(overview?.generated_reports.length ?? 0) === 0 ? (
              <View className="px-4 py-4">
                <Text className="text-sm text-text-secondary leading-5">
                  No generated reports yet. Doctors can create summaries from the tools above.
                </Text>
              </View>
            ) : (
              overview?.generated_reports.map((report, index) => (
                <TouchableOpacity
                  key={report.id}
                  onPress={() => openGenerated(report)}
                  activeOpacity={0.85}
                  className={`px-4 py-4 ${index < (overview?.generated_reports.length ?? 0) - 1 ? 'border-b border-border/40' : ''}`}
                >
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-text flex-1 pr-2">{report.title}</Text>
                    <Badge variant="success" size="sm">
                      generated by system
                    </Badge>
                  </View>
                  <Text className="text-sm text-text-secondary">
                    {report.report_type.replace(/_/g, ' ')}
                  </Text>
                  <Text className="mt-2 text-sm text-text-secondary leading-5">
                    {getGeneratedPreview(report)}
                  </Text>
                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-xs text-text-secondary">
                      {formatDate(report.created_at)}
                    </Text>
                    {report.attachment_url ? (
                      <TouchableOpacity
                        onPress={(event) => {
                          event.stopPropagation?.();
                          void openAuthorizedUrl(report.attachment_url!);
                        }}
                      >
                        <Text className="text-xs font-semibold text-coral-deep">Open PDF</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
