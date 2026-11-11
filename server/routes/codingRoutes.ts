import { Router } from 'express';
import {
  analyzeClinical,
  getAllCodings,
  getCodingByPatientId,
  saveCoding,
} from '../controllers/codingController.ts';

const router = Router();

// AI Coding suggestions
router.post('/', analyzeClinical);

// Clinical coding records
router.get('/records', getAllCodings);
router.get('/records/:patientId', getCodingByPatientId);
router.post('/records', saveCoding);

export default router;
