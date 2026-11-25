import { Router } from 'express';
import {
  getAllPriorAuthorizations,
  getPriorAuthorizationById,
  createPriorAuthorization,
  updatePriorAuthorization,
  deletePriorAuthorization,
} from '../controllers/priorAuthController.ts';

const router = Router();

router.get('/', getAllPriorAuthorizations);
router.get('/:id', getPriorAuthorizationById);
router.post('/', createPriorAuthorization);
router.put('/:id', updatePriorAuthorization);
router.patch('/:id/status', updatePriorAuthorization);
router.delete('/:id', deletePriorAuthorization);

export default router;
