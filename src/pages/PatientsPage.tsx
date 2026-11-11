import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  RotateCcw,
  ShieldCheck,
  Eye,
  CalendarPlus,
  FileCheck2,
  X,
  Grid,
  List,
  Phone,
  Mail,
  SlidersHorizontal,
  Receipt,
  CreditCard,
  Scale,
  Clock
} from 'lucide-react';
import type { Doctor, Department, Patient } from '../types';
import {
  patientAggregatorService,
  type AggregatedPatient,
  type PatientFilterParams,
  type FinancialSummaryTotals
} from '../services/patientAggregatorService';
import { doctorService } from '../services/doctorService';
import { departmentService } from '../services/departmentService';
import { patientService } from '../services/patientService';

interface PatientsPageProps {
  onSelectPatient: (patientId: string) => void;
  onNewPatientClick: () => void;
  onBookAppointment: (patient: Patient) => void;
  onRegisterPatient: (patient: Patient) => void;
  onNavigateToInsurance: (patientId: string) => void;
}

export const PatientsPage: React.FC<PatientsPageProps> = ({
  onSelectPatient,
  onNewPatientClick,
  onBookAppointment,
  onRegisterPatient,
  onNavigateToInsurance,
}) => {
  // Base Data
  const [allPatients, setAllPatients] = useState<AggregatedPatient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Staged Filter Form Inputs
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('all');
  const [selectedAppointmentStatus, setSelectedAppointmentStatus] = useState<string>('all');
  const [selectedInsuranceStatus, setSelectedInsuranceStatus] = useState<string>('all');
  const [dateFilterType, setDateFilterType] = useState<'registration' | 'lastAppointment' | 'nextAppointment'>('lastAppointment');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Applied Filter State
  const [appliedFilters, setAppliedFilters] = useState<PatientFilterParams>({
    doctorId: 'all',
    departmentId: 'all',
    gender: 'all',
    ageGroup: 'all',
    appointmentStatus: 'all',
    insuranceStatus: 'all',
  });

  // UI States
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Load initial reference data & patients from PostgreSQL
  const loadData = async () => {
    setLoading(true);
    try {
      await patientService.getAll();
      const patients = patientAggregatorService.getAggregatedPatients();
      setAllPatients(patients);
    } catch (err) {
      console.error('Error loading patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const fetchMeta = async () => {
      const [docList, deptList] = await Promise.all([
        doctorService.getAll(),
        departmentService.getAll(),
      ]);
      setDoctors(docList);
      setDepartments(deptList);
    };
    fetchMeta();
  }, []);

  // Handle Search Input (updates live)
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
  };

  // Apply Staged Filters
  const handleApplyFilters = () => {
    setAppliedFilters({
      doctorId: selectedDoctor,
      departmentId: selectedDepartment,
      gender: selectedGender,
      ageGroup: selectedAgeGroup,
      appointmentStatus: selectedAppointmentStatus,
      insuranceStatus: selectedInsuranceStatus,
      dateFilterType: (dateFrom || dateTo) ? dateFilterType : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  };

  // Clear Filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDoctor('all');
    setSelectedDepartment('all');
    setSelectedGender('all');
    setSelectedAgeGroup('all');
    setSelectedAppointmentStatus('all');
    setSelectedInsuranceStatus('all');
    setDateFilterType('lastAppointment');
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({
      doctorId: 'all',
      departmentId: 'all',
      gender: 'all',
      ageGroup: 'all',
      appointmentStatus: 'all',
      insuranceStatus: 'all',
    });
  };

  // Count active filter pills
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.doctorId && appliedFilters.doctorId !== 'all') count++;
    if (appliedFilters.departmentId && appliedFilters.departmentId !== 'all') count++;
    if (appliedFilters.gender && appliedFilters.gender !== 'all') count++;
    if (appliedFilters.ageGroup && appliedFilters.ageGroup !== 'all') count++;
    if (appliedFilters.appointmentStatus && appliedFilters.appointmentStatus !== 'all') count++;
    if (appliedFilters.insuranceStatus && appliedFilters.insuranceStatus !== 'all') count++;
    if (appliedFilters.dateFrom || appliedFilters.dateTo) count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [appliedFilters, searchQuery]);

  // Filtered Patients List
  const filteredPatients = useMemo(() => {
    const combinedParams: PatientFilterParams = {
      ...appliedFilters,
      searchQuery,
    };
    return patientAggregatorService.filterPatients(allPatients, combinedParams);
  }, [allPatients, appliedFilters, searchQuery]);

  // Compute 5 Top Financial Summary Totals (RCM) based on filtered patients
  const financialTotals: FinancialSummaryTotals = useMemo(() => {
    return patientAggregatorService.calculateFinancialTotals(filteredPatients);
  }, [filteredPatients]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'confirmed';
      case 'Scheduled':
      case 'Upcoming':
        return 'scheduled';
      case 'Completed':
        return 'completed';
      case 'Cancelled':
        return 'cancelled';
      case 'No-show':
        return 'noshow';
      default:
        return '';
    }
  };

  const getInsuranceBadgeStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'Pending':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'Expired':
        return { bg: '#fee2e2', text: '#b91c1c', border: '#fecdd3' };
      case 'Declined':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div className="page-body animate-fade-in patients-page-body">

      {/* 1. TOP SECTION: COMPACT HORIZONTAL FINANCIAL SUMMARY CARDS (RCM) */}
      <div className="financial-summary-grid">
        {/* 1. Total Charges */}
        <div className="financial-summary-card">
          <div className="financial-card-icon-box blue">
            <Receipt size={20} />
          </div>
          <div className="financial-card-content">
            <div className="financial-card-title">Total Charges</div>
            <div className="financial-card-amount">${formatCurrency(financialTotals.totalCharges)}</div>
            <div className="financial-card-subtitle">This Month</div>
          </div>
        </div>

        {/* 2. Insurance Paid */}
        <div className="financial-summary-card">
          <div className="financial-card-icon-box green">
            <ShieldCheck size={20} />
          </div>
          <div className="financial-card-content">
            <div className="financial-card-title">Insurance Paid</div>
            <div className="financial-card-amount">${formatCurrency(financialTotals.insurancePaid)}</div>
            <div className="financial-card-subtitle">This Month</div>
          </div>
        </div>

        {/* 3. Patient Paid */}
        <div className="financial-summary-card">
          <div className="financial-card-icon-box purple">
            <CreditCard size={20} />
          </div>
          <div className="financial-card-content">
            <div className="financial-card-title">Patient Paid</div>
            <div className="financial-card-amount">${formatCurrency(financialTotals.patientPaid)}</div>
            <div className="financial-card-subtitle">This Month</div>
          </div>
        </div>

        {/* 4. Adjustments */}
        <div className="financial-summary-card">
          <div className="financial-card-icon-box orange">
            <Scale size={20} />
          </div>
          <div className="financial-card-content">
            <div className="financial-card-title">Adjustments</div>
            <div className="financial-card-amount">${formatCurrency(financialTotals.adjustments)}</div>
            <div className="financial-card-subtitle">This Month</div>
          </div>
        </div>

        {/* 5. Outstanding */}
        <div className="financial-summary-card">
          <div className="financial-card-icon-box red">
            <Clock size={20} />
          </div>
          <div className="financial-card-content">
            <div className="financial-card-title">Outstanding</div>
            <div className="financial-card-amount">${formatCurrency(financialTotals.outstanding)}</div>
            <div className="financial-card-subtitle">This Month</div>
          </div>
        </div>
      </div>

      {/* 2. MAIN PATIENTS CARD */}
      <div className="dashboard-main-card patients-card-container">
        {/* Card Header */}
        <div className="dashboard-card-header" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div className="card-header-left">
            <div className="card-header-icon-box">
              <Users size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="card-header-title">Patients Directory</h2>
              <p className="card-header-sub">
                Comprehensive patient directory linked with appointments, assigned doctors, and billing.
              </p>
            </div>
          </div>

          <div className="card-header-actions" style={{ flexWrap: 'wrap' }}>
            {/* View Mode Switcher */}
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                borderRadius: 8,
                padding: 3,
                border: '1px solid #e2e8f0',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.78125rem',
                  fontWeight: 600,
                }}
                title="Table View"
              >
                <List size={15} />
                <span>Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                  color: viewMode === 'cards' ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.78125rem',
                  fontWeight: 600,
                }}
                title="Card Grid View"
              >
                <Grid size={15} />
                <span>Cards</span>
              </button>
            </div>

            {/* Toggle Filters Panel */}
            <button
              type="button"
              className={`btn-secondary ${showFiltersPanel ? 'active' : ''}`}
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: showFiltersPanel ? '#eff6ff' : '#ffffff',
                borderColor: showFiltersPanel ? '#bfdbfe' : '#e2e8f0',
                color: showFiltersPanel ? '#2563eb' : '#334155',
              }}
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.6875rem',
                    padding: '2px 6px',
                    borderRadius: 10,
                    fontWeight: 700,
                  }}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Register New Patient Button */}
            <button
              type="button"
              className="btn-primary"
              onClick={onNewPatientClick}
            >
              <UserPlus size={16} />
              <span>+ Register Patient</span>
            </button>
          </div>
        </div>

        {/* 3. PROMINENT SEARCH BAR */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search patients dynamically by Name, Patient ID, Phone Number, or Email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 42px 12px 42px',
                borderRadius: 10,
                border: '1px solid #3B82F6',
                fontSize: '0.9375rem',
                color: '#0f172a',
                outline: 'none',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3B82F6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.18)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#3B82F6';
                e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.03)';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 4. PROMINENT FILTERS SECTION */}
        {showFiltersPanel && (
          <div
            style={{
              padding: '20px 24px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={17} color="#2563eb" />
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a' }}>
                  Filter Patients
                </h4>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Select multiple criteria to filter patient records
                </span>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#e11d48',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset All</span>
                </button>
              )}
            </div>

            {/* Filter Controls Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14,
                alignItems: 'flex-end',
              }}
            >
              {/* 1. Doctor Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Assigned Doctor
                </label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="all">All Doctors</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Department Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Department
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="all">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Gender Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Gender
                </label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="all">All Genders</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* 4. Age Group Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Age Group
                </label>
                <select
                  value={selectedAgeGroup}
                  onChange={(e) => setSelectedAgeGroup(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="all">All Ages</option>
                  <option value="0-18">0–18 years</option>
                  <option value="19-35">19–35 years</option>
                  <option value="36-50">36–50 years</option>
                  <option value="51-65">51–65 years</option>
                  <option value="65+">65+ years</option>
                </select>
              </div>

              {/* 5. Appointment Status Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Appointment Status
                </label>
                <select
                  value={selectedAppointmentStatus}
                  onChange={(e) => setSelectedAppointmentStatus(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="No-show">No-show</option>
                </select>
              </div>

              {/* 6. Insurance Status Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Insurance Status
                </label>
                <select
                  value={selectedInsuranceStatus}
                  onChange={(e) => setSelectedInsuranceStatus(e.target.value)}
                  className="filter-select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="all">All Insurance</option>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Expired">Expired</option>
                  <option value="Declined">Declined</option>
                </select>
              </div>
            </div>

            {/* 7. Date Range Filter Row */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px dashed #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: '#475569', marginRight: 8 }}>
                    Filter Date by:
                  </span>
                  <select
                    value={dateFilterType}
                    onChange={(e) => setDateFilterType(e.target.value as any)}
                    className="filter-select"
                    style={{ height: 36, fontSize: '0.8125rem' }}
                  >
                    <option value="registration">Registration Date</option>
                    <option value="lastAppointment">Last Appointment Date</option>
                    <option value="nextAppointment">Next Appointment Date</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.78125rem', color: '#64748b' }}>From:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="filter-date-input"
                    style={{ height: 36, fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.78125rem', color: '#64748b' }}>To:</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="filter-date-input"
                    style={{ height: 36, fontSize: '0.8125rem' }}
                  />
                </div>
              </div>

              {/* Action Buttons: Apply & Clear Filters */}
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearFilters}
                  style={{ padding: '8px 16px', fontSize: '0.84375rem' }}
                >
                  <RotateCcw size={14} />
                  <span>Clear Filters</span>
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApplyFilters}
                  style={{ padding: '8px 20px', fontSize: '0.84375rem' }}
                >
                  <Filter size={14} />
                  <span>Apply Filters</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Summary & Count Header */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontSize: '0.84375rem', color: '#64748b' }}>
            Showing <strong>{filteredPatients.length}</strong> matching {filteredPatients.length === 1 ? 'patient' : 'patients'}
            {allPatients.length !== filteredPatients.length && (
              <span> (filtered from {allPatients.length} total)</span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Active filters:</span>
              {appliedFilters.doctorId && appliedFilters.doctorId !== 'all' && (
                <span className="nav-badge" style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px' }}>
                  Doctor: {doctors.find((d) => d.id === appliedFilters.doctorId)?.name || appliedFilters.doctorId}
                </span>
              )}
              {appliedFilters.departmentId && appliedFilters.departmentId !== 'all' && (
                <span className="nav-badge" style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px' }}>
                  Dept: {departments.find((d) => d.id === appliedFilters.departmentId)?.name || appliedFilters.departmentId}
                </span>
              )}
              {appliedFilters.gender && appliedFilters.gender !== 'all' && (
                <span className="nav-badge" style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px' }}>
                  {appliedFilters.gender}
                </span>
              )}
              {appliedFilters.ageGroup && appliedFilters.ageGroup !== 'all' && (
                <span className="nav-badge" style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px' }}>
                  Age: {appliedFilters.ageGroup}
                </span>
              )}
              {appliedFilters.appointmentStatus && appliedFilters.appointmentStatus !== 'all' && (
                <span className="nav-badge" style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px' }}>
                  Status: {appliedFilters.appointmentStatus}
                </span>
              )}
              {appliedFilters.insuranceStatus && appliedFilters.insuranceStatus !== 'all' && (
                <span className="nav-badge" style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 8px' }}>
                  Insurance: {appliedFilters.insuranceStatus}
                </span>
              )}
              {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
                <span className="nav-badge" style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px' }}>
                  Date: {appliedFilters.dateFrom || 'Start'} to {appliedFilters.dateTo || 'End'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 5. PATIENT LIST (TABLE VIEW - FIXED HEIGHT SCROLLABLE CONTAINER) */}
        {viewMode === 'table' ? (
          <div className="patients-scroll-container">
            <table className="appointments-table" style={{ width: '100%', minWidth: 1050 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 190 }}>Patient Details</th>
                  <th style={{ minWidth: 110 }}>Age / Gender</th>
                  <th style={{ minWidth: 110 }}>Date of Birth</th>
                  <th style={{ minWidth: 160 }}>Contact Info</th>
                  <th style={{ minWidth: 180 }}>Department & Doctor</th>
                  <th style={{ minWidth: 110 }}>Last Visit</th>
                  <th style={{ minWidth: 110 }}>Next Visit</th>
                  <th style={{ minWidth: 110 }}>Appt Status</th>
                  <th style={{ minWidth: 150 }}>Insurance</th>
                  <th style={{ minWidth: 110, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10}>
                      <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                        <Users size={36} color="#2563eb" style={{ margin: '0 auto 10px' }} />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                          Loading patients directory...
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                        <Users size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                          No patients found matching your criteria
                        </div>
                        <p style={{ fontSize: '0.84375rem', marginTop: 4 }}>
                          Try adjusting your search keywords or resetting your active filters.
                        </p>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleClearFilters}
                          style={{ marginTop: 14 }}
                        >
                          <RotateCcw size={14} />
                          <span>Reset Filters</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => {
                    const insStyle = getInsuranceBadgeStyle(patient.insuranceStatus);
                    return (
                      <tr
                        key={patient.id}
                        style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                        onClick={() => onSelectPatient(patient.id)}
                      >
                        {/* Patient Name & ID */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img
                              src={patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                              alt={patient.fullName}
                              className="patient-avatar"
                            />
                            <div>
                              <div className="patient-name" style={{ color: '#0f172a', fontWeight: 700 }}>
                                {patient.fullName}
                              </div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: '0.71875rem',
                                  fontWeight: 700,
                                  color: '#2563eb',
                                  backgroundColor: '#eff6ff',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  border: '1px solid #dbeafe',
                                  marginTop: 2,
                                }}
                              >
                                {patient.patientId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Age & Gender */}
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{patient.age} yrs</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{patient.gender}</div>
                        </td>

                        {/* Date of Birth */}
                        <td>
                          <div style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500 }}>
                            {patient.dob || '—'}
                          </div>
                        </td>

                        {/* Contact */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', color: '#1e293b', fontWeight: 500 }}>
                            <Phone size={12} color="#2563eb" /> {patient.phone}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#64748b', marginTop: 2, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={patient.email}>
                            <Mail size={12} color="#94a3b8" /> {patient.email}
                          </div>
                        </td>

                        {/* Department & Consulting Doctor */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {patient.assignedDoctor?.avatar && (
                              <img
                                src={patient.assignedDoctor.avatar}
                                alt={patient.assignedDoctor.name}
                                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                              />
                            )}
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.84375rem' }}>
                              {patient.assignedDoctor?.name || 'Dr. Smith'}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 500, marginTop: 2 }}>
                            {patient.department?.name || 'General Medicine'}
                          </div>
                        </td>

                        {/* Last Appointment Date */}
                        <td>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: patient.lastAppointmentDate ? '#334155' : '#94a3b8' }}>
                            {patient.lastAppointmentDate || 'No past visit'}
                          </div>
                        </td>

                        {/* Next Appointment Date */}
                        <td>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: patient.nextAppointmentDate ? '#2563eb' : '#94a3b8' }}>
                            {patient.nextAppointmentDate || 'None scheduled'}
                          </div>
                        </td>

                        {/* Appointment Status */}
                        <td>
                          <span className={`status-badge ${getStatusClass(patient.appointmentStatus)}`}>
                            {patient.appointmentStatus}
                          </span>
                        </td>

                        {/* Insurance Provider & Status */}
                        <td>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1e293b' }}>
                            {patient.insuranceProvider}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              marginTop: 3,
                              backgroundColor: insStyle.bg,
                              color: insStyle.text,
                              border: `1px solid ${insStyle.border}`,
                            }}
                          >
                            {patient.insuranceStatus}
                          </span>
                        </td>

                        {/* Actions */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="action-btn"
                              title="View Patient Profile"
                              onClick={() => onSelectPatient(patient.id)}
                            >
                              <Eye size={15} color="#2563eb" />
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              title="Verify Insurance"
                              onClick={() => onNavigateToInsurance(patient.id)}
                            >
                              <ShieldCheck size={15} color="#059669" />
                            </button>
                            <button
                              type="button"
                              className="action-btn"
                              title="Book New Appointment"
                              onClick={() => onBookAppointment({
                                id: patient.id,
                                patientId: patient.patientId,
                                firstName: patient.firstName,
                                lastName: patient.lastName,
                                dob: patient.dob,
                                gender: patient.gender,
                                phone: patient.phone,
                                email: patient.email,
                                address: patient.address,
                                avatar: patient.avatar,
                                bloodGroup: patient.bloodGroup,
                                emergencyContact: patient.emergencyContact,
                              })}
                            >
                              <CalendarPlus size={15} color="#2563eb" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* 5. PATIENT LIST (CARD GRID VIEW - FIXED HEIGHT SCROLLABLE CONTAINER) */
          <div
            className="patients-cards-scroll-container"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
              padding: '20px 24px',
              backgroundColor: '#f8fafc',
            }}
          >
            {filteredPatients.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                <Users size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                  No patients found matching your criteria
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearFilters}
                  style={{ marginTop: 14 }}
                >
                  <RotateCcw size={14} />
                  <span>Reset Filters</span>
                </button>
              </div>
            ) : (
              filteredPatients.map((patient) => {
                const insStyle = getInsuranceBadgeStyle(patient.insuranceStatus);
                return (
                  <div
                    key={patient.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      padding: '16px 18px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                    onClick={() => onSelectPatient(patient.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                    }}
                  >
                    {/* Header with avatar, name, and ID */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img
                            src={patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                            alt={patient.fullName}
                            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #3b82f6' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>
                              {patient.fullName}
                            </div>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                color: '#2563eb',
                                backgroundColor: '#eff6ff',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: '1px solid #dbeafe',
                              }}
                            >
                              {patient.patientId}
                            </span>
                          </div>
                        </div>

                        <span className={`status-badge ${getStatusClass(patient.appointmentStatus)}`}>
                          {patient.appointmentStatus}
                        </span>
                      </div>

                      {/* Bio Details */}
                      <div style={{ fontSize: '0.78125rem', color: '#64748b', marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span><strong>Age:</strong> {patient.age} yrs</span>
                        <span>•</span>
                        <span><strong>Gender:</strong> {patient.gender}</span>
                        <span>•</span>
                        <span><strong>DOB:</strong> {patient.dob}</span>
                      </div>

                      {/* Contact Info */}
                      <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, marginBottom: 10, fontSize: '0.78125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', fontWeight: 500 }}>
                          <Phone size={13} color="#2563eb" /> {patient.phone}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', marginTop: 3 }}>
                          <Mail size={13} color="#94a3b8" /> {patient.email}
                        </div>
                      </div>

                      {/* Doctor & Department */}
                      <div style={{ padding: '8px 10px', background: '#eff6ff', borderRadius: 8, marginBottom: 10, fontSize: '0.78125rem' }}>
                        <div style={{ color: '#1e40af', fontWeight: 600 }}>
                          Doctor: {patient.assignedDoctor?.name || 'Dr. Smith'}
                        </div>
                        <div style={{ color: '#3b82f6', fontSize: '0.71875rem', marginTop: 2 }}>
                          Dept: {patient.department?.name || 'General Medicine'}
                        </div>
                      </div>

                      {/* Visits & Insurance */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.75rem', marginBottom: 12 }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Last Visit:</span>
                          <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 1 }}>
                            {patient.lastAppointmentDate || 'None'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Next Visit:</span>
                          <div style={{ fontWeight: 600, color: '#2563eb', marginTop: 1 }}>
                            {patient.nextAppointmentDate || 'None'}
                          </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#64748b' }}>Insurance: </span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{patient.insuranceProvider} </span>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: insStyle.bg,
                              color: insStyle.text,
                              border: `1px solid ${insStyle.border}`,
                            }}
                          >
                            {patient.insuranceStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div
                      style={{
                        paddingTop: 10,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectPatient(patient.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.78125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Eye size={14} />
                        <span>View Profile</span>
                      </button>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => onNavigateToInsurance(patient.id)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Verify Insurance"
                        >
                          <ShieldCheck size={13} color="#059669" />
                          <span>Insurance</span>
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => onRegisterPatient({
                            id: patient.id,
                            patientId: patient.patientId,
                            firstName: patient.firstName,
                            lastName: patient.lastName,
                            dob: patient.dob,
                            gender: patient.gender,
                            phone: patient.phone,
                            email: patient.email,
                            address: patient.address,
                            avatar: patient.avatar,
                            bloodGroup: patient.bloodGroup,
                            emergencyContact: patient.emergencyContact,
                          })}
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          title="Register / Intake"
                        >
                          <FileCheck2 size={13} />
                          <span>Intake</span>
                        </button>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => onBookAppointment({
                            id: patient.id,
                            patientId: patient.patientId,
                            firstName: patient.firstName,
                            lastName: patient.lastName,
                            dob: patient.dob,
                            gender: patient.gender,
                            phone: patient.phone,
                            email: patient.email,
                            address: patient.address,
                            avatar: patient.avatar,
                            bloodGroup: patient.bloodGroup,
                            emergencyContact: patient.emergencyContact,
                          })}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          title="New Appointment"
                        >
                          <CalendarPlus size={13} />
                          <span>Book</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 6. CONTINUOUS PATIENTS LIST FOOTER */}
        {filteredPatients.length > 0 && (
          <div className="table-continuous-footer">
            <div className="continuous-footer-content">
              <span className="continuous-status-indicator"></span>
              <span className="continuous-footer-text">
                Showing all <strong>{filteredPatients.length}</strong> matching {filteredPatients.length === 1 ? 'patient' : 'patients'} • All patients loaded
              </span>
            </div>
          </div>
        )}

      </div>

      {/* 7. BOTTOM SECTION: AGING SUMMARY (A/R) */}
      <div className="aging-summary-section">
        <div className="aging-summary-card">
          <div className="aging-summary-header-box">
            <div className="aging-summary-icon-box">
              <Clock size={18} />
            </div>
            <div>
              <h3 className="aging-summary-title">Aging Summary</h3>
              <p className="aging-summary-subtitle">Accounts Receivable (A/R) aging on unpaid balances</p>
            </div>
          </div>

          <div className="aging-summary-grid">
            {/* 1. Current (0–30) */}
            <div className="aging-column">
              <span className="aging-col-label">Current (0–30)</span>
              <span className="aging-col-amount standard">${formatCurrency(financialTotals.aging.current)}</span>
            </div>

            {/* 2. 31–60 Days */}
            <div className="aging-column">
              <span className="aging-col-label">31–60 Days</span>
              <span className="aging-col-amount standard">${formatCurrency(financialTotals.aging.days31_60)}</span>
            </div>

            {/* 3. 61–90 Days */}
            <div className="aging-column">
              <span className="aging-col-label">61–90 Days</span>
              <span className="aging-col-amount warning-amber">${formatCurrency(financialTotals.aging.days61_90)}</span>
            </div>

            {/* 4. 91–120 Days */}
            <div className="aging-column">
              <span className="aging-col-label">91–120 Days</span>
              <span className="aging-col-amount warning-orange">${formatCurrency(financialTotals.aging.days91_120)}</span>
            </div>

            {/* 5. >120 Days */}
            <div className="aging-column">
              <span className="aging-col-label">&gt;120 Days</span>
              <span className="aging-col-amount warning-red">${formatCurrency(financialTotals.aging.over120)}</span>
            </div>

            {/* 6. Total */}
            <div className="aging-column">
              <span className="aging-col-label">Total</span>
              <span className="aging-col-amount total-amount">${formatCurrency(financialTotals.aging.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PatientsPage;
