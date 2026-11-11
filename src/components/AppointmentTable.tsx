import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Eye,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Heart,
  Bone,
  Sparkles,
  Brain,
  Baby,
  Stethoscope,
  CheckCircle2,
  XCircle,
  CalendarClock,
  UserX,
  X
} from 'lucide-react';
import type { Appointment, Doctor, Department, AppointmentStatus } from '../types';

interface AppointmentTableProps {
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

export const AppointmentTable: React.FC<AppointmentTableProps> = ({
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
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const getDepartmentIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'heart':
        return <Heart size={16} color={color || '#ef4444'} />;
      case 'bone':
        return <Bone size={16} color={color || '#06b6d4'} />;
      case 'sparkles':
        return <Sparkles size={16} color={color || '#ec4899'} />;
      case 'brain':
        return <Brain size={16} color={color || '#8b5cf6'} />;
      case 'baby':
        return <Baby size={16} color={color || '#f59e0b'} />;
      case 'stethoscope':
      default:
        return <Stethoscope size={16} color={color || '#10b981'} />;
    }
  };

  const getStatusClass = (status: AppointmentStatus) => {
    switch (status) {
      case 'Confirmed':
        return 'confirmed';
      case 'Scheduled':
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

  const startCount = (currentPage - 1) * 6 + (appointments.length > 0 ? 1 : 0);
  const endCount = (currentPage - 1) * 6 + appointments.length;

  return (
    <div className="dashboard-main-card appointment-card-container">
      {/* Card Header */}
      <div className="dashboard-card-header">
        <div className="card-header-left">
          <div className="card-header-icon-box">
            <Calendar size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="card-header-title">Today's Appointments</h2>
            <p className="card-header-sub">Schedule and manage today's patient appointments.</p>
          </div>
        </div>

        <div className="card-header-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onNewAppointmentClick}
          >
            <span>+ New Appointment</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            title="Open Calendar View"
            onClick={() => {
              if (onOpenCalendar) {
                onOpenCalendar();
              } else {
                onDateChange(selectedDate);
              }
            }}
          >
            <Calendar size={17} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filter-bar">
        {/* Search */}
        <div className="filter-search-box">
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search patient name, ID or phone..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Doctor Filter */}
        <select
          className="filter-select"
          value={selectedDoctor}
          onChange={(e) => onDoctorChange(e.target.value)}
        >
          <option value="all">All Doctors</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>

        {/* Department Filter */}
        <select
          className="filter-select"
          value={selectedDepartment}
          onChange={(e) => onDepartmentChange(e.target.value)}
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="filter-select"
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as AppointmentStatus | 'All')}
        >
          <option value="All">All Status</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="No-show">No-show</option>
        </select>

        {/* Date Selector */}
        <input
          type="date"
          className="filter-date-input"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
        />

        {/* Reset / Clear */}
        {(searchQuery || selectedDoctor !== 'all' || selectedDepartment !== 'all' || selectedStatus !== 'All' || (selectedDate && selectedDate !== new Date().toISOString().split('T')[0])) && (
          <button
            type="button"
            className="filter-clear-btn"
            onClick={onClearFilters}
            title="Reset Filters"
          >
            <X size={15} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container appointment-table-container">
        <table className="appointments-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Appointment ID</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Department</th>
              <th>Type</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Calendar size={36} color="#94a3b8" />
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>No appointments found</div>
                    <div style={{ fontSize: '0.875rem' }}>Try adjusting your filters or schedule a new appointment.</div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ marginTop: 8 }}
                      onClick={onNewAppointmentClick}
                    >
                      + Schedule New Appointment
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              appointments.map((apt) => {
                const dept = departments.find((d) => d.id === apt.departmentId);
                const isMenuOpen = activeDropdownId === apt.id;

                return (
                  <tr key={apt.id}>
                    {/* Time */}
                    <td className="time-cell">{apt.appointmentTime}</td>

                    {/* Code */}
                    <td>
                      <span
                        className="apt-code-link"
                        onClick={() => onViewDetails(apt)}
                      >
                        {apt.appointmentCode}
                      </span>
                    </td>

                    {/* Patient */}
                    <td>
                      <div
                        className="patient-cell patient-cell-clickable"
                        onClick={() => onPatientClick && onPatientClick(apt.patientId || apt.patient.id)}
                        title={`Click to view details for ${apt.patient.name}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <img
                          src={apt.patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                          alt={apt.patient.name}
                          className="patient-avatar"
                        />
                        <div>
                          <div className="patient-name-text patient-name-link">{apt.patient.name}</div>
                          <div className="patient-phone-text">{apt.patient.phone}</div>
                        </div>
                      </div>
                    </td>

                    {/* Doctor */}
                    <td>
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{apt.doctor.name}</span>
                    </td>

                    {/* Department */}
                    <td>
                      <div className="department-cell">
                        <span className="dept-icon-badge">
                          {getDepartmentIcon(dept?.icon || 'heart', dept?.color || '#ef4444')}
                        </span>
                        <span>{apt.departmentName}</span>
                      </div>
                    </td>

                    {/* Type */}
                    <td>
                      <span style={{ color: '#334155', fontWeight: 500 }}>{apt.appointmentType}</span>
                    </td>

                    {/* Status Badge */}
                    <td>
                      <span className={`status-badge ${getStatusClass(apt.status)}`}>
                        {apt.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td>
                      <div className="action-buttons-group" style={{ justifyContent: 'center' }}>
                        {/* View Eye Button */}
                        <button
                          type="button"
                          className="action-icon-btn"
                          title="View Details"
                          onClick={() => onViewDetails(apt)}
                        >
                          <Eye size={16} />
                        </button>

                        {/* 3-dots Menu Button */}
                        <button
                          type="button"
                          className="action-icon-btn"
                          title="More Options"
                          onClick={() => setActiveDropdownId(isMenuOpen ? null : apt.id)}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div className="action-dropdown-menu">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onViewDetails(apt);
                              }}
                            >
                              <Eye size={14} />
                              <span>View Details</span>
                            </button>

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onReschedule(apt);
                              }}
                            >
                              <CalendarClock size={14} />
                              <span>Reschedule</span>
                            </button>

                            <div className="dropdown-divider" />

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onChangeStatus(apt.id, 'Confirmed');
                              }}
                            >
                              <CheckCircle2 size={14} color="#16a34a" />
                              <span>Mark Confirmed</span>
                            </button>

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onChangeStatus(apt.id, 'Completed');
                              }}
                            >
                              <CheckCircle2 size={14} color="#9333ea" />
                              <span>Mark Completed</span>
                            </button>

                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onChangeStatus(apt.id, 'No-show');
                              }}
                            >
                              <UserX size={14} color="#d97706" />
                              <span>Mark No-show</span>
                            </button>

                            <div className="dropdown-divider" />

                            <button
                              type="button"
                              className="dropdown-item danger"
                              onClick={() => {
                                setActiveDropdownId(null);
                                onChangeStatus(apt.id, 'Cancelled');
                              }}
                            >
                              <XCircle size={14} />
                              <span>Cancel Appointment</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer & Pagination */}
      <div className="table-footer">
        <div className="table-info-text">
          Showing {appointments.length > 0 ? startCount : 0} to {endCount} of {totalAppointments} appointments
        </div>

        <div className="pagination-group">
          <button
            type="button"
            className="page-nav-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={`page-nav-btn ${currentPage === pageNum ? 'active' : ''}`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            className="page-nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
