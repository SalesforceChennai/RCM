import { Router } from 'express';
import { handleAiChat, handleExecuteAction } from '../controllers/aiController.ts';

const router = Router();

router.post('/chat', handleAiChat);
router.post('/execute-action', handleExecuteAction);

export default router;
