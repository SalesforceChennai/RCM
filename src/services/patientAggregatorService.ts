import type {
  Appointment,
  PatientRegistration,
  InsuranceInfo,
  Gender
} from '../types';
import { storageService } from './storageService';

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
  doctorId?: string; // 'all' or doctorId/name
  departmentId?: string; // 'all' or deptId/name
  gender?: string; // 'all' | 'Male' | 'Female' | 'Other'
  ageGroup?: string; // 'all' | '0-18' | '19-35' | '36-50' | '51-65' | '65+'
  appointmentStatus?: string; // 'all' | 'Upcoming' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-show'
  insuranceStatus?: string; // 'all' | 'Active' | 'Pending' | 'Expired' | 'Declined'
  dateFilterType?: 'registration' | 'lastAppointment' | 'nextAppointment';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
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

const MOCK_PATIENT_FINANCIALS: Record<string, {
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
  };
}> = {
  'pat-1': {
    totalCharges: 182450.00,
    insurancePaid: 118930.20,
    patientPaid: 13830.00,
    adjustments: 28620.00,
    outstanding: 48670.40,
    aging: { current: 28400.00, days31_60: 12200.00, days61_90: 5800.40, days91_120: 2270.00, over120: 0.00 }
  },
  'pat-2': {
    totalCharges: 164200.00,
    insurancePaid: 107050.40,
    patientPaid: 12450.00,
    adjustments: 25750.00,
    outstanding: 43800.20,
    aging: { current: 24500.00, days31_60: 10800.00, days61_90: 5500.20, days91_120: 3000.00, over120: 0.00 }
  },
  'pat-3': {
    totalCharges: 146800.00,
    insurancePaid: 95720.00,
    patientPaid: 11130.00,
    adjustments: 23020.00,
    outstanding: 39150.00,
    aging: { current: 22100.00, days31_60: 9400.00, days61_90: 4850.00, days91_120: 2800.00, over120: 0.00 }
  },
  'pat-4': {
    totalCharges: 139500.00,
    insurancePaid: 90950.00,
    patientPaid: 10580.00,
    adjustments: 21870.00,
    outstanding: 37200.00,
    aging: { current: 20800.00, days31_60: 8900.00, days61_90: 4500.00, days91_120: 3000.00, over120: 0.00 }
  },
  'pat-5': {
    totalCharges: 153200.00,
    insurancePaid: 99890.00,
    patientPaid: 11620.00,
    adjustments: 24020.00,
    outstanding: 40870.00,
    aging: { current: 23200.00, days31_60: 9800.00, days61_90: 4970.00, days91_120: 2900.00, over120: 0.00 }
  },
  'pat-6': {
    totalCharges: 128400.00,
    insurancePaid: 83710.00,
    patientPaid: 9740.00,
    adjustments: 20130.00,
    outstanding: 34260.00,
    aging: { current: 19400.00, days31_60: 8200.00, days61_90: 4160.00, days91_120: 2500.00, over120: 0.00 }
  },
  'pat-7': {
    totalCharges: 117600.00,
    insurancePaid: 76680.00,
    patientPaid: 8920.00,
    adjustments: 18440.00,
    outstanding: 31390.00,
    aging: { current: 17800.00, days31_60: 7500.00, days61_90: 3890.00, days91_120: 2200.00, over120: 0.00 }
  },
  'pat-8': {
    totalCharges: 114100.00,
    insurancePaid: 74400.00,
    patientPaid: 8650.00,
    adjustments: 17890.00,
    outstanding: 30450.00,
    aging: { current: 17200.00, days31_60: 7300.00, days61_90: 3750.00, days91_120: 2200.00, over120: 0.00 }
  },
  'pat-9': {
    totalCharges: 112200.00,
    insurancePaid: 72900.00,
    patientPaid: 8510.20,
    adjustments: 17516.30,
    outstanding: 29742.30,
    aging: { current: 12020.00, days31_60: 5110.50, days61_90: 5229.40, days91_120: 2282.40, over120: 5100.00 }
  }
};

export const patientAggregatorService = {
  /**
   * Retrieves and merges all patient information with their appointments,
   * registrations, doctors, insurance, and charge capture data.
   */
  getAggregatedPatients(): AggregatedPatient[] {
    const patients = storageService.getPatients();
    const appointments = storageService.getAppointments();
    const doctors = storageService.getDoctors();
    const departments = storageService.getDepartments();
    const registrations = storageService.getRegistrations();
    const insurances = storageService.getInsuranceList();
    const currentDate = storageService.getCurrentDate() || '2024-05-31';

    return patients.map((patient) => {
      const patientIdClean = patient.id.toLowerCase();
      const patientCodeClean = (patient.patientId || '').toLowerCase();
      const fullName = `${patient.firstName} ${patient.lastName}`.trim();
      const fullNameClean = fullName.toLowerCase();

      // Find all appointments for this patient
      const patientAppointments = appointments.filter((a) => {
        if (a.patientId && a.patientId.toLowerCase() === patientIdClean) return true;
        if (a.patient?.id && a.patient.id.toLowerCase() === patientIdClean) return true;
        if (patientCodeClean && a.patient?.patientCode && a.patient.patientCode.toLowerCase() === patientCodeClean) return true;
        if (fullNameClean && a.patient?.name && a.patient.name.toLowerCase() === fullNameClean) return true;
        return false;
      });

      // Sort appointments chronologically
      const sortedAppointments = [...patientAppointments].sort((a, b) => {
        const cmp = a.appointmentDate.localeCompare(b.appointmentDate);
        if (cmp !== 0) return cmp;
        return a.appointmentTime.localeCompare(b.appointmentTime);
      });

      // Split into past and upcoming relative to current system date
      const pastAppointments = sortedAppointments.filter(
        (a) => a.appointmentDate < currentDate || (a.appointmentDate === currentDate && a.status === 'Completed')
      );
      const upcomingAppointments = sortedAppointments.filter(
        (a) => a.appointmentDate > currentDate || (a.appointmentDate === currentDate && a.status !== 'Completed')
      );

      // Last appointment is the latest among past, or the latest overall if no past
      const lastApt = pastAppointments.length > 0
        ? pastAppointments[pastAppointments.length - 1]
        : (sortedAppointments.length > 0 ? sortedAppointments[0] : null);

      // Next appointment is the nearest upcoming
      const nextApt = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;

      // Determine assigned or consulting doctor
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

        const matchingDoc = doctors.find((d) => d.id === activeAppointment.doctorId || d.name.toLowerCase() === activeAppointment.doctor.name.toLowerCase());
        if (matchingDoc) {
          assignedDoc.specialization = matchingDoc.specialization;
        }

        assignedDept = {
          id: activeAppointment.departmentId || 'dept-gen',
          name: activeAppointment.departmentName || 'General Medicine',
        };
      } else {
        // Fallback: assign to a default doctor based on patient code
        const hash = patient.patientId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const fallbackDoc = doctors[hash % doctors.length] || doctors[0];
        if (fallbackDoc) {
          assignedDoc = {
            id: fallbackDoc.id,
            name: fallbackDoc.name,
            avatar: fallbackDoc.avatar,
            specialization: fallbackDoc.specialization,
            department: fallbackDoc.departmentName,
          };
          const matchingDept = departments.find((d) => d.id === fallbackDoc.departmentId);
          assignedDept = {
            id: fallbackDoc.departmentId,
            name: matchingDept ? matchingDept.name : fallbackDoc.departmentName,
          };
        }
      }

      // Registration data
      const registration = registrations.find(
        (r) => r.patientId.toLowerCase() === patientIdClean || r.patientId.toLowerCase() === patientCodeClean
      ) || null;

      const registrationDate = registration?.registrationDate || '2024-05-31';

      // Insurance data
      const insurance = insurances.find(
        (i) => i.patientId.toLowerCase() === patientIdClean || i.patientId.toLowerCase() === patientCodeClean
      ) || null;

      let insuranceStatus: AggregatedPatient['insuranceStatus'] = 'Uninsured';
      if (insurance) {
        if (insurance.insuranceStatus === 'Active') insuranceStatus = 'Active';
        else if (insurance.insuranceStatus === 'Pending Verification') insuranceStatus = 'Pending';
        else if (insurance.insuranceStatus === 'Expired') insuranceStatus = 'Expired';
        else if (insurance.providerStatus === 'Declined') insuranceStatus = 'Declined';
        else insuranceStatus = 'Active';
      }

      // Charge Capture & Financials
      const mockFin = MOCK_PATIENT_FINANCIALS[patient.id];
      let totalCharges = 0;
      let insurancePaid = 0;
      let patientPaid = 0;
      let adjustments = 0;
      let pendingBalance = 0;
      let aging = { current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0 };

      if (mockFin) {
        totalCharges = mockFin.totalCharges;
        insurancePaid = mockFin.insurancePaid;
        patientPaid = mockFin.patientPaid;
        adjustments = mockFin.adjustments;
        pendingBalance = mockFin.outstanding;
        aging = {
          ...mockFin.aging,
          total: mockFin.outstanding,
        };
      } else {
        totalCharges = 1250.00;
        insurancePaid = 800.00;
        patientPaid = 150.00;
        adjustments = 100.00;
        pendingBalance = 200.00;
        aging = { current: 200.00, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 200.00 };
      }

      // Appointment Status
      let appointmentStatus = 'No-show';
      if (nextApt) {
        appointmentStatus = nextApt.status === 'Confirmed' ? 'Confirmed' : 'Upcoming';
      } else if (lastApt) {
        appointmentStatus = lastApt.status;
      } else {
        appointmentStatus = 'Confirmed';
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
        bloodGroup: patient.bloodGroup || 'O+',
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
        insuranceProvider: insurance?.insuranceProvider || (patientIdClean.includes('pat-1') ? 'Blue Cross Blue Shield' : 'UnitedHealthcare'),
        insuranceStatus,
        memberId: insurance?.memberId || `MBR-${patient.patientId}`,
        policyNumber: insurance?.policyNumber || `POL-88421-${patient.patientId}`,
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

  /**
   * Filters a list of aggregated patients using the provided parameters.
   */
  filterPatients(patients: AggregatedPatient[], params: PatientFilterParams): AggregatedPatient[] {
    return patients.filter((patient) => {
      // 1. Text Search: Patient Name, Patient ID, Phone, Email
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

      // 2. Doctor Filter: matches assigned doctor or any appointment doctor
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

      // 3. Department Filter
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

      // 4. Gender Filter
      if (params.gender && params.gender !== 'all') {
        if (patient.gender.toLowerCase() !== params.gender.toLowerCase()) {
          return false;
        }
      }

      // 5. Age Group Filter: '0-18', '19-35', '36-50', '51-65', '65+'
      if (params.ageGroup && params.ageGroup !== 'all') {
        const age = patient.age;
        if (params.ageGroup === '0-18' && (age < 0 || age > 18)) return false;
        if (params.ageGroup === '19-35' && (age < 19 || age > 35)) return false;
        if (params.ageGroup === '36-50' && (age < 36 || age > 50)) return false;
        if (params.ageGroup === '51-65' && (age < 51 || age > 65)) return false;
        if (params.ageGroup === '65+' && age < 65) return false;
      }

      // 6. Appointment Status Filter: 'Upcoming', 'Confirmed', 'Completed', 'Cancelled', 'No-show'
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

      // 7. Insurance Status Filter: 'Active', 'Pending', 'Expired', 'Declined'
      if (params.insuranceStatus && params.insuranceStatus !== 'all') {
        if (patient.insuranceStatus.toLowerCase() !== params.insuranceStatus.toLowerCase()) {
          return false;
        }
      }

      // 8. Date Filter: 'registration', 'lastAppointment', 'nextAppointment'
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

  /**
   * Computes the 5 summary KPIs for the Patients page.
   */
  calculateSummaryStats(patients: AggregatedPatient[]): PatientsSummaryStats {
    const totalPatients = patients.length;

    // Active: has active insurance or confirmed/upcoming/completed visit
    const activePatients = patients.filter((p) => {
      return (
        p.insuranceStatus === 'Active' ||
        p.appointmentStatus === 'Confirmed' ||
        p.appointmentStatus === 'Upcoming' ||
        p.appointmentStatus === 'Completed'
      );
    }).length;

    // Upcoming Appointments: patients with a next appointment or upcoming status
    const patientsWithUpcomingAppointments = patients.filter(
      (p) => Boolean(p.nextAppointmentDate) || p.appointmentStatus === 'Upcoming' || p.appointmentStatus === 'Confirmed'
    ).length;

    // Pending Insurance: patients with insurance status 'Pending'
    const pendingInsurance = patients.filter((p) => p.insuranceStatus === 'Pending').length;

    // Outstanding Balance: pending balance > 0
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

  /**
   * Computes the financial summary and aging totals for a list of patients.
   */
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
