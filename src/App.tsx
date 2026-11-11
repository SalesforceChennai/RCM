import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast, type ToastMessage } from './components/Toast';
import { AppointmentDetailsModal } from './components/AppointmentDetailsModal';
import { RescheduleModal } from './components/RescheduleModal';
import { NewPatientModal } from './components/NewPatientModal';
import { PatientDetailsModal } from './components/PatientDetailsModal';
import { DashboardPage } from './pages/DashboardPage';
import { NewAppointmentPage } from './pages/NewAppointmentPage';
import { PatientRegistrationPage } from './pages/PatientRegistrationPage';
import { InsuranceVerificationPage } from './pages/InsuranceVerificationPage';
import { PriorAuthorizationPage } from './pages/PriorAuthorizationPage';
import { ChargeCapturePage } from './pages/ChargeCapturePage';
import { MedicalCodingPage } from './pages/MedicalCodingPage';
import { ClaimCreationPage } from './pages/ClaimCreationPage';
import { PaymentPredictionPage } from './pages/PaymentPredictionPage';
import { PatientsPage } from './pages/PatientsPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { CalendarPage } from './pages/CalendarPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { LoginPage } from './pages/LoginPage';
import { authService, type AuthUser } from './services/authService';
import type {
  Appointment,
  Doctor,
  Department,
  AppointmentStatus,
  DashboardStats,
  Patient
} from './types';
import { appointmentService } from './services/appointmentService';
import { doctorService } from './services/doctorService';
import { departmentService } from './services/departmentService';
import { statsService } from './services/statsService';
import { storageService } from './services/storageService';
import { patientService } from './services/patientService';

export const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getUser());

  // Navigation
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Cross-Module Patient Linking
  const [selectedPatientIdForRegistration, setSelectedPatientIdForRegistration] = useState<string | null>(null);
  const [selectedPatientIdForInsurance, setSelectedPatientIdForInsurance] = useState<string | null>(null);
  const [selectedPatientIdForPriorAuth, setSelectedPatientIdForPriorAuth] = useState<string | null>(null);
  const [selectedPatientIdForChargeCapture, setSelectedPatientIdForChargeCapture] = useState<string | null>(null);
  const [selectedPatientIdForMedicalCoding, setSelectedPatientIdForMedicalCoding] = useState<string | null>(null);
  const [selectedPatientIdForClaimCreation, setSelectedPatientIdForClaimCreation] = useState<string | null>(null);

  // Data & State
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointmentsCount: 0,
    upcomingAppointmentsCount: 0,
    completedAppointmentsCount: 0,
    cancelledAppointmentsCount: 0,
    noShowAppointmentsCount: 0,
  });

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [totalAppointments, setTotalAppointments] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Filter Bar State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus | 'All'>('All');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return storageService.getCurrentDate() || new Date().toISOString().split('T')[0];
  });

  // Modals & Feedback
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState<boolean>(false);
  const [newlyCreatedPatient, setNewlyCreatedPatient] = useState<Patient | null>(null);
  const [selectedPatientIdForDetails, setSelectedPatientIdForDetails] = useState<string | null>(null);
  const [isPatientDetailsModalOpen, setIsPatientDetailsModalOpen] = useState<boolean>(false);
  const [preselectedPatientForNewApt, setPreselectedPatientForNewApt] = useState<Patient | null>(null);
  const [patientsRefreshKey, setPatientsRefreshKey] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial reference data load
  useEffect(() => {
    const loadDoctorsAndDepts = async () => {
      const [docList, deptList] = await Promise.all([
        doctorService.getAll(),
        departmentService.getAll(),
      ]);
      setDoctors(docList);
      setDepartments(deptList);
    };
    loadDoctorsAndDepts();
  }, []);

  // Fetch appointments and stats
  const refreshData = useCallback(async () => {
    try {
      const [res, currentStats] = await Promise.all([
        appointmentService.getAppointments({
          searchQuery,
          doctorId: selectedDoctor,
          departmentId: selectedDepartment,
          status: selectedStatus,
          date: selectedDate,
          page: currentPage,
          limit: 6,
        }),
        statsService.getDashboardStats(selectedDate),
      ]);

      setAppointments(res.data);
      setTotalAppointments(res.total);
      setTotalPages(res.totalPages);
      setStats(currentStats);
    } catch {
      addToast('error', 'Failed to retrieve appointments data.');
    }
  }, [searchQuery, selectedDoctor, selectedDepartment, selectedStatus, selectedDate, currentPage]);

  useEffect(() => {
    refreshData();
  }, [refreshData, currentView]);

  // Navigation Handler
  const handleNavigate = (view: string) => {
    if (view === 'new-appointment' || view === 'appointments') {
      setPreselectedPatientForNewApt(null);
      setCurrentView('new-appointment');
      return;
    }
    setCurrentView(view);
    if (view === 'dashboard') {
      refreshData();
    }
  };

  // Handlers
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDoctor('all');
    setSelectedDepartment('all');
    setSelectedStatus('All');
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    storageService.setCurrentDate(today);
    setCurrentPage(1);
    addToast('info', 'Filters reset to default view.');
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      await appointmentService.updateStatus(appointmentId, newStatus);
      addToast('success', `Appointment status updated to ${newStatus}.`);
      setPatientsRefreshKey((prev) => prev + 1);
      refreshData();
      if (viewingAppointment && viewingAppointment.id === appointmentId) {
        setViewingAppointment((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to update appointment status.');
    }
  };

  const handleRescheduleConfirm = async (appointmentId: string, newDate: string, newTime: string) => {
    try {
      await appointmentService.reschedule(appointmentId, newDate, newTime);
      addToast('success', `Appointment rescheduled to ${newDate} at ${newTime}.`);
      setPatientsRefreshKey((prev) => prev + 1);
      refreshData();
    } catch (err: any) {
      addToast('error', err?.message || 'Failed to reschedule.');
      throw err;
    }
  };

  const handlePatientCreated = async (patient: Patient) => {
    setNewlyCreatedPatient(patient);
    setPreselectedPatientForNewApt(patient);
    setPatientsRefreshKey((prev) => prev + 1);
    // Sync cache with PostgreSQL data
    const currentPatients = storageService.getPatients();
    storageService.setPatients([patient, ...currentPatients.filter((p) => p.id !== patient.id)]);
    try {
      await patientService.getAll();
    } catch {}
    addToast('success', `Patient ${patient.firstName} ${patient.lastName} (${patient.patientId}) registered successfully.`);
  };

  const handleAppointmentCreated = async (appointment: any) => {
    if (appointment?.appointmentDate) {
      setSelectedDate(appointment.appointmentDate);
      storageService.setCurrentDate(appointment.appointmentDate);
    }
    setSearchQuery('');
    setSelectedDoctor('all');
    setSelectedDepartment('all');
    setSelectedStatus('All');
    setCurrentPage(1);
    await refreshData();
    addToast(
      'success',
      `Appointment ${appointment?.appointmentCode || ''} booked for ${appointment?.appointmentDate} at ${appointment?.appointmentTime}.`
    );
  };

  const handlePatientClick = (patientId: string) => {
    setSelectedPatientIdForDetails(patientId);
    setIsPatientDetailsModalOpen(true);
  };

  const handleCreateAppointmentForPatient = (patient: Patient) => {
    setIsPatientDetailsModalOpen(false);
    setSelectedPatientIdForDetails(null);
    setPreselectedPatientForNewApt(patient);
    setCurrentView('new-appointment');
  };

  // Verify auth session on initial load
  useEffect(() => {
    const verifyAuth = async () => {
      const token = authService.getToken();
      if (token) {
        const user = await authService.fetchCurrentUser();
        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      }
    };
    verifyAuth();
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    authService.clearSession();
    setCurrentUser(null);
    setCurrentView('dashboard');
    addToast('info', 'You have been signed out successfully.');
  };

  // Protected application guard: Show login page if not authenticated
  if (!currentUser) {
    return (
      <>
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onSuccessToast={(msg) => addToast('success', msg)}
          onErrorToast={(msg) => addToast('error', msg)}
        />
        <Toast toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div className={`app-container ${currentView === 'rcm-ai-assistant' ? 'app-assistant-mode' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <div className={`main-content ${currentView === 'rcm-ai-assistant' ? 'main-content-assistant' : ''}`}>
        {/* Header */}
        <Header
          currentView={currentView}
          onNavigate={handleNavigate}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          globalSearchQuery={searchQuery}
          onGlobalSearchChange={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* View Routing */}
        {currentView === 'dashboard' || currentView === 'appointments' ? (
          <DashboardPage
            stats={stats}
            appointments={appointments}
            totalAppointments={totalAppointments}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => setCurrentPage(p)}
            doctors={doctors}
            departments={departments}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            selectedDoctor={selectedDoctor}
            onDoctorChange={(doc) => {
              setSelectedDoctor(doc);
              setCurrentPage(1);
            }}
            selectedDepartment={selectedDepartment}
            onDepartmentChange={(dept) => {
              setSelectedDepartment(dept);
              setCurrentPage(1);
            }}
            selectedStatus={selectedStatus}
            onStatusChange={(st) => {
              setSelectedStatus(st);
              setCurrentPage(1);
            }}
            selectedDate={selectedDate}
            onDateChange={(d) => {
              setSelectedDate(d);
              setCurrentPage(1);
            }}
            onClearFilters={handleClearFilters}
            onViewDetails={(apt) => setViewingAppointment(apt)}
            onReschedule={(apt) => setReschedulingAppointment(apt)}
            onChangeStatus={handleStatusChange}
            onNewAppointmentClick={() => {
              setPreselectedPatientForNewApt(null);
              setCurrentView('new-appointment');
            }}
            onPatientClick={handlePatientClick}
            onOpenCalendar={() => handleNavigate('calendar')}
          />
        ) : currentView === 'new-appointment' ? (
          <NewAppointmentPage
            onCancel={() => handleNavigate('dashboard')}
            onAppointmentCreated={() => {
              addToast('success', 'New appointment created successfully!');
              setPreselectedPatientForNewApt(null);
              handleNavigate('dashboard');
            }}
            onOpenNewPatientModal={() => setIsNewPatientModalOpen(true)}
            newlyCreatedPatient={newlyCreatedPatient}
            preselectedPatient={preselectedPatientForNewApt}
            onError={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'registration' ? (
          <PatientRegistrationPage
            preselectedPatientId={selectedPatientIdForRegistration}
            onNavigateToInsurance={(patId) => {
              setSelectedPatientIdForInsurance(patId);
              setCurrentView('insurance');
            }}
            onCancel={() => handleNavigate('dashboard')}
            onSuccess={(msg) => addToast('success', msg)}
            onError={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'insurance' ? (
          <InsuranceVerificationPage
            preselectedPatientId={selectedPatientIdForInsurance}
            onNavigateToPriorAuth={(patId) => {
              setSelectedPatientIdForPriorAuth(patId);
              setCurrentView('prior-auth');
            }}
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onSuccess={(msg) => addToast('success', msg)}
            onError={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'prior-auth' ? (
          <PriorAuthorizationPage
            preselectedPatientId={selectedPatientIdForPriorAuth}
            onNavigateToChargeCapture={(patId) => {
              setSelectedPatientIdForChargeCapture(patId);
              setCurrentView('charge-capture');
            }}
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onSuccess={(msg) => addToast('success', msg)}
            onError={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'charge-capture' ? (
          <ChargeCapturePage
            preselectedPatientId={selectedPatientIdForChargeCapture}
            onNavigateToMedicalCoding={(patId) => {
              if (patId) setSelectedPatientIdForMedicalCoding(patId);
              setCurrentView('medical-coding');
            }}
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onSuccess={(msg) => addToast('success', msg)}
            onError={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'medical-coding' ? (
          <MedicalCodingPage
            preselectedPatientId={selectedPatientIdForMedicalCoding}
            onNavigateToChargeCapture={(patId) => {
              if (patId) setSelectedPatientIdForChargeCapture(patId);
              setCurrentView('charge-capture');
            }}
            onNavigateToClaimCreation={(patId) => {
              if (patId) setSelectedPatientIdForClaimCreation(patId);
              setCurrentView('claim-creation');
            }}
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onSuccess={(msg) => addToast('success', msg)}
            onError={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'claim-creation' ? (
          <ClaimCreationPage
            patientId={selectedPatientIdForClaimCreation || selectedPatientIdForMedicalCoding}
            onNavigateToMedicalCoding={(patId) => {
              if (patId) setSelectedPatientIdForMedicalCoding(patId);
              setCurrentView('medical-coding');
            }}
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onSuccess={(msg) => addToast('success', msg)}
          />
        ) : currentView === 'payment-prediction' ? (
          <PaymentPredictionPage
            onSuccess={(msg) => addToast('success', msg)}
          />
        ) : currentView === 'patients' ? (
          <PatientsPage
            key={patientsRefreshKey}
            onSelectPatient={handlePatientClick}
            onNewPatientClick={() => setIsNewPatientModalOpen(true)}
            onBookAppointment={(patient) => {
              setPreselectedPatientForNewApt(patient);
              setCurrentView('new-appointment');
            }}
            onRegisterPatient={(patient) => {
              setSelectedPatientIdForRegistration(patient.id);
              setCurrentView('registration');
            }}
            onNavigateToInsurance={(patientId) => {
              setSelectedPatientIdForInsurance(patientId);
              setCurrentView('insurance');
            }}
          />
        ) : currentView === 'rcm-ai-assistant' ? (
          <AiAssistantPage
            onNavigate={(viewId) => {
              handleNavigate(viewId);
            }}
            onSuccessToast={(msg) => addToast('success', msg)}
            onPatientCreated={handlePatientCreated}
            onAppointmentCreated={handleAppointmentCreated}
          />
        ) : currentView === 'calendar' ? (
          <CalendarPage
            doctors={doctors}
            departments={departments}
            onViewDetails={(apt) => setViewingAppointment(apt)}
            onReschedule={(apt) => setReschedulingAppointment(apt)}
            onChangeStatus={handleStatusChange}
            onNewAppointmentClick={(selectedDate) => {
              if (selectedDate) {
                setSelectedDate(selectedDate);
                storageService.setCurrentDate(selectedDate);
              }
              setPreselectedPatientForNewApt(null);
              setCurrentView('new-appointment');
            }}
            onPatientClick={(pat) => handlePatientClick(typeof pat === 'string' ? pat : pat.id)}
            onSuccessToast={(msg) => addToast('success', msg)}
            onErrorToast={(msg) => addToast('error', msg)}
            refreshTrigger={patientsRefreshKey}
          />
        ) : currentView === 'departments' ? (
          <DepartmentsPage
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onScheduleWithDoctor={(doc) => {
              setSelectedDoctor(doc.name);
              setSelectedDepartment(doc.departmentName || doc.departmentId);
              setPreselectedPatientForNewApt(null);
              setCurrentView('new-appointment');
            }}
            onSuccessToast={(msg) => addToast('success', msg)}
            onErrorToast={(msg) => addToast('error', msg)}
          />
        ) : currentView === 'doctors' ? (
          <DoctorsPage
            onNavigateToDashboard={() => handleNavigate('dashboard')}
            onScheduleWithDoctor={(doc) => {
              setSelectedDoctor(doc.name);
              setSelectedDepartment(doc.departmentName || doc.departmentId);
              setPreselectedPatientForNewApt(null);
              setCurrentView('new-appointment');
            }}
            onSuccessToast={(msg) => addToast('success', msg)}
            onErrorToast={(msg) => addToast('error', msg)}
          />
        ) : (
          <PlaceholderPage
            title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
            description={`Access advanced ${currentView} operations, billing records, and automated workflows`}
            onGoToAppointments={() => handleNavigate('dashboard')}
          />
        )}
      </div>

      {/* Patient Details & History Modal */}
      <PatientDetailsModal
        patientId={selectedPatientIdForDetails}
        isOpen={isPatientDetailsModalOpen}
        onClose={() => {
          setIsPatientDetailsModalOpen(false);
          setSelectedPatientIdForDetails(null);
        }}
        onCreateAppointmentForPatient={handleCreateAppointmentForPatient}
        onRegisterPatient={(pat) => {
          setIsPatientDetailsModalOpen(false);
          setSelectedPatientIdForDetails(null);
          setSelectedPatientIdForRegistration(pat.id);
          setCurrentView('registration');
        }}
        onViewAppointmentDetails={(apt) => {
          setIsPatientDetailsModalOpen(false);
          setSelectedPatientIdForDetails(null);
          setViewingAppointment(apt);
        }}
        onNavigateToInsurance={(patId) => {
          setIsPatientDetailsModalOpen(false);
          setSelectedPatientIdForDetails(null);
          setSelectedPatientIdForInsurance(patId);
          setCurrentView('insurance');
        }}
        onNavigateToChargeCapture={(patId) => {
          setIsPatientDetailsModalOpen(false);
          setSelectedPatientIdForDetails(null);
          setSelectedPatientIdForChargeCapture(patId);
          setCurrentView('charge-capture');
        }}
        onNavigateToMedicalCoding={(patId) => {
          setIsPatientDetailsModalOpen(false);
          setSelectedPatientIdForDetails(null);
          setSelectedPatientIdForMedicalCoding(patId);
          setCurrentView('medical-coding');
        }}
      />

      {/* Appointment Details Modal */}
      {viewingAppointment && (
        <AppointmentDetailsModal
          appointment={viewingAppointment}
          onClose={() => setViewingAppointment(null)}
          onReschedule={(apt) => {
            setViewingAppointment(null);
            setReschedulingAppointment(apt);
          }}
          onChangeStatus={handleStatusChange}
          onProceedToRegistration={(patientId) => {
            setViewingAppointment(null);
            setSelectedPatientIdForRegistration(patientId);
            setCurrentView('registration');
          }}
          onProceedToInsurance={(patientId) => {
            setViewingAppointment(null);
            setSelectedPatientIdForInsurance(patientId);
            setCurrentView('insurance');
          }}
          onProceedToPriorAuth={(patientId) => {
            setViewingAppointment(null);
            setSelectedPatientIdForPriorAuth(patientId);
            setCurrentView('prior-auth');
          }}
        />
      )}

      {/* Reschedule Modal */}
      {reschedulingAppointment && (
        <RescheduleModal
          appointment={reschedulingAppointment}
          onClose={() => setReschedulingAppointment(null)}
          onConfirmReschedule={handleRescheduleConfirm}
        />
      )}

      {/* New Patient Registration Modal */}
      <NewPatientModal
        isOpen={isNewPatientModalOpen}
        onClose={() => setIsNewPatientModalOpen(false)}
        onPatientCreated={handlePatientCreated}
      />

      {/* Toast Notifications Container */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;

