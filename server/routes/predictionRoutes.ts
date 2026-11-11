import { Router } from 'express';
import {
  getAllPredictions,
  savePrediction,
  getPredictionStats,
} from '../controllers/predictionController.ts';

const router = Router();

router.get('/', getAllPredictions);
router.post('/', savePrediction);
router.get('/stats', getPredictionStats);

export default router;
