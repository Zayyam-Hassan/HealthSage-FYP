import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation';
import { Doctor } from '../models/Doctor';
import { Message } from '../models/Message';
import { Patient } from '../models/Patient';
import { Report } from '../models/Report';
import { RiskPrediction } from '../models/RiskPrediction';
import { getLatestActiveDoctorTreatmentPlanByPatientId } from '../services/doctorTreatmentService';
import {
  callChatbot,
  callRecommendLifestyle,
  callRecommendMedicationForPatient,
  callRiskExplain,
} from '../integrations/fastapi/client';
import { writeReportPdf } from '../utils/reportPdf';
import {
  buildPatientCarePdfSections,
  buildPatientCareReportContent,
} from '../utils/patientCareReport';

function stripMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .trim();
}

function shouldGenerateReport(query: string) {
  const normalized = query.toLowerCase();
  return [
    /\b(generate|create|make|prepare|draft)\b.{0,24}\b(report|pdf|summary)\b/,
    /\b(send|share)\b.{0,24}\b(report|pdf|summary)\b/,
    /\b(patient|care|follow[- ]?up)\s+(report|summary)\b/,
    /\b(report|summary)\s+for\s+patient\b/,
  ].some((pattern) => pattern.test(normalized));
}

function toSentenceList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => toSentenceList(item))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const cleaned = stripMarkdown(value);
    return cleaned ? [cleaned] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (item === null || item === undefined || item === '') return [];
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return [`${key.replace(/_/g, ' ')}: ${stripMarkdown(String(item))}`];
      }
      if (Array.isArray(item)) {
        const nested = toSentenceList(item);
        return nested.length > 0
          ? [`${key.replace(/_/g, ' ')}: ${nested.join('; ')}`]
          : [];
      }
      const nested = toSentenceList(item);
      return nested.length > 0
        ? [`${key.replace(/_/g, ' ')}: ${nested.join('; ')}`]
        : [];
    });
  }
  return [];
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

function formatImportance(importance: unknown) {
  if (typeof importance === 'number') {
    return `${importance > 0 ? '+' : ''}${importance.toFixed(2)}`;
  }
  return null;
}

function buildClinicalSnapshot(patient: any) {
  const snapshot: string[] = [];

  if (patient?.age) snapshot.push(`Age: ${patient.age}`);
  if (patient?.sex) snapshot.push(`Sex: ${patient.sex}`);
  if (patient?.height_cm) snapshot.push(`Height: ${patient.height_cm} cm`);
  if (patient?.weight_kg) snapshot.push(`Weight: ${patient.weight_kg} kg`);
  if (patient?.lab_tests?.hba1c !== undefined) snapshot.push(`HbA1c: ${patient.lab_tests.hba1c}%`);
  if (patient?.lab_tests?.fasting_glucose !== undefined) {
    snapshot.push(`Fasting glucose: ${patient.lab_tests.fasting_glucose} mg/dL`);
  }
  if (patient?.lab_tests?.glucose !== undefined) {
    snapshot.push(`Random glucose: ${patient.lab_tests.glucose} mg/dL`);
  }
  if (patient?.lab_tests?.cholesterol !== undefined) {
    snapshot.push(`Cholesterol: ${patient.lab_tests.cholesterol} mg/dL`);
  }
  if (patient?.vital_signs?.bmi !== undefined) snapshot.push(`BMI: ${patient.vital_signs.bmi}`);
  if (patient?.vital_signs?.systolic_bp !== undefined && patient?.vital_signs?.diastolic_bp !== undefined) {
    snapshot.push(
      `Blood pressure: ${patient.vital_signs.systolic_bp}/${patient.vital_signs.diastolic_bp} mmHg`,
    );
  }
  if (Array.isArray(patient?.conditions) && patient.conditions.length > 0) {
    snapshot.push(`Conditions: ${patient.conditions.join(', ')}`);
  }
  if (patient?.lifestyle?.smoking) snapshot.push(`Smoking: ${patient.lifestyle.smoking}`);
  if (patient?.lifestyle?.drinking) snapshot.push(`Drinking: ${patient.lifestyle.drinking}`);
  if (patient?.lifestyle?.exercise) snapshot.push(`Exercise: ${patient.lifestyle.exercise}`);

  return snapshot;
}

function buildRiskDrivers(explanation: Record<string, any> | null | undefined) {
  const features = Array.isArray(explanation?.top_features)
    ? explanation?.top_features
    : Array.isArray((explanation as any)?.top_contributors)
      ? (explanation as any)?.top_contributors
      : [];

  return uniqueLines(
    features.slice(0, 5).map((feature: any) => {
      const name = String(feature?.name ?? feature?.feature ?? 'Clinical factor').replace(/_/g, ' ');
      const importance = formatImportance(feature?.importance);
      return importance ? `${name} (impact ${importance})` : name;
    }),
  );
}

function buildLifestyleRecommendations(
  agentOutputs: Record<string, unknown> | undefined,
  patientContext: Record<string, any> | null,
) {
  const fromAgent = uniqueLines(
    toSentenceList((agentOutputs?.lifestyle as any)?.data?.plan ?? agentOutputs?.lifestyle),
  );
  const fromContext = uniqueLines(
    toSentenceList(patientContext?.latest_lifestyle?.plan ?? patientContext?.latest_lifestyle),
  );

  const recommendations = uniqueLines([...fromAgent, ...fromContext]);
  if (recommendations.length > 0) return recommendations.slice(0, 8);

  return [
    'Follow a balanced diet with portion control and lower refined sugar intake.',
    'Aim for consistent physical activity on most days of the week.',
    'Keep regular sleep timing and reduce sedentary time during the day.',
  ];
}

function buildMedicationRecommendations(
  agentOutputs: Record<string, unknown> | undefined,
  patientContext: Record<string, any> | null,
) {
  const fromAgent = uniqueLines(
    toSentenceList((agentOutputs?.medication as any)?.data ?? agentOutputs?.medication),
  );
  const fromContext = uniqueLines(
    toSentenceList(
      patientContext?.latest_medication?.validated_output ??
        patientContext?.latest_medication,
    ),
  );

  const recommendations = uniqueLines([...fromAgent, ...fromContext]);
  if (recommendations.length > 0) return recommendations.slice(0, 8);

  return ['No medication recommendation could be confidently summarized from the current data.'];
}

function buildMonitoringPlan(patient: any, latestRisk: any) {
  const plan: string[] = [];
  if (patient?.lab_tests?.hba1c !== undefined) {
    plan.push('Repeat HbA1c follow-up according to the clinician plan and response to treatment.');
  }
  if (patient?.lab_tests?.fasting_glucose !== undefined || patient?.lab_tests?.glucose !== undefined) {
    plan.push('Continue glucose monitoring and compare trends against the current baseline.');
  }
  if (patient?.vital_signs?.systolic_bp !== undefined || patient?.vital_signs?.diastolic_bp !== undefined) {
    plan.push('Track blood pressure during follow-up visits and home monitoring when available.');
  }
  if (latestRisk?.predicted_label === 1) {
    plan.push('Prioritize earlier follow-up because the latest prediction suggests elevated diabetes risk.');
  }
  return uniqueLines(plan);
}

function buildPatientContextFallbackSummary(
  patient: any,
  clinicalSnapshot: string[],
  reportContent: Record<string, unknown>,
) {
  const reportOverview =
    typeof reportContent.overview === 'string' && reportContent.overview.trim()
      ? reportContent.overview.trim()
      : typeof reportContent.latest_risk_summary === 'string' && reportContent.latest_risk_summary.trim()
        ? reportContent.latest_risk_summary.trim()
        : null;

  if (reportOverview) {
    return reportOverview;
  }

  const highlights: string[] = [];
  if (patient?.age) highlights.push(`age ${patient.age}`);
  if (patient?.lab_tests?.hba1c !== undefined) highlights.push(`HbA1c ${patient.lab_tests.hba1c}%`);
  if (patient?.lab_tests?.glucose !== undefined) highlights.push(`glucose ${patient.lab_tests.glucose} mg/dL`);
  if (patient?.lab_tests?.fasting_glucose !== undefined) {
    highlights.push(`fasting glucose ${patient.lab_tests.fasting_glucose} mg/dL`);
  }
  if (patient?.vital_signs?.bmi !== undefined) highlights.push(`BMI ${patient.vital_signs.bmi}`);
  if (
    patient?.vital_signs?.systolic_bp !== undefined &&
    patient?.vital_signs?.diastolic_bp !== undefined
  ) {
    highlights.push(
      `blood pressure ${patient.vital_signs.systolic_bp}/${patient.vital_signs.diastolic_bp} mmHg`,
    );
  }

  if (highlights.length > 0) {
    return `Latest clinical data loaded: ${highlights.slice(0, 5).join(', ')}.`;
  }

  if (clinicalSnapshot.length > 0) {
    return `Latest patient context loaded: ${clinicalSnapshot.slice(0, 4).join(', ')}.`;
  }

  return 'Latest patient context loaded and ready for clinical questions.';
}

function buildNextSteps(lifestyle: string[], medication: string[], monitoring: string[]) {
  const steps = [
    lifestyle[0],
    medication[0],
    monitoring[0],
  ].filter(Boolean) as string[];

  return uniqueLines(steps).slice(0, 4);
}

function mapTranscriptMessage(message: any) {
  return {
    id: message._id?.toString?.() ?? message.id,
    role: message.sender_type === 'provider' ? 'user' : 'assistant',
    content: message.body,
    created_at: message.created_at?.toISOString?.() ?? null,
  };
}

async function buildConversationSummary(conversation: any, patientId: string) {
  const conversationId =
    typeof conversation?._id?.toString === 'function'
      ? conversation._id.toString()
      : String(conversation?._id ?? '');
  const messages = await Message.find({ conversation_id: conversation._id })
    .sort({ created_at: 1 })
    .select({ body: 1, created_at: 1 })
    .lean();

  const lastMessage = messages[messages.length - 1];
  const preview = typeof lastMessage?.body === 'string'
    ? stripMarkdown(lastMessage.body).trim().slice(0, 180)
    : '';

  return {
    conversation_id: conversationId,
    patient_id: patientId,
    subject: (conversation.subject ?? 'Clinical chat').trim() || 'Clinical chat',
    preview,
    message_count: messages.length,
    created_at: conversation.created_at?.toISOString?.() ?? null,
    updated_at: conversation.updated_at?.toISOString?.() ?? null,
  };
}

async function touchConversation(conversationId: mongoose.Types.ObjectId) {
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { updated_at: new Date() } },
  );
}

function toConversationId(conversation: any): string {
  if (typeof conversation?._id?.toString === 'function') {
    return conversation._id.toString();
  }
  return String(conversation?._id ?? '');
}

async function findLatestConversation(patientId: mongoose.Types.ObjectId) {
  return Conversation.findOne({ patient_id: patientId }).sort({ updated_at: -1, created_at: -1 });
}

async function getLatestRecommendationArtifacts(patientObjectId: mongoose.Types.ObjectId) {
  const db = mongoose.connection.db;
  if (!db) {
    return {
      latestLifestyle: null,
      latestMedication: null,
    };
  }

  const [latestLifestyle, latestMedication] = await Promise.all([
    db
      .collection('lifestyle_recommendations')
      .find({ patient_id: patientObjectId })
      .sort({ created_at: -1, _id: -1 })
      .limit(1)
      .toArray(),
    db
      .collection('medication_recommendations')
      .find({ patient_id: patientObjectId })
      .sort({ created_at: -1, _id: -1 })
      .limit(1)
      .toArray(),
  ]);

  return {
    latestLifestyle: latestLifestyle[0] ?? null,
    latestMedication: latestMedication[0] ?? null,
  };
}

async function buildExpressPatientContext(patientId: string) {
  if (!mongoose.isValidObjectId(patientId)) {
    return null;
  }

  const patientObjectId = new mongoose.Types.ObjectId(patientId);
  const [patient, latestRisk, latestReport, recommendationArtifacts, latestDoctorTreatmentPlan] = await Promise.all([
    Patient.findById(patientObjectId).lean(),
    RiskPrediction.findOne({ patient_id: patientObjectId }).sort({ created_at: -1 }).lean(),
    Report.findOne({ patient_id: patientObjectId, type: 'ai_summary' })
      .sort({ created_at: -1 })
      .lean(),
    getLatestRecommendationArtifacts(patientObjectId),
    getLatestActiveDoctorTreatmentPlanByPatientId(patientId).catch(() => null),
  ]);

  if (!patient) {
    return null;
  }

  const reportContent = (latestReport?.content ?? {}) as Record<string, unknown>;
  const clinicalSnapshot = buildClinicalSnapshot(patient);
  const riskSummary = latestRisk
    ? `${latestRisk.predicted_label === 1 ? 'Higher diabetes risk' : 'Lower diabetes risk'}${
        latestRisk.probability ? ` (${Math.round(latestRisk.probability * 100)}%)` : ''
      }`
    : buildPatientContextFallbackSummary(patient, clinicalSnapshot, reportContent);

  const lifestyleSuggestions = uniqueLines([
    ...toSentenceList(reportContent.lifestyle_suggestions),
    ...toSentenceList(recommendationArtifacts.latestLifestyle?.plan),
    ...(patient?.lifestyle?.exercise ? [`Exercise: ${patient.lifestyle.exercise}`] : []),
    ...(patient?.lifestyle?.smoking ? [`Smoking: ${patient.lifestyle.smoking}`] : []),
    ...(patient?.lifestyle?.drinking ? [`Drinking: ${patient.lifestyle.drinking}`] : []),
  ]).slice(0, 8);

  const medicationSuggestions = uniqueLines(
    [
      ...toSentenceList(reportContent.medication_suggestions),
      ...toSentenceList(recommendationArtifacts.latestMedication?.consensus_output?.recommended_medications),
      ...toSentenceList(recommendationArtifacts.latestMedication?.llm_raw_output?.primary_option),
    ],
  ).slice(0, 8);

  return {
    patient_id: patientId,
    patient_name: patient.full_name,
    risk_summary: riskSummary,
    latest_risk_summary: riskSummary,
    clinical_snapshot: clinicalSnapshot,
    conditions: patient.conditions ?? [],
    lifestyle_suggestions: lifestyleSuggestions,
    medication_suggestions: medicationSuggestions,
    latest_lifestyle: recommendationArtifacts.latestLifestyle,
    latest_medication: recommendationArtifacts.latestMedication,
    latest_doctor_treatment_plan: latestDoctorTreatmentPlan,
    latest_report_summary:
      (reportContent.overview as string | undefined) ??
      (reportContent.latest_risk_summary as string | undefined) ??
      null,
    has_saved_report: Boolean(latestReport),
  };
}

async function getAccessiblePatient(req: Request, patientId: string) {
  if (!mongoose.isValidObjectId(patientId) || !req.user) {
    return null;
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    return null;
  }

  if (req.user.role === 'admin') {
    return patient;
  }

  if (req.user.role === 'doctor') {
    const doctor = await Doctor.findOne({
      user_id: new mongoose.Types.ObjectId(req.user.sub),
    });
    if (!doctor) {
      return null;
    }
    return patient.primary_doctor_id?.toString() === doctor._id.toString()
      ? patient
      : null;
  }

  return null;
}

async function createPatientCareSummary(
  patientId: string,
  conversationId: string,
  agentOutputs?: Record<string, unknown>,
  createdByUserId?: string,
) {
  if (!mongoose.isValidObjectId(patientId)) {
    return;
  }

  const patientObjectId = new mongoose.Types.ObjectId(patientId);
  const [patient, latestRisk, patientContext, recommendationArtifacts] = await Promise.all([
    Patient.findById(patientObjectId),
    RiskPrediction.findOne({ patient_id: patientObjectId }).sort({ created_at: -1 }),
    buildExpressPatientContext(patientId).catch(() => null),
    getLatestRecommendationArtifacts(patientObjectId),
  ]);

  const enrichedAgentOutputs: Record<string, unknown> = {
    ...(agentOutputs ?? {}),
  };

  if (!(enrichedAgentOutputs.risk || enrichedAgentOutputs.get_risk || enrichedAgentOutputs.get_risk_explain) && !latestRisk) {
    try {
      enrichedAgentOutputs.risk = await callRiskExplain(patientId);
    } catch (err) {
      // keep report generation resilient; patient data can still drive the report
    }
  }

  if (!(enrichedAgentOutputs.lifestyle || enrichedAgentOutputs.get_lifestyle) && !recommendationArtifacts.latestLifestyle) {
    try {
      const lifestyle = await callRecommendLifestyle({ patient_id: patientId });
      enrichedAgentOutputs.lifestyle = {
        agent: 'lifestyle',
        data: lifestyle,
      };
    } catch (err) {
      // tolerate missing recommendation output and continue with profile-derived guidance
    }
  }

  if (!(enrichedAgentOutputs.medication || enrichedAgentOutputs.get_medication) && !recommendationArtifacts.latestMedication) {
    try {
      const medication = await callRecommendMedicationForPatient(patientId);
      enrichedAgentOutputs.medication = {
        agent: 'medication',
        data: medication,
      };
    } catch (err) {
      // tolerate missing recommendation output and continue with available context
    }
  }

  const patientName = patient?.full_name ?? 'Patient';
  const content = buildPatientCareReportContent({
    patient,
    latestRisk,
    latestLifestyle: recommendationArtifacts.latestLifestyle ?? (patientContext as any)?.latest_lifestyle,
    latestMedication: recommendationArtifacts.latestMedication ?? (patientContext as any)?.latest_medication,
    agentOutputs: enrichedAgentOutputs,
    conversationId,
  });

  const report = await Report.create({
    patient_id: patientObjectId,
    created_by_user_id: createdByUserId
      ? new mongoose.Types.ObjectId(createdByUserId)
      : null,
    title: `Care Guidance Summary for ${patientName}`,
    type: 'ai_summary',
    generated_by: 'HealthSage Assistant',
    content,
  });

  const attachmentPath = await writeReportPdf(
    report.id,
    report.title,
    buildPatientCarePdfSections(content),
  );

  report.attachment_path = attachmentPath;
  report.attachment_url = `/mongo/reports/${report.id}/file`;
  await report.save();
}

export async function getPatientContext(req: Request, res: Response): Promise<void> {
  const { patientId } = req.params;
  if (!patientId) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'patientId is required' });
    return;
  }
  try {
    if (req.user?.role !== 'doctor') {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only doctors can use the assistant',
      });
      return;
    }
    const patient = await getAccessiblePatient(req, patientId);
    if (!patient) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }
    const data = await buildExpressPatientContext(patient.id);
    res.json(data);
  } catch (err: any) {
    res.status(StatusCodes.BAD_GATEWAY).json({
      message: 'Failed to load patient context',
      detail: err?.message,
    });
  }
}

export async function chatWithHistory(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    patient_id: string;
    doctor_query: string;
    mode?: string;
    conversation_id?: string | null;
    subject?: string;
    start_new?: boolean;
  };

  if (!body.patient_id || !body.doctor_query) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'patient_id and doctor_query are required' });
    return;
  }

  const patientId = body.patient_id;
  const mode = body.mode ?? 'master';
  const subject = body.subject ?? 'Clinical chat';
  const reportRequested = shouldGenerateReport(body.doctor_query);

  try {
    if (req.user?.role !== 'doctor') {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only doctors can use the assistant',
      });
      return;
    }
    const patient = await getAccessiblePatient(req, patientId);
    if (!patient) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }

    let conversationId = body.start_new ? null : body.conversation_id ?? null;
    let convDoc: any | null = null;
    if (conversationId) {
      if (!mongoose.isValidObjectId(conversationId)) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Conversation not found' });
        return;
      }
      convDoc = await Conversation.findById(conversationId);
      if (!convDoc) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Conversation not found' });
        return;
      }
      if (convDoc.patient_id?.toString() !== patient.id) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
        return;
      }
    } else {
      convDoc = await Conversation.create({
        patient_id: patient._id,
        subject,
      });
      conversationId = toConversationId(convDoc);
    }
    const resolvedConversationId = conversationId as string;

    const convObjectId = convDoc._id as mongoose.Types.ObjectId;

    const existingMessages = await Message.find({ conversation_id: convObjectId })
      .sort({ created_at: 1 })
      .lean();

    const message_history = existingMessages.map((m) => ({
      role: m.sender_type === 'provider' ? 'user' : 'assistant',
      content: m.body,
    }));

    const userMsg = await Message.create({
      conversation_id: convObjectId,
      sender_type: 'provider',
      body: body.doctor_query,
    });
    await touchConversation(convObjectId);

    const fastApiPayload: Record<string, any> = {
      patient_id: patientId,
      doctor_query: body.doctor_query,
      mode,
      message_history,
    };

    let finalMessage =
      'The HealthSage assistant is taking longer than expected. Please try again shortly.';
    let agentOutputs: Record<string, unknown> | undefined;
    let responseMode = mode;
    let failed = false;

    try {
      const fastApiResponse = await callChatbot(
        '/chatbot/clinical-assistant',
        fastApiPayload,
      );
      finalMessage = fastApiResponse.final_message ?? finalMessage;
      agentOutputs = fastApiResponse.agent_outputs;
      responseMode = fastApiResponse.mode ?? mode;

      if (reportRequested) {
        await createPatientCareSummary(
          patient.id,
          resolvedConversationId,
          agentOutputs,
          req.user?.sub,
        );
        finalMessage = `${finalMessage}\n\nA patient-ready report draft has been created in Reports for your review.`;
      }
    } catch (err: any) {
      failed = true;
      finalMessage =
        'The assistant is temporarily unavailable for this patient. Your message was saved, and you can retry in a moment.';
    }

    const assistantMsg = await Message.create({
      conversation_id: convObjectId,
      sender_type: 'assistant',
      body: finalMessage,
    });
    await touchConversation(convObjectId);

    const transcript = [
      ...existingMessages.map(mapTranscriptMessage),
      {
        id: userMsg.id,
        role: 'user',
        content: userMsg.body,
        created_at: userMsg.created_at.toISOString(),
      },
      {
        id: assistantMsg.id,
        role: 'assistant',
        content: assistantMsg.body,
        created_at: assistantMsg.created_at.toISOString(),
      },
    ];

    res.json({
      response: {
        final_message: finalMessage,
        agent_outputs: agentOutputs,
        mode: responseMode,
        patient_id: patient.id,
        failed,
        report_created: reportRequested && !failed,
      },
      conversation_id: resolvedConversationId,
      message_id_user: userMsg.id,
      message_id_assistant: assistantMsg.id,
      transcript,
    });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to process chatbot request',
      detail: err?.message,
    });
  }
}

export async function getLatestConversationForPatient(
  req: Request,
  res: Response,
): Promise<void> {
  const { patientId } = req.params;
  if (!patientId) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'patientId is required' });
    return;
  }

  try {
    if (req.user?.role !== 'doctor') {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only doctors can use the assistant',
      });
      return;
    }

    const patient = await getAccessiblePatient(req, patientId);
    if (!patient) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }

    const conversation = await findLatestConversation(patient._id as mongoose.Types.ObjectId);
    if (!conversation) {
      res.json({
        conversation_id: null,
        patient_id: patient.id,
        transcript: [],
      });
      return;
    }

    const messages = await Message.find({ conversation_id: conversation._id })
      .sort({ created_at: 1 })
      .lean();

    res.json({
      conversation_id: toConversationId(conversation),
      patient_id: patient.id,
      transcript: messages.map(mapTranscriptMessage),
    });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to load latest conversation',
      detail: err?.message,
    });
  }
}

export async function listPatientConversations(
  req: Request,
  res: Response,
): Promise<void> {
  const { patientId } = req.params;
  if (!patientId) {
    res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({ message: 'patientId is required' });
    return;
  }

  try {
    if (req.user?.role !== 'doctor') {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only doctors can use the assistant',
      });
      return;
    }

    const patient = await getAccessiblePatient(req, patientId);
    if (!patient) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }

    const conversations = await Conversation.find({ patient_id: patient._id })
      .sort({ updated_at: -1, created_at: -1 })
      .lean();

    const summaries = await Promise.all(
      conversations.map((conversation) => buildConversationSummary(conversation, patient.id)),
    );

    res.json({
      patient_id: patient.id,
      conversations: summaries,
    });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to load conversations',
      detail: err?.message,
    });
  }
}

export async function getConversationTranscript(
  req: Request,
  res: Response,
): Promise<void> {
  const { conversationId } = req.params;
  const requestedPatientId =
    typeof req.query.patient_id === 'string' ? req.query.patient_id : undefined;
  if (!conversationId || !mongoose.isValidObjectId(conversationId)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: 'Conversation not found' });
    return;
  }

  try {
    if (req.user?.role !== 'doctor') {
      res.status(StatusCodes.FORBIDDEN).json({
        message: 'Only doctors can use the assistant',
      });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'Conversation not found' });
      return;
    }

    const patientLookupId = requestedPatientId || conversation.patient_id?.toString() || '';
    const patient = await getAccessiblePatient(req, patientLookupId);
    if (!patient) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }

    if (conversation.patient_id?.toString() && conversation.patient_id.toString() !== patient.id) {
      res.status(StatusCodes.FORBIDDEN).json({ message: 'Forbidden' });
      return;
    }

    const messages = await Message.find({
      conversation_id: conversation._id,
    })
      .sort({ created_at: 1 })
      .lean();

    res.json({
      conversation_id: toConversationId(conversation),
      patient_id: patient.id,
      transcript: messages.map((message) => ({
        id: message._id.toString(),
        role: message.sender_type === 'provider' ? 'user' : 'assistant',
        content: message.body,
        created_at: message.created_at?.toISOString(),
      })),
    });
  } catch (err: any) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: 'Failed to load transcript',
      detail: err?.message,
    });
  }
}

