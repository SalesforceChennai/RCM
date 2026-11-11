import { Router } from 'express';
import {
  getAllPayments,
  createPayment,
} from '../controllers/paymentController.ts';

const router = Router();

router.get('/', getAllPayments);
router.post('/', createPayment);

export default router;
