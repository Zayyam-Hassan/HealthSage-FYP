import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  chatWithHistory,
  getConversationTranscript,
  getLatestConversationForPatient,
  getPatientContext,
  listPatientConversations,
} from '../controllers/chatbotController';

const router = Router();

// Matches frontend expectations: /chatbot/chat, /chatbot/patient-context/:patientId
router.post('/chat', requireAuth, chatWithHistory);
router.get('/patient-context/:patientId', requireAuth, getPatientContext);
router.get('/patients/:patientId/conversations', requireAuth, listPatientConversations);
router.get('/patients/:patientId/conversation', requireAuth, getLatestConversationForPatient);
router.get('/conversations/:conversationId/transcript', requireAuth, getConversationTranscript);

export { router as chatbotRouter };

