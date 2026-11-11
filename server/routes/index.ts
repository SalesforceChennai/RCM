import { Router } from 'express';
import healthRoutes from './healthRoutes.ts';
import authRoutes from './authRoutes.ts';
import patientRoutes from './patientRoutes.ts';
import doctorRoutes from './doctorRoutes.ts';
import departmentRoutes from './departmentRoutes.ts';
import appointmentRoutes from './appointmentRoutes.ts';
import registrationRoutes from './registrationRoutes.ts';
import insuranceRoutes from './insuranceRoutes.ts';
import chargeRoutes from './chargeRoutes.ts';
import codingRoutes from './codingRoutes.ts';
import claimRoutes from './claimRoutes.ts';
import paymentRoutes from './paymentRoutes.ts';
import denialRoutes from './denialRoutes.ts';
import predictionRoutes from './predictionRoutes.ts';
import aiRoutes from './aiRoutes.ts';

const apiRouter = Router();

apiRouter.use('/health', healthRoutes);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', authRoutes);
apiRouter.use('/patients', patientRoutes);
apiRouter.use('/doctors', doctorRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/appointments', appointmentRoutes);
apiRouter.use('/registrations', registrationRoutes);
apiRouter.use('/insurance', insuranceRoutes);
apiRouter.use('/charges', chargeRoutes);
apiRouter.use('/medical-coding', codingRoutes);
apiRouter.use('/claims', claimRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/denials', denialRoutes);
apiRouter.use('/predictions', predictionRoutes);
apiRouter.use('/ai', aiRoutes);

export default apiRouter;
