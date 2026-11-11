import { Router } from 'express';
import {
  getAllCharges,
  getChargeById,
  saveCharge,
} from '../controllers/chargeController.ts';

const router = Router();

router.get('/', getAllCharges);
router.get('/:id', getChargeById);
router.post('/', saveCharge);

export default router;
