import { Router } from 'express';
import {
  getAllRegistrations,
  getRegistrationByPatientId,
  saveRegistration,
} from '../controllers/registrationController.ts';

const router = Router();

router.get('/', getAllRegistrations);
router.get('/:patientId', getRegistrationByPatientId);
router.post('/', saveRegistration);

export default router;
