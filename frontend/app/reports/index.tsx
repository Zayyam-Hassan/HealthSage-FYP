import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AppDialog from '@/components/AppDialog';
import Button from '@/components/Button';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import SearchBar from '@/components/searchbar';
import ReportsFooterNav, { type ReportsPrimaryTab } from '@/components/ReportsFooterNav';
import ReportsRecordFilterBar, {
  type ReportsRecordFilter,
} from '@/components/ReportsRecordFilterBar';
import SuccessPopup from '@/components/SuccessPopup';
import { colors } from '@/constants/colors';
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
import ReportRecordStatusPill from '@/components/ReportRecordStatusPill';
import MedicalReportHeader from '@/components/MedicalReportHeader';
import RecordForPatientHeader from '@/components/RecordForPatientHeader';

const RECORD_TYPE_OPTIONS: {
  value: UploadedReportCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'patient_sent', label: 'patient sent', icon: 'person-outline' },
  { value: 'doctor_sent', label: 'doctor sent', icon: 'medkit-outline' },
  { value: 'system_generated', label: 'system generated', icon: 'hardware-chip-outline' },
];

function formatRecordTypeLabel(category: string): string {
  const match = RECORD_TYPE_OPTIONS.find((o) => o.value === category);
  return match?.label ?? category.replace(/_/g, ' ');
}

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

function formatDate(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

async function imageAssetToPickedFile(asset: ImagePicker.ImagePickerAsset): Promise<PickedFile> {
  const uri = asset.uri;
  const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
  const mimeType = asset.mimeType ?? 'image/jpeg';
  let base64: string;
  if (asset.base64) {
    base64 = asset.base64;
  } else {
    const response = await fetch(uri);
    const blob = await response.blob();
    base64 = await fileToBase64(blob);
  }
  return {
    uri,
    name,
    mimeType,
    size: asset.fileSize,
    base64,
  };
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

function defaultCategory(role: 'patient' | 'doctor' | null): UploadedReportCategory {
  return role === 'doctor' ? 'doctor_sent' : 'patient_sent';
}

export default function ReportsScreen() {
  const router = useRouter();
  const { patientId: queryPatientId } = useLocalSearchParams<{ patientId?: string }>();
  const { user, role, refreshUser, isLoading: authLoading } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [overview, setOverview] = useState<ReportOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [category, setCategory] = useState<UploadedReportCategory>('patient_sent');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [workspacePhase, setWorkspacePhase] = useState<'intro' | 'form'>('intro');
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [patientPickerVisible, setPatientPickerVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [recordDate, setRecordDate] = useState(() => new Date());
  const [androidDateOpen, setAndroidDateOpen] = useState(false);
  const [uploadDialog, setUploadDialog] = useState<UploadDialogState>({
    visible: false,
    title: '',
    message: '',
  });
  const [primaryTab, setPrimaryTab] = useState<ReportsPrimaryTab>('view');
  const [recordTypeFilter, setRecordTypeFilter] = useState<ReportsRecordFilter>('all');
  const insets = useSafeAreaInsets();

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const filteredPatients = useMemo(() => {
    const query = patientSearchQuery.trim().toLowerCase();
    if (!query) return patients;

    return patients.filter(
      (patient) =>
        patient.full_name?.toLowerCase().includes(query) ||
        patient.patient_id?.toLowerCase().includes(query) ||
        patient.conditions?.some((condition) => condition.toLowerCase().includes(query)),
    );
  }, [patients, patientSearchQuery]);

  const recordForName =
    role === 'doctor'
      ? selectedPatient?.full_name ?? 'Select patient'
      : user?.display_name || 'You';

  const filteredUploaded = useMemo(() => {
    const items = overview?.uploaded_reports ?? [];
    if (recordTypeFilter === 'all') return items;
    return items.filter((r) => r.category === recordTypeFilter);
  }, [overview, recordTypeFilter]);

  const showGeneratedSection =
    recordTypeFilter === 'all' || recordTypeFilter === 'system_generated';

  const filteredGenerated = useMemo(() => {
    if (!showGeneratedSection) return [];
    return overview?.generated_reports ?? [];
  }, [overview, showGeneratedSection]);

  const resetUploadForm = () => {
    setCategory(defaultCategory(role));
    setPickedFile(null);
    setRecordDate(new Date());
  };

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const currentUser = await refreshUser();
      const currentRole = currentUser?.role ?? null;

      if (currentRole === 'doctor') {
        const doctorPatients = (await doctorsService.getMyPatients()).items;
        setPatients(doctorPatients);
        // Frontend guard: ensure we only ever load reports for patients assigned to this doctor.
        const doctorPatientIds = new Set(doctorPatients.map((p) => p.id));
        const candidatePatientId =
          selectedPatientId || String(queryPatientId ?? '') || doctorPatients[0]?.id || '';

        const resolvedPatientId = doctorPatientIds.has(candidatePatientId)
          ? candidatePatientId
          : doctorPatients[0]?.id || '';

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
    setCategory(defaultCategory(role));
  }, [role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyPickedFile = async (file: PickedFile) => {
    setPickedFile(file);
    setWorkspacePhase('form');
    setAddSheetVisible(false);
  };

  const pickDocument = async () => {
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
      await applyPickedFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || 'application/pdf',
        size: asset.size,
        base64,
      });
    } catch (err: any) {
      setError(err.message || 'Unable to pick file');
    }
  };

  const pickFromGallery = async () => {
    try {
      setError(null);
      if (Platform.OS !== 'web') {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          setError('Photo library permission is required.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.92,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = await imageAssetToPickedFile(result.assets[0]);
      await applyPickedFile(file);
    } catch (err: any) {
      setError(err.message || 'Unable to open gallery');
    }
  };

  const takePhoto = async () => {
    try {
      setError(null);
      if (Platform.OS === 'web') {
        await pickFromGallery();
        return;
      }
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        setError('Camera permission is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = await imageAssetToPickedFile(result.assets[0]);
      await applyPickedFile(file);
    } catch (err: any) {
      setError(err.message || 'Unable to use camera');
    }
  };

  const validateUploadForm = () => {
    if (!pickedFile) {
      return 'Add a file or photo first.';
    }

    if (pickedFile.size && pickedFile.size > MAX_UPLOAD_SIZE_BYTES) {
      return 'Selected file is larger than the 10MB upload limit.';
    }

    if (role === 'doctor' && !selectedPatientId) {
      return 'Select a patient first.';
    }

    return null;
  };

  const uploadTitle = () => {
    if (!pickedFile) return '';
    return pickedFile.name.replace(/\.[^.]+$/, '') || 'Medical record';
  };

  const performUpload = async () => {
    if (!pickedFile) {
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const payload = {
        title: uploadTitle(),
        category,
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
      setWorkspacePhase('intro');
      setPrimaryTab('view');
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
      message: `Upload "${uploadTitle()}" and share it with ${reportOwner}?`,
    });
  };

  const generateReport = async (kind: 'risk' | 'treatment' | 'overview') => {
    if (!selectedPatientId) {
      setError('Select a patient first.');
      return;
    }

    try {
      setGenerateModalVisible(false);
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

  const openUploadedFile = (report: UploadedReport) => {
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

  const openGeneratedReport = (report: GeneratedReport) => {
    if (report.attachment_url) {
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
      return;
    }
    router.push({
      pathname: '/reports/[id]',
      params: { id: report.id, kind: 'generated' },
    } as any);
  };

  const handleHeaderBack = () => {
    if (primaryTab === 'upload' && workspacePhase === 'form') {
      resetUploadForm();
      setWorkspacePhase('intro');
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const headerTitle =
    primaryTab === 'view'
      ? 'My records'
      : workspacePhase === 'form'
        ? 'Add Report'
        : 'Medical Report';

  const canShowRecordLists = role === 'patient' || (role === 'doctor' && Boolean(selectedPatientId));
  const showViewFilters = primaryTab === 'view' && canShowRecordLists;

  const onRecordDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidDateOpen(false);
    }
    if (event.type === 'dismissed' || !date) return;
    setRecordDate(date);
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <AppDialog
          visible={uploadDialog.visible}
          title={uploadDialog.title}
          message={uploadDialog.message}
          onClose={() => setUploadDialog({ visible: false, title: '', message: '' })}
          actions={[
            { label: 'Cancel', variant: 'secondary', onPress: () => undefined },
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
        <MedicalReportHeader title="My records" onBack={handleHeaderBack} />
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
          { label: 'Cancel', variant: 'secondary', onPress: () => undefined },
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

      <Modal
        visible={patientPickerVisible}
        animationType="fade"
        transparent
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
                placeholder="Search assigned patients"
                value={patientSearchQuery}
                onChangeText={setPatientSearchQuery}
              />
            </View>
            <ScrollView>
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
                    {p.full_name?.trim() || 'Patient'}
                  </Text>
                  {(typeof p.age === 'number' || p.gender) ? (
                    <Text className="text-xs text-text-secondary">
                      {typeof p.age === 'number' ? `${p.age} yrs` : ''}
                      {typeof p.age === 'number' && p.gender ? ' · ' : ''}
                      {p.gender ?? ''}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={generateModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setGenerateModalVisible(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/40 px-6"
          onPress={() => setGenerateModalVisible(false)}
        >
          <Pressable
            className="w-full max-w-sm rounded-2xl bg-white px-4 py-5"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="mb-4 text-center text-base font-bold text-text">
              Generate structured summary
            </Text>
            <Button
              variant="outline"
              className="mb-2"
              onPress={() => generateReport('risk')}
              loading={generating === 'risk'}
            >
              Risk summary
            </Button>
            <Button
              variant="outline"
              className="mb-2"
              onPress={() => generateReport('treatment')}
              loading={generating === 'treatment'}
            >
              Treatment summary
            </Button>
            <Button onPress={() => generateReport('overview')} loading={generating === 'overview'}>
              Patient overview
            </Button>
            <TouchableOpacity className="mt-3 py-2" onPress={() => setGenerateModalVisible(false)}>
              <Text className="text-center text-sm text-text-secondary">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={addSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddSheetVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/35"
          onPress={() => setAddSheetVisible(false)}
        >
          <Pressable
            className="rounded-t-3xl bg-white px-5 pb-10 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-4 h-1 w-10 self-center rounded-full bg-border/80" />
            <Text className="mb-5 text-lg font-bold text-text">Add a record</Text>
            {[
              { label: 'Take a photo', icon: 'camera-outline' as const, onPress: takePhoto },
              { label: 'Upload from gallery', icon: 'images-outline' as const, onPress: pickFromGallery },
              { label: 'Upload files', icon: 'document-text-outline' as const, onPress: pickDocument },
            ].map((row) => (
              <TouchableOpacity
                key={row.label}
                className="mb-3 flex-row items-center rounded-2xl border border-border/60 bg-surface-soft px-4 py-3.5"
                onPress={() => {
                  void row.onPress();
                }}
                activeOpacity={0.85}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-coral-soft">
                  <Ionicons name={row.icon} size={22} color={colors.coral.deep} />
                </View>
                <Text className="flex-1 text-base font-semibold text-text">{row.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <MedicalReportHeader title={headerTitle} onBack={handleHeaderBack} />

      {showViewFilters ? (
        <View className="border-b border-border/50 bg-bg-secondary pb-3 pt-2">
          {role === 'doctor' && patients.length > 0 && selectedPatient ? (
            <View className="mx-6 mb-3 overflow-hidden rounded-t-[20px] bg-white shadow-sm">
              <RecordForPatientHeader
                name={selectedPatient.full_name?.trim() || 'Patient'}
                subtitle={
                  typeof selectedPatient.age === 'number' || selectedPatient.gender
                    ? [
                        typeof selectedPatient.age === 'number' ? `${selectedPatient.age} yrs` : '',
                        selectedPatient.gender ?? '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : undefined
                }
                onPressEdit={() => {
                  setPatientSearchQuery('');
                  setPatientPickerVisible(true);
                }}
              />
            </View>
          ) : null}
          <View className="px-6">
            <ReportsRecordFilterBar value={recordTypeFilter} onChange={setRecordTypeFilter} />
          </View>
        </View>
      ) : null}

      <View className="flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 62 + Math.max(insets.bottom, 10) + 28,
        }}
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
        {error ? (
          <View className="mx-6 mt-3 rounded-xl bg-error/10 px-4 py-3">
            <Text className="text-sm text-error">{error}</Text>
          </View>
        ) : null}

        {role === 'doctor' && !selectedPatientId ? (
          <View className="px-6 pt-4">
            {patients.length === 0 ? (
              <Text className="text-center text-sm text-text-secondary">No assigned patients yet.</Text>
            ) : (
              <>
                <View className="overflow-hidden rounded-t-[20px] bg-white shadow-sm">
                  <RecordForPatientHeader
                    name="Select patient"
                    onPressEdit={() => {
                      setPatientSearchQuery('');
                      setPatientPickerVisible(true);
                    }}
                  />
                </View>
                <Text className="mt-3 text-center text-sm text-text-secondary">
                  Tap the pencil to search and choose who this record is for.
                </Text>
              </>
            )}
          </View>
        ) : primaryTab === 'view' ? (
          <View className="mt-2 px-6 pb-8">
            {filteredUploaded.length === 0 && filteredGenerated.length === 0 ? (
              <View className="rounded-2xl border border-border/40 bg-white py-16">
                <Text className="text-center text-sm text-text-secondary">
                  {recordTypeFilter === 'all'
                    ? 'No records yet. Open Upload to add a report.'
                    : 'No records match this filter.'}
                </Text>
              </View>
            ) : (
              <>
                {filteredUploaded.map((report) => (
                  <TouchableOpacity
                    key={report.id}
                    onPress={() => openUploadedFile(report)}
                    activeOpacity={0.85}
                    className="mb-3 rounded-[18px] border border-coral-soft bg-surface-soft p-4"
                  >
                    <View className="flex-row items-start">
                      <View className="min-w-0 flex-1 pr-2">
                        <View className="flex-row items-start justify-between gap-2">
                          <Text
                            className="min-w-0 flex-1 text-base font-semibold text-text"
                            numberOfLines={2}
                          >
                            {report.title}
                          </Text>
                          <ReportRecordStatusPill
                            category={report.category}
                            label={formatRecordTypeLabel(report.category).toUpperCase()}
                          />
                        </View>
                        <Text className="mt-2 text-xs text-text-tertiary">
                          {report.file_name} · {formatDate(report.created_at)}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.coral.deep} />
                    </View>
                  </TouchableOpacity>
                ))}

                {filteredGenerated.length > 0 ? (
                  <>
                    <Text className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                      System summaries
                    </Text>
                    {filteredGenerated.map((report) => (
                      <TouchableOpacity
                        key={report.id}
                        onPress={() => openGeneratedReport(report)}
                        activeOpacity={0.85}
                        className="mb-3 rounded-[18px] border border-coral-soft bg-surface-soft p-4"
                      >
                        <View className="flex-row items-start">
                          <View className="min-w-0 flex-1 pr-2">
                            <View className="flex-row items-start justify-between gap-2">
                              <Text
                                className="min-w-0 flex-1 text-base font-semibold text-text"
                                numberOfLines={2}
                              >
                                {report.title}
                              </Text>
                              <ReportRecordStatusPill
                                category="system_generated"
                                label="SYSTEM GENERATED"
                              />
                            </View>
                            <Text className="mt-2 text-sm text-text-secondary" numberOfLines={2}>
                              {getGeneratedPreview(report)}
                            </Text>
                            <Text className="mt-2 text-xs text-text-tertiary">
                              {formatDate(report.created_at)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color={colors.coral.deep} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </View>
        ) : workspacePhase === 'intro' ? (
          <View className="items-center px-6 pt-10">
            <View className="mb-6 h-40 w-40 items-center justify-center rounded-full bg-coral-soft">
              <Ionicons name="document-text-outline" size={72} color={colors.coral.deep} />
            </View>
            <Text className="mb-2 text-center text-xl font-bold text-text">
              Add A Medical Report.
            </Text>
            <Text className="mb-10 max-w-sm text-center text-sm leading-6 text-text-secondary">
              A detailed health history helps a doctor diagnose you better.
            </Text>
            <View className="w-full max-w-md">
              <Button onPress={() => setAddSheetVisible(true)}>Add a Report</Button>
            </View>

            {role === 'doctor' && selectedPatientId ? (
              <TouchableOpacity className="mt-6 py-2" onPress={() => setGenerateModalVisible(true)}>
                <Text className="text-center text-sm font-semibold text-coral-deep">
                  Generate structured summary
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View className="px-6 pt-6">
            <View className="mb-6 flex-row items-start">
              <View className="h-24 w-24 overflow-hidden rounded-2xl border border-border/60 bg-white">
                {pickedFile ? (
                  pickedFile.mimeType.startsWith('image/') ? (
                    <Image
                      source={{ uri: pickedFile.uri }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-full w-full items-center justify-center bg-coral-soft">
                      <Ionicons name="document-text" size={40} color={colors.coral.deep} />
                    </View>
                  )
                ) : (
                  <View className="h-full w-full items-center justify-center bg-coral-soft/60" />
                )}
              </View>
              <TouchableOpacity
                className="ml-3 h-24 flex-1 items-center justify-center rounded-2xl border border-dashed border-coral-deep/40 bg-coral-soft/50 px-2"
                onPress={() => setAddSheetVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={28} color={colors.coral.deep} />
                <Text className="mt-1 text-center text-xs font-semibold text-coral-ink">
                  Add more images
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mb-5 overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm">
              <RecordForPatientHeader
                name={recordForName}
                onPressEdit={
                  role === 'doctor'
                    ? () => {
                        setPatientSearchQuery('');
                        setPatientPickerVisible(true);
                      }
                    : undefined
                }
              />
            </View>

            <View className="mb-5">
              <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Type of record
              </Text>
              {role === 'doctor' ? (
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className={`flex-1 rounded-2xl border px-2 py-3 ${
                      category === 'doctor_sent'
                        ? 'border-coral-deep bg-coral-soft'
                        : 'border-border/70 bg-white'
                    }`}
                    onPress={() => setCategory('doctor_sent')}
                    activeOpacity={0.88}
                  >
                    <Text className="text-center text-sm font-bold text-text">Doctor upload</Text>
                    <Text className="mt-1 text-center text-[11px] leading-4 text-text-secondary">
                      Default — files you attach for the patient
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-2xl border px-2 py-3 ${
                      category === 'system_generated'
                        ? 'border-coral-deep bg-coral-soft'
                        : 'border-border/70 bg-white'
                    }`}
                    onPress={() => setCategory('system_generated')}
                    activeOpacity={0.88}
                  >
                    <Text className="text-center text-sm font-bold text-text">System-generated</Text>
                    <Text className="mt-1 text-center text-[11px] leading-4 text-text-secondary">
                      Only when this file is a system-produced record
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="flex-row justify-between gap-2">
                  {RECORD_TYPE_OPTIONS.map((opt) => {
                    const selected = category === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        className={`flex-1 items-center rounded-2xl border px-1 py-3 ${
                          selected ? 'border-coral-deep bg-coral-soft' : 'border-border/70 bg-white'
                        }`}
                        onPress={() => setCategory(opt.value)}
                        activeOpacity={0.88}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={22}
                          color={selected ? colors.coral.deep : colors.text.secondary}
                        />
                        <Text
                          className={`mt-1.5 text-center text-[11px] font-semibold leading-4 ${
                            selected ? 'text-coral-ink' : 'text-text-secondary'
                          }`}
                          numberOfLines={2}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View className="mb-8 rounded-2xl border border-border/50 bg-white px-4 py-3">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Record created on
              </Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-text">{formatDate(recordDate)}</Text>
                {Platform.OS === 'android' ? (
                  <TouchableOpacity onPress={() => setAndroidDateOpen(true)}>
                    <Ionicons name="pencil" size={18} color={colors.coral.deep} />
                  </TouchableOpacity>
                ) : (
                  <DateTimePicker
                    value={recordDate}
                    mode="date"
                    display="compact"
                    themeVariant="light"
                    onChange={onRecordDateChange}
                  />
                )}
              </View>
              {Platform.OS === 'android' && androidDateOpen ? (
                <DateTimePicker
                  value={recordDate}
                  mode="date"
                  display="default"
                  onChange={onRecordDateChange}
                />
              ) : null}
            </View>

            <Button onPress={submitUpload} loading={uploading}>
              Upload record
            </Button>
          </View>
        )}
      </ScrollView>

      <ReportsFooterNav primaryTab={primaryTab} onPrimaryChange={setPrimaryTab} />
      </View>
    </SafeAreaView>
  );
}
