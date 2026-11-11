import React from 'react';
import { StatCards } from '../components/StatCards';
import { AppointmentTable } from '../components/AppointmentTable';
import type { Appointment, Doctor, Department, AppointmentStatus, DashboardStats } from '../types';

interface DashboardPageProps {
  stats: DashboardStats;
  appointments: Appointment[];
  totalAppointments: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  doctors: Doctor[];
  departments: Department[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedDoctor: string;
  onDoctorChange: (id: string) => void;
  selectedDepartment: string;
  onDepartmentChange: (id: string) => void;
  selectedStatus: AppointmentStatus | 'All';
  onStatusChange: (s: AppointmentStatus | 'All') => void;
  selectedDate: string;
  onDateChange: (d: string) => void;
  onClearFilters: () => void;
  onViewDetails: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onChangeStatus: (appointmentId: string, newStatus: AppointmentStatus) => void;
  onNewAppointmentClick: () => void;
  onPatientClick?: (patientId: string) => void;
  onOpenCalendar?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  appointments,
  totalAppointments,
  currentPage,
  totalPages,
  onPageChange,
  doctors,
  departments,
  searchQuery,
  onSearchChange,
  selectedDoctor,
  onDoctorChange,
  selectedDepartment,
  onDepartmentChange,
  selectedStatus,
  onStatusChange,
  selectedDate,
  onDateChange,
  onClearFilters,
  onViewDetails,
  onReschedule,
  onChangeStatus,
  onNewAppointmentClick,
  onPatientClick,
  onOpenCalendar,
}) => {
  return (
    <div className="page-body animate-fade-in dashboard-page-body">
      {/* 5 KPI Stat Cards */}
      <StatCards
        stats={stats}
        activeStatusFilter={selectedStatus}
        onSelectFilter={(status) => {
          onStatusChange(status);
        }}
      />

      {/* Main Appointment Table with Filters & Pagination */}
      <AppointmentTable
        appointments={appointments}
        totalAppointments={totalAppointments}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        doctors={doctors}
        departments={departments}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedDoctor={selectedDoctor}
        onDoctorChange={onDoctorChange}
        selectedDepartment={selectedDepartment}
        onDepartmentChange={onDepartmentChange}
        selectedStatus={selectedStatus}
        onStatusChange={onStatusChange}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        onClearFilters={onClearFilters}
        onViewDetails={onViewDetails}
        onReschedule={onReschedule}
        onChangeStatus={onChangeStatus}
        onNewAppointmentClick={onNewAppointmentClick}
        onPatientClick={onPatientClick}
        onOpenCalendar={onOpenCalendar}
      />
    </div>
  );
};
