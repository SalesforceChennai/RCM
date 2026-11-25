import type {
  Patient,
  Doctor,
  Department,
  Appointment,
  PatientRegistration,
  InsuranceInfo,
  ChargeCaptureEncounter,
  Gender
} from '../types';
import { getTodayDateStr } from './statsService';

export interface AggregatedPatient {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dob: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  address: string;
  avatar?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  registration: PatientRegistration | null;
  registrationDate: string;
  assignedDoctor: {
    id: string;
    name: string;
    avatar?: string;
    specialization?: string;
    department?: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  lastAppointment: Appointment | null;
  lastAppointmentDate: string;
  nextAppointment: Appointment | null;
  nextAppointmentDate: string;
  appointmentStatus: string;
  allAppointments: Appointment[];
  insurance: InsuranceInfo | null;
  insuranceProvider: string;
  insuranceStatus: 'Active' | 'Pending' | 'Expired' | 'Declined' | 'Uninsured';
  memberId: string;
  policyNumber: string;
  financials: {
    totalCharges: number;
    insurancePaid: number;
    patientPaid: number;
    adjustments: number;
    pendingBalance: number;
    aging: {
      current: number;
      days31_60: number;
      days61_90: number;
      days91_120: number;
      over120: number;
      total: number;
    };
  };
}

export interface FinancialSummaryTotals {
  totalCharges: number;
  insurancePaid: number;
  patientPaid: number;
  adjustments: number;
  outstanding: number;
  aging: {
    current: number;
    days31_60: number;
    days61_90: number;
    days91_120: number;
    over120: number;
    total: number;
  };
}

export interface PatientFilterParams {
  searchQuery?: string;
  doctorId?: string;
  departmentId?: string;
  gender?: string;
  ageGroup?: string;
  appointmentStatus?: string;
  insuranceStatus?: string;
  dateFilterType?: 'registration' | 'lastAppointment' | 'nextAppointment';
  dateFrom?: string;
  dateTo?: string;
}

export interface PatientsSummaryStats {
  totalPatients: number;
  activePatients: number;
  patientsWithUpcomingAppointments: number;
  pendingInsurance: number;
  patientsWithOutstandingBalance: number;
}

export function calculateAge(dobString: string, refDateString?: string): number {
  if (!dobString) return 0;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return 0;
  const today = refDateString ? new Date(refDateString) : new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export const patientAggregatorService = {
  /**
   * Fetches and merges all patient information exclusively from Neon PostgreSQL /api/* endpoints.
   */
  async getAggregatedPatients(): Promise<AggregatedPatient[]> {
    const [patRes, aptRes, docRes, deptRes, regRes, insRes, chgRes] = await Promise.all([
      fetch('/api/patients').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/appointments').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/doctors').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/departments').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/registrations').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/insurance').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
      fetch('/api/charges').then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
    ]);

    const patients: Patient[] = Array.isArray(patRes?.data) ? patRes.data : [];
    const appointments: Appointment[] = Array.isArray(aptRes?.data) ? aptRes.data : [];
    const doctors: Doctor[] = Array.isArray(docRes?.data) ? docRes.data : [];
    const departments: Department[] = Array.isArray(deptRes?.data) ? deptRes.data : [];
    const registrations: PatientRegistration[] = Array.isArray(regRes?.data) ? regRes.data : [];
    const insurances: InsuranceInfo[] = Array.isArray(insRes?.data) ? insRes.data : [];
    const charges: ChargeCaptureEncounter[] = Array.isArray(chgRes?.data) ? chgRes.data : [];

    const currentDate = getTodayDateStr();

    return patients.map((patient) => {
      const patientIdClean = patient.id.toLowerCase();
      const patientCodeClean = (patient.patientId || '').toLowerCase();
      const fullName = `${patient.firstName} ${patient.lastName}`.trim();
      const fullNameClean = fullName.toLowerCase();

      const patientAppointments = appointments.filter((a) => {
        if (a.patientId && a.patientId.toLowerCase() === patientIdClean) return true;
        if (a.patient?.id && a.patient.id.toLowerCase() === patientIdClean) return true;
        if (patientCodeClean && a.patient?.patientCode && a.patient.patientCode.toLowerCase() === patientCodeClean) return true;
        if (fullNameClean && a.patient?.name && a.patient.name.toLowerCase() === fullNameClean) return true;
        return false;
      });

      const sortedAppointments = [...patientAppointments].sort((a, b) => {
        const cmp = a.appointmentDate.localeCompare(b.appointmentDate);
        if (cmp !== 0) return cmp;
        return a.appointmentTime.localeCompare(b.appointmentTime);
      });

      const pastAppointments = sortedAppointments.filter(
        (a) => a.appointmentDate < currentDate || (a.appointmentDate === currentDate && a.status === 'Completed')
      );
      const upcomingAppointments = sortedAppointments.filter(
        (a) => a.appointmentDate > currentDate || (a.appointmentDate === currentDate && a.status !== 'Completed')
      );

      const lastApt = pastAppointments.length > 0
        ? pastAppointments[pastAppointments.length - 1]
        : (sortedAppointments.length > 0 ? sortedAppointments[0] : null);

      const nextApt = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

      let assignedDoc: AggregatedPatient['assignedDoctor'] = null;
      let assignedDept: AggregatedPatient['department'] = null;

      const activeAppointment = nextApt || lastApt || (sortedAppointments.length > 0 ? sortedAppointments[sortedAppointments.length - 1] : null);

      if (activeAppointment) {
        assignedDoc = {
          id: activeAppointment.doctorId,
          name: activeAppointment.doctor.name,
          avatar: activeAppointment.doctor.avatar,
          department: activeAppointment.departmentName,
        };

        const matchingDoc = doctors.find(
          (d) => d.id === activeAppointment.doctorId || d.name.toLowerCase() === activeAppointment.doctor.name.toLowerCase()
        );
        if (matchingDoc) {
          assignedDoc.specialization = matchingDoc.specialization;
        }

        const matchingDept = departments.find(
          (dept) => dept.id === activeAppointment.departmentId || dept.name === activeAppointment.departmentName
        );
        assignedDept = {
          id: activeAppointment.departmentId || matchingDept?.id || '',
          name: activeAppointment.departmentName || matchingDept?.name || '',
        };
      }

      const registration = registrations.find(
        (r) => r.patientId.toLowerCase() === patientIdClean || r.patientId.toLowerCase() === patientCodeClean
      ) || null;

      const registrationDate = registration?.registrationDate || '';

      const insurance = insurances.find(
        (i) => i.patientId.toLowerCase() === patientIdClean || i.patientId.toLowerCase() === patientCodeClean
      ) || null;

      let insuranceStatus: AggregatedPatient['insuranceStatus'] = 'Uninsured';
      if (insurance) {
        if (insurance.providerStatus === 'Declined') insuranceStatus = 'Declined';
        else if (insurance.insuranceStatus === 'Active') insuranceStatus = 'Active';
        else if (insurance.insuranceStatus === 'Pending Verification') insuranceStatus = 'Pending';
        else if (insurance.insuranceStatus === 'Expired') insuranceStatus = 'Expired';
        else insuranceStatus = 'Pending';
      }

      // Compute real financials exclusively from Neon PostgreSQL charges table
      const patientCharges = charges.filter(
        (c) => c.patientId.toLowerCase() === patientIdClean || c.patientId.toLowerCase() === patientCodeClean
      );

      let totalCharges = 0;
      let insurancePaid = 0;
      let patientPaid = 0;
      let pendingBalance = 0;
      const aging = { current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0 };

      for (const chg of patientCharges) {
        totalCharges += Number(chg.totalCharges || 0);
        insurancePaid += Number(chg.insuranceReceived || 0);
        patientPaid += Number(chg.patientPaid || 0);
        const outstanding = Number(chg.totalOutstandingAR || 0);
        pendingBalance += outstanding;

        if (outstanding > 0 && chg.encounterDate) {
          const diffMs = new Date(currentDate).getTime() - new Date(chg.encounterDate).getTime();
          const diffDays = Math.max(0, Math.floor(diffMs / 86400000));
          if (diffDays <= 30) aging.current += outstanding;
          else if (diffDays <= 60) aging.days31_60 += outstanding;
          else if (diffDays <= 90) aging.days61_90 += outstanding;
          else if (diffDays <= 120) aging.days91_120 += outstanding;
          else aging.over120 += outstanding;
        }
      }
      aging.total = pendingBalance;
      const adjustments = Math.max(0, totalCharges - insurancePaid - patientPaid - pendingBalance);

      let appointmentStatus = 'None';
      if (nextApt) {
        appointmentStatus = nextApt.status === 'Confirmed' ? 'Confirmed' : 'Upcoming';
      } else if (lastApt) {
        appointmentStatus = lastApt.status;
      }

      const age = calculateAge(patient.dob, currentDate);

      return {
        id: patient.id,
        patientId: patient.patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        fullName,
        dob: patient.dob,
        age,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
        avatar: patient.avatar,
        bloodGroup: patient.bloodGroup || '',
        emergencyContact: registration?.emergencyContactName
          ? `${registration.emergencyContactName} (${registration.emergencyContactRelationship} - ${registration.emergencyContactPhone})`
          : patient.emergencyContact || 'Not recorded',
        registration,
        registrationDate,
        assignedDoctor: assignedDoc,
        department: assignedDept,
        lastAppointment: lastApt,
        lastAppointmentDate: lastApt?.appointmentDate || '',
        nextAppointment: nextApt,
        nextAppointmentDate: nextApt?.appointmentDate || '',
        appointmentStatus,
        allAppointments: sortedAppointments,
        insurance,
        insuranceProvider: insurance?.insuranceProvider || 'Uninsured',
        insuranceStatus,
        memberId: insurance?.memberId || '—',
        policyNumber: insurance?.policyNumber || '—',
        financials: {
          totalCharges: Math.max(0, totalCharges),
          insurancePaid: Math.max(0, insurancePaid),
          patientPaid: Math.max(0, patientPaid),
          adjustments: Math.max(0, adjustments),
          pendingBalance: Math.max(0, pendingBalance),
          aging,
        },
      };
    });
  },

  filterPatients(patients: AggregatedPatient[], params: PatientFilterParams): AggregatedPatient[] {
    return patients.filter((patient) => {
      if (params.searchQuery && params.searchQuery.trim()) {
        const q = params.searchQuery.trim().toLowerCase();
        const matchesName = patient.fullName.toLowerCase().includes(q);
        const matchesId = patient.patientId.toLowerCase().includes(q);
        const matchesPhone = patient.phone.toLowerCase().includes(q);
        const matchesEmail = patient.email.toLowerCase().includes(q);

        if (!matchesName && !matchesId && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      if (params.doctorId && params.doctorId !== 'all') {
        const targetDoctor = params.doctorId.toLowerCase();
        const hasMatchingAssigned = patient.assignedDoctor && (
          patient.assignedDoctor.id.toLowerCase() === targetDoctor ||
          patient.assignedDoctor.name.toLowerCase().includes(targetDoctor)
        );

        const hasMatchingAppointmentDoctor = patient.allAppointments.some((a) =>
          a.doctorId.toLowerCase() === targetDoctor ||
          a.doctor.name.toLowerCase().includes(targetDoctor)
        );

        if (!hasMatchingAssigned && !hasMatchingAppointmentDoctor) {
          return false;
        }
      }

      if (params.departmentId && params.departmentId !== 'all') {
        const targetDept = params.departmentId.toLowerCase();
        const hasMatchingAssigned = patient.department && (
          patient.department.id.toLowerCase() === targetDept ||
          patient.department.name.toLowerCase().includes(targetDept)
        );

        const hasMatchingAppointmentDept = patient.allAppointments.some((a) =>
          a.departmentId.toLowerCase() === targetDept ||
          a.departmentName.toLowerCase().includes(targetDept)
        );

        if (!hasMatchingAssigned && !hasMatchingAppointmentDept) {
          return false;
        }
      }

      if (params.gender && params.gender !== 'all') {
        if (patient.gender.toLowerCase() !== params.gender.toLowerCase()) {
          return false;
        }
      }

      if (params.ageGroup && params.ageGroup !== 'all') {
        const age = patient.age;
        if (params.ageGroup === '0-18' && (age < 0 || age > 18)) return false;
        if (params.ageGroup === '19-35' && (age < 19 || age > 35)) return false;
        if (params.ageGroup === '36-50' && (age < 36 || age > 50)) return false;
        if (params.ageGroup === '51-65' && (age < 51 || age > 65)) return false;
        if (params.ageGroup === '65+' && age < 65) return false;
      }

      if (params.appointmentStatus && params.appointmentStatus !== 'all') {
        const targetStatus = params.appointmentStatus.toLowerCase();
        const currentAptStatus = patient.appointmentStatus.toLowerCase();

        const matchesCurrent = currentAptStatus === targetStatus ||
          (targetStatus === 'upcoming' && (currentAptStatus === 'upcoming' || currentAptStatus === 'scheduled'));

        const matchesAny = patient.allAppointments.some((a) => {
          const s = a.status.toLowerCase();
          if (targetStatus === 'upcoming') {
            return s === 'scheduled' || s === 'confirmed';
          }
          return s === targetStatus;
        });

        if (!matchesCurrent && !matchesAny) {
          return false;
        }
      }

      if (params.insuranceStatus && params.insuranceStatus !== 'all') {
        if (patient.insuranceStatus.toLowerCase() !== params.insuranceStatus.toLowerCase()) {
          return false;
        }
      }

      if (params.dateFilterType && (params.dateFrom || params.dateTo)) {
        let dateToCheck = '';
        if (params.dateFilterType === 'registration') {
          dateToCheck = patient.registrationDate;
        } else if (params.dateFilterType === 'lastAppointment') {
          dateToCheck = patient.lastAppointmentDate;
        } else if (params.dateFilterType === 'nextAppointment') {
          dateToCheck = patient.nextAppointmentDate;
        }

        if (!dateToCheck) return false;

        if (params.dateFrom && dateToCheck < params.dateFrom) {
          return false;
        }
        if (params.dateTo && dateToCheck > params.dateTo) {
          return false;
        }
      }

      return true;
    });
  },

  calculateSummaryStats(patients: AggregatedPatient[]): PatientsSummaryStats {
    const totalPatients = patients.length;

    const activePatients = patients.filter((p) => {
      return (
        p.insuranceStatus === 'Active' ||
        p.appointmentStatus === 'Confirmed' ||
        p.appointmentStatus === 'Upcoming' ||
        p.appointmentStatus === 'Completed'
      );
    }).length;

    const patientsWithUpcomingAppointments = patients.filter(
      (p) => Boolean(p.nextAppointmentDate) || p.appointmentStatus === 'Upcoming' || p.appointmentStatus === 'Confirmed'
    ).length;

    const pendingInsurance = patients.filter((p) => p.insuranceStatus === 'Pending').length;

    const patientsWithOutstandingBalance = patients.filter(
      (p) => p.financials.pendingBalance > 0
    ).length;

    return {
      totalPatients,
      activePatients,
      patientsWithUpcomingAppointments,
      pendingInsurance,
      patientsWithOutstandingBalance,
    };
  },

  calculateFinancialTotals(patients: AggregatedPatient[]): FinancialSummaryTotals {
    return patients.reduce(
      (acc, p) => {
        acc.totalCharges += p.financials.totalCharges;
        acc.insurancePaid += p.financials.insurancePaid;
        acc.patientPaid += p.financials.patientPaid;
        acc.adjustments += p.financials.adjustments;
        acc.outstanding += p.financials.pendingBalance;
        acc.aging.current += p.financials.aging.current;
        acc.aging.days31_60 += p.financials.aging.days31_60;
        acc.aging.days61_90 += p.financials.aging.days61_90;
        acc.aging.days91_120 += p.financials.aging.days91_120;
        acc.aging.over120 += p.financials.aging.over120;
        acc.aging.total += p.financials.aging.total;
        return acc;
      },
      {
        totalCharges: 0,
        insurancePaid: 0,
        patientPaid: 0,
        adjustments: 0,
        outstanding: 0,
        aging: {
          current: 0,
          days31_60: 0,
          days61_90: 0,
          days91_120: 0,
          over120: 0,
          total: 0,
        },
      }
    );
  },
};
