import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  RotateCcw,
  Building2,
  Clock,
  MapPin,
  Briefcase,
  Grid,
  List,
  Edit3,
  Trash2,
  X,
  CalendarCheck,
  Loader2,
  CheckCircle2,
  Award,
  Eye
} from 'lucide-react';
import type { Doctor, Department } from '../types';
import { doctorService } from '../services/doctorService';
import { departmentService } from '../services/departmentService';
import './DoctorsPage.css';

interface DoctorsPageProps {
  onNavigateToDashboard?: () => void;
  onScheduleWithDoctor?: (doctor: Doctor) => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1594824813583-0985223696fb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=150&auto=format&fit=crop&q=80',
];

export const DoctorsPage: React.FC<DoctorsPageProps> = ({
  onNavigateToDashboard: _onNavigateToDashboard,
  onScheduleWithDoctor,
  onSuccessToast,
  onErrorToast,
}) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [experienceFilter, setExperienceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedDoctorForEdit, setSelectedDoctorForEdit] = useState<Doctor | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [selectedDoctorForDetails, setSelectedDoctorForDetails] = useState<Doctor | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formDeptId, setFormDeptId] = useState<string>('');
  const [formSpecialization, setFormSpecialization] = useState<string>('');
  const [formExperience, setFormExperience] = useState<string>('10 Years');
  const [formRoomNumber, setFormRoomNumber] = useState<string>('Suite 101');
  const [formStartTime, setFormStartTime] = useState<string>('09:00 AM');
  const [formEndTime, setFormEndTime] = useState<string>('05:00 PM');
  const [formAvatar, setFormAvatar] = useState<string>(DEFAULT_AVATARS[0]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load doctors and departments from PostgreSQL API
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [fetchedDocs, fetchedDepts] = await Promise.all([
        doctorService.getAll(),
        departmentService.getAll(),
      ]);
      setDoctors(fetchedDocs);
      setDepartments(fetchedDepts);
    } catch (err: any) {
      console.error('Failed to load doctors data:', err);
      onErrorToast?.(err?.message || 'Failed to load doctors from database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onErrorToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Department map for easy lookup of colors and names
  const departmentMap = useMemo(() => {
    const map = new Map<string, Department>();
    departments.forEach((d) => {
      map.set(d.id, d);
      map.set(d.name.toLowerCase(), d);
    });
    return map;
  }, [departments]);

  // Compute Metrics
  const totalDoctorsCount = doctors.length;
  const uniqueDepartmentsCount = useMemo(() => {
    const s = new Set<string>();
    doctors.forEach((d) => {
      if (d.departmentName) s.add(d.departmentName);
      else if (d.departmentId) s.add(d.departmentId);
    });
    return s.size;
  }, [doctors]);

  const seniorDoctorsCount = useMemo(() => {
    return doctors.filter((d) => {
      const expNum = parseInt(d.experience || '0', 10);
      return !isNaN(expNum) && expNum >= 15;
    }).length;
  }, [doctors]);

  // Filtered & Sorted Doctors
  const filteredDoctors = useMemo(() => {
    let result = [...doctors];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (doc) =>
          doc.name.toLowerCase().includes(q) ||
          (doc.specialization && doc.specialization.toLowerCase().includes(q)) ||
          (doc.departmentName && doc.departmentName.toLowerCase().includes(q)) ||
          (doc.roomNumber && doc.roomNumber.toLowerCase().includes(q))
      );
    }

    // Department filter
    if (selectedDeptId !== 'all') {
      result = result.filter(
        (doc) =>
          doc.departmentId === selectedDeptId ||
          doc.departmentName.toLowerCase() === selectedDeptId.toLowerCase()
      );
    }

    // Experience filter
    if (experienceFilter !== 'all') {
      result = result.filter((doc) => {
        const expNum = parseInt(doc.experience || '0', 10);
        if (isNaN(expNum)) return true;
        if (experienceFilter === 'junior') return expNum < 10;
        if (experienceFilter === 'mid') return expNum >= 10 && expNum <= 15;
        if (experienceFilter === 'senior') return expNum > 15;
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'exp-desc') {
        const expA = parseInt(a.experience || '0', 10) || 0;
        const expB = parseInt(b.experience || '0', 10) || 0;
        return expB - expA;
      }
      if (sortBy === 'department') {
        return (a.departmentName || '').localeCompare(b.departmentName || '');
      }
      return 0;
    });

    return result;
  }, [doctors, searchQuery, selectedDeptId, experienceFilter, sortBy]);

  // Reset Add Form
  const resetForm = () => {
    setFormName('');
    setFormDeptId(departments[0]?.id || '');
    setFormSpecialization('');
    setFormExperience('10 Years');
    setFormRoomNumber('Suite 101');
    setFormStartTime('09:00 AM');
    setFormEndTime('05:00 PM');
    setFormAvatar(DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)]);
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (doctor: Doctor) => {
    setSelectedDoctorForEdit(doctor);
    setFormName(doctor.name);
    setFormDeptId(doctor.departmentId || departments[0]?.id || '');
    setFormSpecialization(doctor.specialization || '');
    setFormExperience(doctor.experience || '10 Years');
    setFormRoomNumber(doctor.roomNumber || '');
    setFormStartTime(doctor.workingHours?.start || '09:00 AM');
    setFormEndTime(doctor.workingHours?.end || '05:00 PM');
    setFormAvatar(doctor.avatar || DEFAULT_AVATARS[0]);
    setIsEditModalOpen(true);
  };

  // Open Details Modal
  const handleOpenDetailsModal = (doctor: Doctor) => {
    setSelectedDoctorForDetails(doctor);
    setIsDetailsModalOpen(true);
  };

  // Submit Add Doctor to SQL Database
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSpecialization.trim()) {
      onErrorToast?.('Please fill out the doctor name and specialization.');
      return;
    }

    const deptObj = departments.find((d) => d.id === formDeptId) || departments[0];

    setSubmitting(true);
    try {
      const newDoctor = await doctorService.create({
        name: formName.trim(),
        departmentId: deptObj?.id || '',
        departmentName: deptObj?.name || '',
        specialization: formSpecialization.trim(),
        experience: formExperience.trim(),
        roomNumber: formRoomNumber.trim(),
        avatar: formAvatar,
        workingHours: {
          start: formStartTime,
          end: formEndTime,
        },
      });

      onSuccessToast?.(`Doctor "${newDoctor.name}" saved to PostgreSQL SQL database!`);
      setIsAddModalOpen(false);
      resetForm();
      await loadData(true);
    } catch (err: any) {
      console.error('Error creating doctor:', err);
      onErrorToast?.(err?.message || 'Failed to create doctor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Doctor to SQL Database
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorForEdit || !formName.trim()) return;

    const deptObj = departments.find((d) => d.id === formDeptId);

    setSubmitting(true);
    try {
      await doctorService.update(selectedDoctorForEdit.id, {
        name: formName.trim(),
        departmentId: deptObj?.id || selectedDoctorForEdit.departmentId,
        departmentName: deptObj?.name || selectedDoctorForEdit.departmentName,
        specialization: formSpecialization.trim(),
        experience: formExperience.trim(),
        roomNumber: formRoomNumber.trim(),
        avatar: formAvatar,
        workingHours: {
          start: formStartTime,
          end: formEndTime,
        },
      });

      onSuccessToast?.(`Doctor "${formName}" profile updated successfully in SQL database!`);
      setIsEditModalOpen(false);
      setSelectedDoctorForEdit(null);
      resetForm();
      await loadData(true);
    } catch (err: any) {
      console.error('Error updating doctor:', err);
      onErrorToast?.(err?.message || 'Failed to update doctor.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Doctor
  const handleDeleteDoctor = async (doctor: Doctor) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${doctor.name} from the medical registry?`
    );
    if (!confirmed) return;

    try {
      await doctorService.delete(doctor.id);
      onSuccessToast?.(`Doctor ${doctor.name} has been removed from database.`);
      await loadData(true);
    } catch (err: any) {
      onErrorToast?.(err?.message || 'Failed to delete doctor.');
    }
  };

  return (
    <div className="doctors-page-container">
      {/* 1. Header Ribbon & Main Actions */}
      <div className="docs-header-ribbon">
        <div className="docs-header-titles">
          <h2>Medical Staff & Doctors</h2>
          <p>
            Browse hospital physicians, specialties, consultation suites, and clinical working schedules
          </p>
        </div>
        <div className="docs-header-actions">
          <button
            type="button"
            className="docs-refresh-btn"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh database records"
          >
            <RotateCcw size={16} className={refreshing ? 'docs-spinner' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            className="docs-add-btn"
            onClick={handleOpenAddModal}
          >
            <Plus size={18} />
            <span>Add Doctor</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Ribbon */}
      <div className="docs-stats-grid">
        <div className="docs-stat-card">
          <div className="docs-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <UserCheck size={24} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-label">Total Doctors</span>
            <span className="docs-stat-value">{totalDoctorsCount}</span>
            <span className="docs-stat-sub">Active in PostgreSQL</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <Building2 size={24} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-label">Departments Covered</span>
            <span className="docs-stat-value">{uniqueDepartmentsCount}</span>
            <span className="docs-stat-sub">Specialties staffed</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
            <Award size={24} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-label">Senior Consultants</span>
            <span className="docs-stat-value">{seniorDoctorsCount}</span>
            <span className="docs-stat-sub">15+ Years clinical exp</span>
          </div>
        </div>

        <div className="docs-stat-card">
          <div className="docs-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
            <CalendarCheck size={24} />
          </div>
          <div className="docs-stat-info">
            <span className="docs-stat-label">Clinical Coverage</span>
            <span className="docs-stat-value">100%</span>
            <span className="docs-stat-sub">All suites active</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="docs-toolbar">
        <div className="docs-toolbar-left">
          <div className="docs-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="docs-search-input"
              placeholder="Search doctor by name, specialization, or room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="docs-select-filter"
            value={selectedDeptId}
            onChange={(e) => setSelectedDeptId(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="all">All Departments ({totalDoctorsCount})</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          <select
            className="docs-select-filter"
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
            aria-label="Filter by experience"
          >
            <option value="all">All Experience Levels</option>
            <option value="junior">&lt; 10 Years</option>
            <option value="mid">10 - 15 Years</option>
            <option value="senior">15+ Years (Senior)</option>
          </select>
        </div>

        <div className="docs-toolbar-right">
          <select
            className="docs-select-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort doctors"
          >
            <option value="name-asc">Sort: Name (A to Z)</option>
            <option value="name-desc">Sort: Name (Z to A)</option>
            <option value="exp-desc">Sort: Most Experienced</option>
            <option value="department">Sort: Department</option>
          </select>

          <div className="docs-view-toggle">
            <button
              type="button"
              className={`docs-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
              aria-label="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`docs-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Doctors View: Grid Cards or Table */}
      {loading ? (
        <div className="docs-loading-container">
          <Loader2 size={36} className="docs-spinner" />
          <p>Loading medical staff from PostgreSQL database...</p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="docs-empty-state">
          <div className="docs-empty-icon">
            <UserCheck size={32} />
          </div>
          <h3>No doctors match your filter</h3>
          <p>Try searching with another keyword or adjust the department filter.</p>
          <button
            type="button"
            className="docs-refresh-btn"
            onClick={() => {
              setSearchQuery('');
              setSelectedDeptId('all');
              setExperienceFilter('all');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="docs-cards-grid">
          {filteredDoctors.map((doc) => {
            const deptObj =
              departmentMap.get(doc.departmentId) ||
              departmentMap.get((doc.departmentName || '').toLowerCase());
            const deptColor = deptObj?.color || '#2563EB';

            return (
              <div key={doc.id} className="docs-card">
                <div>
                  <div className="docs-card-header">
                    <div className="docs-avatar-wrapper">
                      <img
                        src={
                          doc.avatar ||
                          DEFAULT_AVATARS[0]
                        }
                        alt={doc.name}
                        className="docs-avatar-img"
                      />
                      <span className="docs-status-dot-online" title="On Duty / Available" />
                    </div>

                    <div className="docs-header-info">
                      <div
                        className="docs-dept-tag"
                        style={{
                          backgroundColor: `${deptColor}15`,
                          color: deptColor,
                        }}
                      >
                        <Building2 size={12} />
                        <span>{doc.departmentName || 'General Medicine'}</span>
                      </div>
                      <h3 className="docs-doctor-name">{doc.name}</h3>
                      <div className="docs-specialization">{doc.specialization}</div>
                    </div>
                  </div>

                  <div className="docs-card-meta">
                    <div className="docs-meta-row">
                      <span className="docs-meta-label">
                        <Briefcase size={14} />
                        Experience
                      </span>
                      <span className="docs-meta-val">{doc.experience || '10+ Years'}</span>
                    </div>

                    <div className="docs-meta-row">
                      <span className="docs-meta-label">
                        <MapPin size={14} />
                        Consultation Room
                      </span>
                      <span className="docs-meta-val">{doc.roomNumber || 'Main Clinic'}</span>
                    </div>

                    <div className="docs-meta-row">
                      <span className="docs-meta-label">
                        <Clock size={14} />
                        Working Hours
                      </span>
                      <span className="docs-meta-val">
                        {doc.workingHours?.start || '09:00 AM'} - {doc.workingHours?.end || '05:00 PM'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="docs-card-footer">
                  {onScheduleWithDoctor && (
                    <button
                      type="button"
                      className="docs-schedule-btn"
                      onClick={() => onScheduleWithDoctor(doc)}
                    >
                      <CalendarCheck size={15} />
                      <span>Book Appointment</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="docs-action-icon-btn"
                    onClick={() => handleOpenDetailsModal(doc)}
                    title="View Doctor Profile"
                    aria-label={`View details of ${doc.name}`}
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    type="button"
                    className="docs-action-icon-btn"
                    onClick={() => handleOpenEditModal(doc)}
                    title="Edit Doctor"
                    aria-label={`Edit ${doc.name}`}
                  >
                    <Edit3 size={15} />
                  </button>

                  <button
                    type="button"
                    className="docs-action-icon-btn"
                    onClick={() => handleDeleteDoctor(doc)}
                    title="Delete Doctor"
                    aria-label={`Delete ${doc.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="docs-table-container">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Physician Name</th>
                <th>Department</th>
                <th>Specialization</th>
                <th>Experience</th>
                <th>Consultation Suite</th>
                <th>Working Hours</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map((doc) => {
                const deptObj =
                  departmentMap.get(doc.departmentId) ||
                  departmentMap.get((doc.departmentName || '').toLowerCase());
                const deptColor = deptObj?.color || '#2563EB';

                return (
                  <tr key={doc.id}>
                    <td>
                      <div className="docs-table-doctor-cell">
                        <img
                          src={doc.avatar || DEFAULT_AVATARS[0]}
                          alt={doc.name}
                          className="docs-table-avatar"
                        />
                        <div>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{doc.name}</span>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className="docs-dept-tag"
                        style={{
                          backgroundColor: `${deptColor}15`,
                          color: deptColor,
                        }}
                      >
                        {doc.departmentName || 'General Medicine'}
                      </span>
                    </td>
                    <td style={{ color: '#2563eb', fontWeight: 600 }}>{doc.specialization}</td>
                    <td>{doc.experience || '10 Years'}</td>
                    <td>{doc.roomNumber || 'Main Clinic'}</td>
                    <td>
                      {doc.workingHours?.start || '09:00 AM'} - {doc.workingHours?.end || '05:00 PM'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {onScheduleWithDoctor && (
                          <button
                            type="button"
                            className="docs-schedule-btn"
                            style={{ padding: '6px 12px' }}
                            onClick={() => onScheduleWithDoctor(doc)}
                          >
                            <CalendarCheck size={14} />
                            <span>Book</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="docs-action-icon-btn"
                          style={{ width: 32, height: 32 }}
                          onClick={() => handleOpenDetailsModal(doc)}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="docs-action-icon-btn"
                          style={{ width: 32, height: 32 }}
                          onClick={() => handleOpenEditModal(doc)}
                          title="Edit Doctor"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          5. Add Doctor Modal (Saves to SQL Database)
          ======================================================== */}
      {isAddModalOpen && (
        <div className="docs-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="docs-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal-header">
              <h3>Register New Medical Doctor</h3>
              <button
                type="button"
                className="docs-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="docs-modal-body">
                <div className="docs-form-group">
                  <label className="docs-form-label">
                    Full Doctor Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="docs-form-input"
                    placeholder="e.g. Dr. Jennifer Lawrence"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="docs-form-row">
                  <div className="docs-form-group">
                    <label className="docs-form-label">Clinical Department</label>
                    <select
                      className="docs-form-select"
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value)}
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="docs-form-group">
                    <label className="docs-form-label">Years of Experience</label>
                    <input
                      type="text"
                      className="docs-form-input"
                      placeholder="e.g. 14 Years"
                      value={formExperience}
                      onChange={(e) => setFormExperience(e.target.value)}
                    />
                  </div>
                </div>

                <div className="docs-form-group">
                  <label className="docs-form-label">
                    Medical Specialization <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="docs-form-input"
                    placeholder="e.g. Interventional Cardiology & Angioplasty"
                    value={formSpecialization}
                    onChange={(e) => setFormSpecialization(e.target.value)}
                  />
                </div>

                <div className="docs-form-row">
                  <div className="docs-form-group">
                    <label className="docs-form-label">Consultation Room / Suite</label>
                    <input
                      type="text"
                      className="docs-form-input"
                      placeholder="e.g. Suite 305"
                      value={formRoomNumber}
                      onChange={(e) => setFormRoomNumber(e.target.value)}
                    />
                  </div>

                  <div className="docs-form-group">
                    <label className="docs-form-label">Working Hours</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="docs-form-input"
                        placeholder="09:00 AM"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                      />
                      <input
                        type="text"
                        className="docs-form-input"
                        placeholder="05:00 PM"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="docs-form-group">
                  <label className="docs-form-label">Avatar Portrait Selection</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {DEFAULT_AVATARS.map((av, idx) => (
                      <img
                        key={idx}
                        src={av}
                        alt="Avatar Option"
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          cursor: 'pointer',
                          border: formAvatar === av ? '3px solid #2563eb' : '2px solid #e2e8f0',
                        }}
                        onClick={() => setFormAvatar(av)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="docs-modal-footer">
                <button
                  type="button"
                  className="docs-modal-cancel-btn"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="docs-modal-submit-btn"
                  disabled={submitting || !formName.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="docs-spinner" />
                      <span>Saving to SQL...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Save Doctor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          6. Edit Doctor Modal (Updates in SQL Database)
          ======================================================== */}
      {isEditModalOpen && selectedDoctorForEdit && (
        <div className="docs-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="docs-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal-header">
              <h3>Edit Doctor: {selectedDoctorForEdit.name}</h3>
              <button
                type="button"
                className="docs-modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="docs-modal-body">
                <div className="docs-form-group">
                  <label className="docs-form-label">
                    Full Doctor Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="docs-form-input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="docs-form-row">
                  <div className="docs-form-group">
                    <label className="docs-form-label">Clinical Department</label>
                    <select
                      className="docs-form-select"
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value)}
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="docs-form-group">
                    <label className="docs-form-label">Years of Experience</label>
                    <input
                      type="text"
                      className="docs-form-input"
                      value={formExperience}
                      onChange={(e) => setFormExperience(e.target.value)}
                    />
                  </div>
                </div>

                <div className="docs-form-group">
                  <label className="docs-form-label">Medical Specialization</label>
                  <input
                    type="text"
                    required
                    className="docs-form-input"
                    value={formSpecialization}
                    onChange={(e) => setFormSpecialization(e.target.value)}
                  />
                </div>

                <div className="docs-form-row">
                  <div className="docs-form-group">
                    <label className="docs-form-label">Consultation Room / Suite</label>
                    <input
                      type="text"
                      className="docs-form-input"
                      value={formRoomNumber}
                      onChange={(e) => setFormRoomNumber(e.target.value)}
                    />
                  </div>

                  <div className="docs-form-group">
                    <label className="docs-form-label">Working Hours</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="docs-form-input"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                      />
                      <input
                        type="text"
                        className="docs-form-input"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="docs-modal-footer">
                <button
                  type="button"
                  className="docs-modal-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="docs-modal-submit-btn"
                  disabled={submitting || !formName.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="docs-spinner" />
                      <span>Updating SQL...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Update Doctor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          7. Doctor Profile Details Modal
          ======================================================== */}
      {isDetailsModalOpen && selectedDoctorForDetails && (
        <div className="docs-modal-backdrop" onClick={() => setIsDetailsModalOpen(false)}>
          <div className="docs-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="docs-modal-header">
              <h3>Physician Credentials & Profile</h3>
              <button
                type="button"
                className="docs-modal-close-btn"
                onClick={() => setIsDetailsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="docs-modal-body">
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 12 }}>
                <img
                  src={selectedDoctorForDetails.avatar || DEFAULT_AVATARS[0]}
                  alt={selectedDoctorForDetails.name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 18,
                    objectFit: 'cover',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
                    {selectedDoctorForDetails.name}
                  </h3>
                  <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.9375rem' }}>
                    {selectedDoctorForDetails.specialization}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: 4 }}>
                    Department: {selectedDoctorForDetails.departmentName || 'General Medicine'}
                  </div>
                </div>
              </div>

              <div className="docs-card-meta">
                <div className="docs-meta-row">
                  <span className="docs-meta-label">
                    <Briefcase size={15} />
                    Experience
                  </span>
                  <span className="docs-meta-val">{selectedDoctorForDetails.experience || '10+ Years'}</span>
                </div>

                <div className="docs-meta-row">
                  <span className="docs-meta-label">
                    <MapPin size={15} />
                    Consultation Room
                  </span>
                  <span className="docs-meta-val">{selectedDoctorForDetails.roomNumber || 'Main Clinic'}</span>
                </div>

                <div className="docs-meta-row">
                  <span className="docs-meta-label">
                    <Clock size={15} />
                    Office Working Hours
                  </span>
                  <span className="docs-meta-val">
                    {selectedDoctorForDetails.workingHours?.start || '09:00 AM'} -{' '}
                    {selectedDoctorForDetails.workingHours?.end || '05:00 PM'}
                  </span>
                </div>

                <div className="docs-meta-row">
                  <span className="docs-meta-label">
                    <Award size={15} />
                    Status
                  </span>
                  <span className="docs-meta-val" style={{ color: '#10b981' }}>
                    Active & Available for Consultation
                  </span>
                </div>
              </div>
            </div>

            <div className="docs-modal-footer">
              <button
                type="button"
                className="docs-modal-cancel-btn"
                onClick={() => setIsDetailsModalOpen(false)}
              >
                Close
              </button>
              {onScheduleWithDoctor && (
                <button
                  type="button"
                  className="docs-modal-submit-btn"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    onScheduleWithDoctor(selectedDoctorForDetails);
                  }}
                >
                  <CalendarCheck size={16} />
                  <span>Book Appointment with {selectedDoctorForDetails.name}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
