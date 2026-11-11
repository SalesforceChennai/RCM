import { Router } from 'express';
import {
  getAllDenials,
  createDenial,
  updateDenial,
} from '../controllers/denialController.ts';

const router = Router();

router.get('/', getAllDenials);
router.post('/', createDenial);
router.put('/:id', updateDenial);

export default router;
