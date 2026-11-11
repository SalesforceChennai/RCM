import { Router } from 'express';
import {
  getAllClaims,
  getClaimById,
  createClaim,
} from '../controllers/claimController.ts';

const router = Router();

router.get('/', getAllClaims);
router.get('/:id', getClaimById);
router.post('/', createClaim);

export default router;
