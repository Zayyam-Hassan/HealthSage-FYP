import { Router } from 'express';
import { login, me, signup, updateMe } from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

export { router as authRouter };

