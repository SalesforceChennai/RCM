import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  RotateCcw,
  Clock,
  X,
  CalendarCheck,
  CalendarClock,
  XCircle,
  Eye,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { Appointment, AppointmentStatus, Doctor, Department } from '../types';
import { appointmentService } from '../services/appointmentService';
import './CalendarPage.css';

interface CalendarPageProps {
  doctors: Doctor[];
  departments: Department[];
  onViewDetails: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onChangeStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onNewAppointmentClick: (selectedDate?: string) => void;
  onPatientClick?: (patient: any) => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
  refreshTrigger?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = [
  { label: 'Mon', full: 'Monday' },
  { label: 'Tue', full: 'Tuesday' },
  { label: 'Wed', full: 'Wednesday' },
  { label: 'Thu', full: 'Thursday' },
  { label: 'Fri', full: 'Friday' },
  { label: 'Sat', full: 'Saturday', isWeekend: true },
  { label: 'Sun', full: 'Sunday', isWeekend: true },
];

export const CalendarPage: React.FC<CalendarPageProps> = ({
  doctors,
  departments,
  onViewDetails,
  onReschedule,
  onChangeStatus,
  onNewAppointmentClick,
  onPatientClick,
  onSuccessToast,
  onErrorToast,
  refreshTrigger = 0,
}) => {
  // Current calendar month view (default to current date)
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth()); // 0-indexed

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Appointments data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Side Drawer state for selected date
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(todayStr);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Fetch appointments for the selected month
  const monthStr = useMemo(() => {
    const m = String(currentMonth + 1).padStart(2, '0');
    return `${currentYear}-${m}`;
  }, [currentYear, currentMonth]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Calculate 6-week window covering this month's grid to fetch all visible dates
      const firstOfMonth = new Date(currentYear, currentMonth, 1);
      const startDayOfWeek = (firstOfMonth.getDay() + 6) % 7;
      const startDateObj = new Date(currentYear, currentMonth, 1 - startDayOfWeek);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + 41); // 42 days (6 weeks)

      const startY = startDateObj.getFullYear();
      const startM = String(startDateObj.getMonth() + 1).padStart(2, '0');
      const startD = String(startDateObj.getDate()).padStart(2, '0');
      const startDateStr = `${startY}-${startM}-${startD}`;

      const endY = endDateObj.getFullYear();
      const endM = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const endD = String(endDateObj.getDate()).padStart(2, '0');
      const endDateStr = `${endY}-${endM}-${endD}`;

      const res = await fetch(`/api/appointments?startDate=${startDateStr}&endDate=${endDateStr}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch appointments: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAppointments(json.data);
      } else {
        setAppointments([]);
      }
    } catch (err: any) {
      console.error('[CalendarPage] Error fetching appointments:', err);
      setError(err?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments, refreshTrigger]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDateStr(todayStr);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDoctor('all');
    setSelectedDepartment('all');
    setSelectedStatus('All');
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedDoctor !== 'all' ||
    selectedDepartment !== 'all' ||
    selectedStatus !== 'All'
  );

  // Filtered appointments
  const filteredAppointments = useMemo(() => {
    let list = appointments;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) =>
        a.appointmentCode.toLowerCase().includes(q) ||
        a.patient.name.toLowerCase().includes(q) ||
        (a.patient.patientCode && a.patient.patientCode.toLowerCase().includes(q)) ||
        a.doctor.name.toLowerCase().includes(q)
      );
    }

    if (selectedDoctor !== 'all') {
      list = list.filter((a) => a.doctorId === selectedDoctor);
    }

    if (selectedDepartment !== 'all') {
      list = list.filter((a) =>
        a.departmentId === selectedDepartment ||
        a.departmentName.toLowerCase() === selectedDepartment.toLowerCase()
      );
    }

    if (selectedStatus !== 'All') {
      list = list.filter((a) => a.status.toLowerCase() === selectedStatus.toLowerCase());
    }

    return list;
  }, [appointments, searchQuery, selectedDoctor, selectedDepartment, selectedStatus]);

  // Appointments grouped by date string
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of filteredAppointments) {
      const d = apt.appointmentDate;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(apt);
    }
    return map;
  }, [filteredAppointments]);

  // Stats for the current month
  const monthStats = useMemo(() => {
    // Count appointments strictly belonging to the currently selected month
    const thisMonthApts = appointments.filter((a) => a.appointmentDate.startsWith(monthStr));
    const total = thisMonthApts.length;
    const confirmed = thisMonthApts.filter((a) => a.status === 'Confirmed').length;
    const scheduled = thisMonthApts.filter((a) => a.status === 'Scheduled').length;
    const completed = thisMonthApts.filter((a) => a.status === 'Completed').length;
    const cancelled = thisMonthApts.filter((a) => a.status === 'Cancelled').length;
    const noshow = thisMonthApts.filter((a) => a.status === 'No-show').length;

    return { total, confirmed, scheduled, completed, cancelled, noshow };
  }, [appointments, monthStr]);

  // Calendar 7-column grid generation (Monday to Sunday)
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    // Monday is index 0: (getDay() + 6) % 7
    const startDayOfWeek = (firstOfMonth.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
    }[] = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const mStr = String(prevMonthIdx + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateStr = `${prevYear}-${mStr}-${dStr}`;

      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${currentYear}-${mStr}-${dStr}`;

      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr
      });
    }

    // Trailing days from next month to complete 5 or 6 rows (multiples of 7)
    const totalFilled = cells.length;
    const totalCellsNeeded = totalFilled <= 35 ? 35 : 42;
    const trailingCount = totalCellsNeeded - totalFilled;

    for (let day = 1; day <= trailingCount; day++) {
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const mStr = String(nextMonthIdx + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${nextYear}-${mStr}-${dStr}`;

      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr
      });
    }

    return cells;
  }, [currentYear, currentMonth, todayStr]);

  // Selected date appointments
  const selectedDateAppointments = useMemo(() => {
    if (!selectedDateStr) return [];
    return appointmentsByDate.get(selectedDateStr) || [];
  }, [selectedDateStr, appointmentsByDate]);

  const handleCellClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setIsDrawerOpen(true);
  };

  const handleCancelAppointment = async (apt: Appointment) => {
    if (apt.status === 'Completed') {
      onErrorToast?.('Completed appointments cannot be cancelled.');
      return;
    }
    if (apt.status === 'Cancelled') {
      onErrorToast?.('This appointment is already cancelled.');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to cancel appointment ${apt.appointmentCode} for ${apt.patient.name}?`);
    if (!confirmed) return;

    try {
      await appointmentService.updateStatus(apt.id, 'Cancelled');
      onChangeStatus(apt.id, 'Cancelled');
      onSuccessToast?.(`Appointment ${apt.appointmentCode} has been cancelled.`);
      loadAppointments();
    } catch (err: any) {
      onErrorToast?.(err?.message || 'Failed to cancel appointment.');
    }
  };

  const rowCount = Math.ceil(calendarCells.length / 7) || 5;

  return (
    <div className="calendar-page-container">
      {/* 1. Compact Header Bar: Title, Navigation & Stats */}
      <div className="calendar-topbar">
        <div className="calendar-topbar-left">
          <div className="calendar-icon-badge">
            <CalendarDays size={18} />
          </div>
          <div className="calendar-title-text">
            <h1 className="calendar-title">Calendar</h1>
          </div>

          {/* Month Navigation */}
          <div className="calendar-nav-controls">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handlePrevMonth}
              title="Previous Month"
              aria-label="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="calendar-current-month-display">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </div>

            <button
              type="button"
              className="calendar-nav-btn"
              onClick={handleNextMonth}
              title="Next Month"
              aria-label="Next Month"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="calendar-today-btn"
              onClick={handleToday}
            >
              <Clock size={13} />
              <span>Today</span>
            </button>
          </div>
        </div>

        {/* Compact Stats Summary */}
        <div className="calendar-stats-bar">
          <div className="calendar-stat-pill" title="Total appointments this month">
            <span>Total:</span>
            <span className="stat-count">{monthStats.total}</span>
          </div>
          <div className="calendar-stat-pill confirmed" title="Confirmed appointments">
            <div className="stat-dot" />
            <span>Confirmed:</span>
            <span className="stat-count">{monthStats.confirmed}</span>
          </div>
          <div className="calendar-stat-pill scheduled" title="Scheduled appointments">
            <div className="stat-dot" />
            <span>Scheduled:</span>
            <span className="stat-count">{monthStats.scheduled}</span>
          </div>
          <div className="calendar-stat-pill completed" title="Completed appointments">
            <div className="stat-dot" />
            <span>Completed:</span>
            <span className="stat-count">{monthStats.completed}</span>
          </div>
          <div className="calendar-stat-pill cancelled" title="Cancelled appointments">
            <div className="stat-dot" />
            <span>Cancelled:</span>
            <span className="stat-count">{monthStats.cancelled}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="calendar-actions-group">
          <button
            type="button"
            className="btn-primary calendar-new-btn"
            onClick={() => onNewAppointmentClick(selectedDateStr || todayStr)}
          >
            <Plus size={15} />
            <span>New Appointment</span>
          </button>
        </div>
      </div>

      {/* 2. Slim Filter Toolbar */}
      <div className="calendar-filter-toolbar">
        <div className="calendar-search-box">
          <Search size={14} className="calendar-search-icon" />
          <input
            type="text"
            className="calendar-search-input"
            placeholder="Search patient, ID, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="calendar-select"
          value={selectedDoctor}
          onChange={(e) => setSelectedDoctor(e.target.value)}
          aria-label="Filter by doctor"
        >
          <option value="all">All Doctors</option>
          {doctors.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>

        <select
          className="calendar-select"
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>

        <select
          className="calendar-select"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="All">All Statuses</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="No-show">No-show</option>
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            className="calendar-clear-btn"
            onClick={handleClearFilters}
            title="Reset all filters"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 3. Screen-Fitted 7-Column Calendar Grid */}
      <div className="calendar-grid-card">
        {/* Weekday headers: Mon - Sun */}
        <div className="calendar-weekdays-row">
          {WEEKDAY_NAMES.map((wd) => (
            <div
              key={wd.label}
              className={`calendar-weekday-cell ${wd.isWeekend ? 'weekend' : ''}`}
            >
              <span>{wd.label}</span>
            </div>
          ))}
        </div>

        {/* Days grid */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 200, gap: 10 }}>
            <Loader2 size={28} className="animate-spin text-primary" style={{ color: '#2563eb' }} />
            <p style={{ color: '#64748b', fontSize: '0.8125rem' }}>Loading monthly calendar from PostgreSQL...</p>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 200, gap: 10 }}>
            <AlertCircle size={28} color="#e11d48" />
            <p style={{ color: '#e11d48', fontWeight: 600, fontSize: '0.8125rem' }}>{error}</p>
            <button type="button" className="btn-secondary" onClick={loadAppointments}>
              Retry
            </button>
          </div>
        ) : (
          <div
            className="calendar-days-grid"
            style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
          >
            {calendarCells.map((cell) => {
              const dayApts = appointmentsByDate.get(cell.dateStr) || [];
              const isSelected = selectedDateStr === cell.dateStr;

              return (
                <div
                  key={cell.dateStr}
                  className={`calendar-day-cell ${
                    !cell.isCurrentMonth ? 'other-month' : ''
                  } ${cell.isToday ? 'today' : ''} ${
                    cell.isPast ? 'past-day' : ''
                  } ${isSelected ? 'selected-day' : ''}`}
                  onClick={() => handleCellClick(cell.dateStr)}
                >
                  {/* Day Cell Header */}
                  <div className="calendar-day-header">
                    <div className="calendar-day-number">
                      {cell.dayNumber}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {cell.isToday && (
                        <span className="calendar-today-badge">Today</span>
                      )}

                      {dayApts.length > 0 && (
                        <span className="calendar-day-count-badge">
                          {dayApts.length}
                        </span>
                      )}

                      <button
                        type="button"
                        className="calendar-quick-add-btn"
                        title={`Schedule appointment for ${cell.dateStr}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewAppointmentClick(cell.dateStr);
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Day Cell Appointments List (max 2 visible chips) */}
                  <div className="calendar-day-appointments">
                    {dayApts.slice(0, 2).map((apt) => {
                      const statusClass = `status-${apt.status.toLowerCase().replace(/[^a-z]/g, '')}`;
                      return (
                        <div
                          key={apt.id}
                          className={`calendar-appointment-chip ${statusClass}`}
                          title={`${apt.appointmentTime} - ${apt.patient.name} (${apt.doctor.name}) [${apt.status}]`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(apt);
                          }}
                        >
                          <span className="chip-time">{apt.appointmentTime}</span>
                          <span className="chip-patient">{apt.patient.name}</span>
                        </div>
                      );
                    })}

                    {dayApts.length > 2 && (
                      <div
                        className="calendar-more-badge"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellClick(cell.dateStr);
                        }}
                      >
                        +{dayApts.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Date Details Side Drawer */}
      {isDrawerOpen && selectedDateStr && (
        <div
          className="calendar-drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="calendar-drawer-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="drawer-header">
              <div className="drawer-title-area">
                <h3 className="drawer-date-heading">
                  {new Date(`${selectedDateStr}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <span className="drawer-date-subheading">
                  {selectedDateAppointments.length} appointment
                  {selectedDateAppointments.length === 1 ? '' : 's'} scheduled
                </span>
              </div>

              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body">
              {selectedDateAppointments.length === 0 ? (
                <div className="drawer-empty-state">
                  <div className="drawer-empty-icon">
                    <CalendarCheck size={32} />
                  </div>
                  <h4 className="drawer-empty-title">
                    No appointments scheduled for this date.
                  </h4>
                  <p className="drawer-empty-text">
                    This day currently has open availability. You can schedule a new patient consultation or checkup.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setIsDrawerOpen(false);
                      onNewAppointmentClick(selectedDateStr);
                    }}
                  >
                    <Plus size={16} />
                    <span>Schedule for this date</span>
                  </button>
                </div>
              ) : (
                selectedDateAppointments.map((apt) => {
                  const isCompleted = apt.status === 'Completed';
                  const isCancelled = apt.status === 'Cancelled';

                  return (
                    <div key={apt.id} className="drawer-appointment-card">
                      {/* Top Bar */}
                      <div className="drawer-card-top">
                        <span className="drawer-card-code">
                          {apt.appointmentCode}
                        </span>
                        <span className={`status-badge ${apt.status.toLowerCase()}`}>
                          {apt.status}
                        </span>
                      </div>

                      {/* Patient info */}
                      <div className="drawer-card-patient">
                        <img
                          src={apt.patient.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'}
                          alt={apt.patient.name}
                          className="drawer-patient-avatar"
                        />
                        <div>
                          <div
                            className="drawer-patient-name"
                            style={{ cursor: onPatientClick ? 'pointer' : 'default' }}
                            onClick={() => onPatientClick && onPatientClick(apt.patient)}
                          >
                            {apt.patient.name}
                          </div>
                          <div className="drawer-patient-meta">
                            <span>MRN: {apt.patient.patientCode || 'N/A'}</span>
                            {apt.patient.phone && (
                              <span>• {apt.patient.phone}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="drawer-card-grid">
                        <div className="drawer-grid-item">
                          <span className="drawer-item-label">Doctor</span>
                          <span className="drawer-item-value">{apt.doctor.name}</span>
                        </div>
                        <div className="drawer-grid-item">
                          <span className="drawer-item-label">Department</span>
                          <span className="drawer-item-value">{apt.departmentName || 'General'}</span>
                        </div>
                        <div className="drawer-grid-item">
                          <span className="drawer-item-label">Time & Duration</span>
                          <span className="drawer-item-value">
                            {apt.appointmentTime} ({apt.durationMinutes} min)
                          </span>
                        </div>
                        <div className="drawer-grid-item">
                          <span className="drawer-item-label">Type</span>
                          <span className="drawer-item-value">{apt.appointmentType}</span>
                        </div>
                      </div>

                      {/* Reason */}
                      {apt.reasonForVisit && (
                        <div className="drawer-card-reason">
                          <strong>Reason:</strong> {apt.reasonForVisit}
                        </div>
                      )}

                      {/* Card Actions */}
                      <div className="drawer-card-actions">
                        <button
                          type="button"
                          className="drawer-action-btn primary"
                          onClick={() => {
                            setIsDrawerOpen(false);
                            onViewDetails(apt);
                          }}
                        >
                          <Eye size={14} />
                          <span>View Details</span>
                        </button>

                        <button
                          type="button"
                          className="drawer-action-btn"
                          disabled={isCompleted || isCancelled}
                          style={{
                            opacity: isCompleted || isCancelled ? 0.5 : 1,
                            cursor: isCompleted || isCancelled ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => {
                            if (isCompleted || isCancelled) return;
                            setIsDrawerOpen(false);
                            onReschedule(apt);
                          }}
                        >
                          <CalendarClock size={14} />
                          <span>Reschedule</span>
                        </button>

                        {!isCancelled && !isCompleted && (
                          <button
                            type="button"
                            className="drawer-action-btn danger"
                            onClick={() => handleCancelAppointment(apt)}
                          >
                            <XCircle size={14} />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="drawer-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsDrawerOpen(false)}
              >
                Close
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onNewAppointmentClick(selectedDateStr);
                }}
              >
                <Plus size={16} />
                <span>Add Appointment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
