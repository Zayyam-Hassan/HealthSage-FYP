import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  createTestNotification,
  getNotificationPreferences,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerNotificationDevice,
  unregisterNotificationDevice,
  updateNotificationPreferences,
} from '../controllers/notificationsController';

const router = Router();

router.get('/', requireAuth, listNotifications);
router.get('/unread-count', requireAuth, getUnreadNotificationCount);
router.patch('/read-all', requireAuth, markAllNotificationsRead);
router.patch('/:notificationId/read', requireAuth, markNotificationRead);

router.get('/preferences', requireAuth, getNotificationPreferences);
router.put('/preferences', requireAuth, updateNotificationPreferences);

router.post('/devices', requireAuth, registerNotificationDevice);
router.delete('/devices', requireAuth, unregisterNotificationDevice);

router.post('/test', requireAuth, createTestNotification);

export { router as notificationsRouter };
