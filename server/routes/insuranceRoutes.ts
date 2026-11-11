import { Router } from 'express';
import {
  getAllInsurance,
  getInsuranceByPatientId,
  saveInsurance,
} from '../controllers/insuranceController.ts';

const router = Router();

router.get('/', getAllInsurance);
router.get('/:patientId', getInsuranceByPatientId);
router.post('/', saveInsurance);

export default router;
