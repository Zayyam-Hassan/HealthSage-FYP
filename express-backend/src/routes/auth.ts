import { Router } from 'express';
import {
  changePassword,
  getAvatar,
  login,
  me,
  signup,
  uploadMeAvatar,
  updateMe,
} from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/avatars/:filename', getAvatar);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);
router.post('/me/avatar', requireAuth, uploadMeAvatar);
router.post('/change-password', requireAuth, changePassword);

export { router as authRouter };

