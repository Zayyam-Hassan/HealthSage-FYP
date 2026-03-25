import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AppDialog from '@/components/AppDialog';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Header from '@/components/Header';
import Loader from '@/components/Loader';
import { authService, type UserRole } from '@/services/auth';
import { reportsService, type Report } from '@/services/reports';

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' }[];
  }>({ visible: false, title: '', message: '' });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const currentUser = await authService.getCurrentUser();
        setRole(currentUser?.role ?? null);
        const reportData = await reportsService.getReport(id as string);
        setReport(reportData);
      } catch (err: any) {
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  if (!report || error) {
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

  const content = report.content as Record<string, any>;
  const explainabilityFields = Array.isArray(content?.explainability?.top_contributors)
    ? content.explainability.top_contributors
    : Array.isArray(content?.explainability?.top_features)
      ? content.explainability.top_features
      : [];

  const renderListBlock = (title: string, value: unknown) => {
    const items = Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : typeof value === 'string'
        ? value
            .split(/\n|[|]/)
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    if (items.length === 0) return null;

    return (
      <Card className="mb-4">
        <Text className="text-base font-semibold text-text mb-3">{title}</Text>
        {items.map((item, index) => (
          <View key={`${title}-${index}`} className="mb-3 flex-row">
            <Text className="mr-3 text-primary font-bold">•</Text>
            <Text className="flex-1 text-sm text-text-secondary leading-6">{item}</Text>
          </View>
        ))}
      </Card>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={() => setDialog((current) => ({ ...current, visible: false }))}
      />
      <Header title="Report Details" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-4">
          <Card className="mb-4">
            <Text className="text-xl font-bold text-text mb-2">{report.title}</Text>
            <Badge variant="info">{report.type}</Badge>
            <Text className="text-sm text-text-secondary mt-3">
              {new Date(report.generated_at).toLocaleString()}
            </Text>
            <Text className="text-sm text-text-secondary mt-1">
              {report.is_sent_to_patient
                ? `Sent to patient ${report.send_count ? `${report.send_count} time${report.send_count > 1 ? 's' : ''}` : 'once'}`
                : 'Draft only: visible to doctor until sent'}
            </Text>
          </Card>

          {role === 'doctor' ? (
            <Card className="mb-4 bg-primary/5 border border-primary/20">
              <Text className="text-base font-semibold text-text mb-2">
                Delivery controls
              </Text>
              <Text className="text-sm text-text-secondary leading-6 mb-4">
                This report is stored in your records first. Send it to the patient only when
                you are satisfied with the wording and recommendations.
              </Text>
              <Button
                fullWidth
                onPress={() =>
                  setDialog({
                    visible: true,
                    title: report.is_sent_to_patient ? 'Resend report' : 'Send report',
                    message: report.is_sent_to_patient
                      ? 'Do you want to resend this PDF report to the patient?'
                      : 'Do you want to send this PDF report to the patient now?',
                    actions: [
                      { label: 'No', onPress: () => {}, variant: 'secondary' },
                      {
                        label: report.is_sent_to_patient ? 'Resend' : 'Send',
                        onPress: async () => {
                          try {
                            const updated = await reportsService.sendReport(report.id);
                            setReport(updated);
                            setDialog({
                              visible: true,
                              title: 'Report sent',
                              message: 'The patient can now view this report in their records.',
                            });
                          } catch (err: any) {
                            setDialog({
                              visible: true,
                              title: 'Unable to send',
                              message: err.message || 'Please try again in a few minutes.',
                            });
                          }
                        },
                      },
                    ],
                  })
                }
              >
                {report.is_sent_to_patient ? 'Resend to patient' : 'Send to patient'}
              </Button>
            </Card>
          ) : null}

          {content.patient_friendly_title ? (
            <Card className="mb-4 bg-primary/5 border border-primary/20">
              <Text className="text-lg font-semibold text-text mb-2">
                {content.patient_friendly_title}
              </Text>
              <Text className="text-sm text-text-secondary leading-6">
                {content.overview}
              </Text>
            </Card>
          ) : null}

          {content.latest_risk_summary ? (
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text mb-2">
                Risk summary
              </Text>
              <Text className="text-sm text-text-secondary">
                {content.latest_risk_summary}
              </Text>
            </Card>
          ) : null}

          {content.risk_narrative ? (
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text mb-2">
                Risk narrative
              </Text>
              <Text className="text-sm text-text-secondary leading-6">
                {content.risk_narrative}
              </Text>
            </Card>
          ) : null}

          {renderListBlock('Clinical snapshot', content.clinical_snapshot)}

          {renderListBlock('Protective factors', content.protective_factors)}

          {renderListBlock('Active concerns', content.active_concerns)}

          {renderListBlock('Key risk drivers', content.risk_drivers)}

          {renderListBlock('Lifestyle recommendations', content.lifestyle_suggestions)}

          {renderListBlock('Medication considerations', content.medication_suggestions)}

          {renderListBlock('Monitoring plan', content.monitoring_plan)}

          {renderListBlock('Doctor considerations', content.doctor_considerations)}

          {renderListBlock('Evidence summary', content.evidence_summary)}

          {renderListBlock('Next steps', content.next_steps)}

          {explainabilityFields.length > 0 ? (
            <Card className="mb-4">
              <Text className="text-base font-semibold text-text mb-3">
                Key fields considered
              </Text>
              {explainabilityFields.slice(0, 6).map((field: any, index: number) => (
                <View
                  key={`${field?.feature ?? field?.name ?? index}`}
                  className="mb-3"
                >
                  <Text className="text-sm font-semibold text-text">
                    {String(field?.feature ?? field?.name ?? `Field ${index + 1}`).replace(/_/g, ' ')}
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    {field?.direction
                      ? `Impact: ${field.direction}`
                      : 'Included in the prediction summary.'}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {!content.patient_friendly_title && (
            <Card>
              <Text className="text-base font-semibold text-text mb-3">
                Report content
              </Text>
              <Text className="text-sm text-text-secondary leading-6">
                {typeof report.content === 'object'
                  ? JSON.stringify(report.content, null, 2)
                  : String(report.content)}
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
