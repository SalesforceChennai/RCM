import { Router } from 'express';
import { register, login, getCurrentUser } from '../controllers/authController.ts';
import { authenticateJwt } from '../middleware/authMiddleware.ts';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateJwt, getCurrentUser);

export default router;
