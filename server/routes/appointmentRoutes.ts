import { Router } from 'express';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointmentStatus,
  updateAppointment,
  deleteAppointment,
} from '../controllers/appointmentController.ts';

const router = Router();

router.get('/', getAllAppointments);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.patch('/:id/status', updateAppointmentStatus);
router.put('/:id/status', updateAppointmentStatus);
router.put('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
