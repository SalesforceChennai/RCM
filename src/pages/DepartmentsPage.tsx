import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  RotateCcw,
  Stethoscope,
  Heart,
  Bone,
  Brain,
  Baby,
  Sparkles,
  Activity,
  Shield,
  AlertTriangle,
  Eye,
  Smile,
  Wind,
  Camera,
  Mic,
  Pill,
  Users,
  Grid,
  List,
  Edit3,
  X,
  Clock,
  MapPin,
  CalendarCheck,
  Loader2,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import type { Department, Doctor } from '../types';
import { departmentService } from '../services/departmentService';
import { doctorService } from '../services/doctorService';
import './DepartmentsPage.css';

interface DepartmentsPageProps {
  onNavigateToDashboard?: () => void;
  onScheduleWithDoctor?: (doctor: Doctor) => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

const COLOR_PRESETS = [
  { label: 'Crimson', hex: '#EF4444' },
  { label: 'Sky Blue', hex: '#0284C7' },
  { label: 'Teal', hex: '#14B8A6' },
  { label: 'Indigo', hex: '#6366F1' },
  { label: 'Cyan', hex: '#06B6D4' },
  { label: 'Rose Pink', hex: '#EC4899' },
  { label: 'Violet', hex: '#8B5CF6' },
  { label: 'Amber', hex: '#F59E0B' },
  { label: 'Emerald', hex: '#10B981' },
  { label: 'Royal Blue', hex: '#2563EB' },
  { label: 'Coral Red', hex: '#DC2626' },
  { label: 'Slate', hex: '#475569' },
];

const ICON_PRESETS = [
  { id: 'stethoscope', label: 'Stethoscope' },
  { id: 'heart', label: 'Heart' },
  { id: 'bone', label: 'Bone' },
  { id: 'brain', label: 'Brain' },
  { id: 'baby', label: 'Pediatrics' },
  { id: 'sparkles', label: 'Dermatology' },
  { id: 'activity', label: 'Activity' },
  { id: 'shield', label: 'Shield' },
  { id: 'alert-triangle', label: 'Emergency' },
  { id: 'eye', label: 'Eye' },
  { id: 'smile', label: 'Smile' },
  { id: 'wind', label: 'Pulmonology' },
  { id: 'camera', label: 'Radiology' },
  { id: 'mic', label: 'ENT' },
  { id: 'pill', label: 'Pharmacy' },
  { id: 'building', label: 'Building' },
];

export const renderDepartmentIcon = (iconName: string, size = 22, color = 'currentColor') => {
  const norm = (iconName || '').toLowerCase().trim();
  switch (norm) {
    case 'heart':
      return <Heart size={size} color={color} />;
    case 'bone':
      return <Bone size={size} color={color} />;
    case 'brain':
      return <Brain size={size} color={color} />;
    case 'baby':
      return <Baby size={size} color={color} />;
    case 'sparkles':
      return <Sparkles size={size} color={color} />;
    case 'activity':
      return <Activity size={size} color={color} />;
    case 'shield':
      return <Shield size={size} color={color} />;
    case 'alert-triangle':
    case 'alert':
      return <AlertTriangle size={size} color={color} />;
    case 'eye':
      return <Eye size={size} color={color} />;
    case 'smile':
      return <Smile size={size} color={color} />;
    case 'wind':
      return <Wind size={size} color={color} />;
    case 'camera':
      return <Camera size={size} color={color} />;
    case 'mic':
      return <Mic size={size} color={color} />;
    case 'pill':
      return <Pill size={size} color={color} />;
    case 'stethoscope':
      return <Stethoscope size={size} color={color} />;
    default:
      return <Building2 size={size} color={color} />;
  }
};

export const DepartmentsPage: React.FC<DepartmentsPageProps> = ({
  onNavigateToDashboard: _onNavigateToDashboard,
  onScheduleWithDoctor,
  onSuccessToast,
  onErrorToast,
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedDeptForEdit, setSelectedDeptForEdit] = useState<Department | null>(null);

  const [isDoctorsModalOpen, setIsDoctorsModalOpen] = useState<boolean>(false);
  const [selectedDeptForDoctors, setSelectedDeptForDoctors] = useState<Department | null>(null);

  // Add / Edit Form State
  const [formName, setFormName] = useState<string>('');
  const [formId, setFormId] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formColor, setFormColor] = useState<string>('#2563EB');
  const [formIcon, setFormIcon] = useState<string>('stethoscope');
  const [formStatus, setFormStatus] = useState<string>('Active');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Fetch departments and doctors
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [fetchedDepts, fetchedDocs] = await Promise.all([
        departmentService.getAll(),
        doctorService.getAll(),
      ]);
      setDepartments(fetchedDepts);
      setDoctors(fetchedDocs);
    } catch (err: any) {
      console.error('Failed to load departments:', err);
      onErrorToast?.(err?.message || 'Failed to load departments data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onErrorToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute doctor counts for each department from live doctors list
  const deptsWithDoctorCounts = useMemo(() => {
    return departments.map((dept) => {
      const matchingDocs = doctors.filter(
        (doc) => doc.departmentId === dept.id || doc.departmentName === dept.name
      );
      return {
        ...dept,
        calculatedDoctorCount: matchingDocs.length,
      };
    });
  }, [departments, doctors]);

  // Metrics
  const totalDepartments = deptsWithDoctorCounts.length;
  const activeDepartments = deptsWithDoctorCounts.filter(
    (d) => (d.status || 'Active').toLowerCase() === 'active'
  ).length;
  const totalAssignedDoctors = doctors.length;
  const avgDoctorsPerDept = totalDepartments > 0
    ? (totalAssignedDoctors / totalDepartments).toFixed(1)
    : '0';

  // Filtered & Sorted Departments
  const filteredDepartments = useMemo(() => {
    let result = [...deptsWithDoctorCounts];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(
        (d) => (d.status || 'Active').toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'doctors-desc') {
        return b.calculatedDoctorCount - a.calculatedDoctorCount;
      }
      if (sortBy === 'doctors-asc') {
        return a.calculatedDoctorCount - b.calculatedDoctorCount;
      }
      return 0;
    });

    return result;
  }, [deptsWithDoctorCounts, searchQuery, statusFilter, sortBy]);

  // Reset Add Form
  const resetForm = () => {
    setFormName('');
    setFormId('');
    setFormDescription('');
    setFormColor('#2563EB');
    setFormIcon('stethoscope');
    setFormStatus('Active');
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (dept: Department) => {
    setSelectedDeptForEdit(dept);
    setFormName(dept.name);
    setFormId(dept.id);
    setFormDescription(dept.description || '');
    setFormColor(dept.color || '#2563EB');
    setFormIcon(dept.icon || 'stethoscope');
    setFormStatus(dept.status || 'Active');
    setIsEditModalOpen(true);
  };

  // Open Doctors Modal
  const handleOpenDoctorsModal = (dept: Department) => {
    setSelectedDeptForDoctors(dept);
    setIsDoctorsModalOpen(true);
  };

  // Submit Add Department to SQL Database
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onErrorToast?.('Please enter a department name.');
      return;
    }

    setSubmitting(true);
    try {
      const newDept = await departmentService.create({
        id: formId.trim() || undefined,
        name: formName.trim(),
        description: formDescription.trim(),
        color: formColor,
        icon: formIcon,
        status: formStatus,
      });

      onSuccessToast?.(`Department "${newDept.name}" successfully added and saved to database SQL!`);
      setIsAddModalOpen(false);
      resetForm();
      await loadData(true);
    } catch (err: any) {
      console.error('Error creating department:', err);
      onErrorToast?.(err?.message || 'Failed to create department.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Department to SQL Database
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptForEdit || !formName.trim()) return;

    setSubmitting(true);
    try {
      await departmentService.update(selectedDeptForEdit.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        color: formColor,
        icon: formIcon,
        status: formStatus,
      });

      onSuccessToast?.(`Department "${formName}" updated successfully in database!`);
      setIsEditModalOpen(false);
      setSelectedDeptForEdit(null);
      resetForm();
      await loadData(true);
    } catch (err: any) {
      console.error('Error updating department:', err);
      onErrorToast?.(err?.message || 'Failed to update department.');
    } finally {
      setSubmitting(false);
    }
  };

  // Get doctors for currently selected department
  const selectedDeptDoctors = useMemo(() => {
    if (!selectedDeptForDoctors) return [];
    return doctors.filter(
      (d) =>
        d.departmentId === selectedDeptForDoctors.id ||
        d.departmentName === selectedDeptForDoctors.name
    );
  }, [selectedDeptForDoctors, doctors]);

  return (
    <div className="departments-container">
      {/* 1. Header Ribbon & Main Actions */}
      <div className="dept-header-ribbon">
        <div className="dept-header-titles">
          <h2>Clinical Departments</h2>
          <p>
            Manage hospital medical specialties, operational departments, and clinical staff allocations
          </p>
        </div>
        <div className="dept-header-actions">
          <button
            type="button"
            className="dept-refresh-btn"
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh database records"
          >
            <RotateCcw size={16} className={refreshing ? 'dept-spinner' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            className="dept-add-btn"
            onClick={handleOpenAddModal}
          >
            <Plus size={18} />
            <span>Add Department</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Ribbon */}
      <div className="dept-stats-grid">
        <div className="dept-stat-card">
          <div className="dept-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Building2 size={24} />
          </div>
          <div className="dept-stat-info">
            <span className="dept-stat-label">Total Departments</span>
            <span className="dept-stat-value">{totalDepartments}</span>
            <span className="dept-stat-sub">Configured in SQL DB</span>
          </div>
        </div>

        <div className="dept-stat-card">
          <div className="dept-stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <Activity size={24} />
          </div>
          <div className="dept-stat-info">
            <span className="dept-stat-label">Active Specialties</span>
            <span className="dept-stat-value">{activeDepartments}</span>
            <span className="dept-stat-sub">100% Operational</span>
          </div>
        </div>

        <div className="dept-stat-card">
          <div className="dept-stat-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
            <Users size={24} />
          </div>
          <div className="dept-stat-info">
            <span className="dept-stat-label">Assigned Medical Doctors</span>
            <span className="dept-stat-value">{totalAssignedDoctors}</span>
            <span className="dept-stat-sub">Full-time providers</span>
          </div>
        </div>

        <div className="dept-stat-card">
          <div className="dept-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
            <Briefcase size={24} />
          </div>
          <div className="dept-stat-info">
            <span className="dept-stat-label">Avg Doctors / Dept</span>
            <span className="dept-stat-value">{avgDoctorsPerDept}</span>
            <span className="dept-stat-sub">Balanced distribution</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Toolbar */}
      <div className="dept-toolbar">
        <div className="dept-toolbar-left">
          <div className="dept-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="dept-search-input"
              placeholder="Search department name, code, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="dept-status-pills">
            <button
              type="button"
              className={`dept-pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({totalDepartments})
            </button>
            <button
              type="button"
              className={`dept-pill-btn ${statusFilter === 'Active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Active')}
            >
              Active ({activeDepartments})
            </button>
            <button
              type="button"
              className={`dept-pill-btn ${statusFilter === 'Inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Inactive')}
            >
              Inactive ({totalDepartments - activeDepartments})
            </button>
          </div>
        </div>

        <div className="dept-toolbar-right">
          <select
            className="dept-select-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort departments"
          >
            <option value="name-asc">Sort: Name (A to Z)</option>
            <option value="name-desc">Sort: Name (Z to A)</option>
            <option value="doctors-desc">Sort: Most Doctors</option>
            <option value="doctors-asc">Sort: Fewest Doctors</option>
          </select>

          <div className="dept-view-toggle">
            <button
              type="button"
              className={`dept-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
              aria-label="Grid View"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className={`dept-view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
              aria-label="Table View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Content: Grid or Table View */}
      {loading ? (
        <div className="dept-loading-container">
          <Loader2 size={36} className="dept-spinner" />
          <p>Loading departments from PostgreSQL database...</p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="dept-empty-state">
          <div className="dept-empty-icon">
            <Building2 size={32} />
          </div>
          <h3>No departments match your filter</h3>
          <p>Try searching with another keyword or clear the current search query.</p>
          <button
            type="button"
            className="dept-refresh-btn"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="dept-cards-grid">
          {filteredDepartments.map((dept) => {
            const cardColor = dept.color || '#2563EB';
            const isActive = (dept.status || 'Active').toLowerCase() === 'active';

            return (
              <div
                key={dept.id}
                className="dept-card"
                style={{ '--card-accent': cardColor } as React.CSSProperties}
              >
                <div>
                  <div className="dept-card-top">
                    <div
                      className="dept-icon-wrapper"
                      style={{
                        backgroundColor: `${cardColor}15`,
                        color: cardColor,
                      }}
                    >
                      {renderDepartmentIcon(dept.icon, 24, cardColor)}
                    </div>
                    <div className="dept-badges-wrapper">
                      <span className="dept-id-badge">{dept.id}</span>
                      <span className={`dept-status-badge ${isActive ? 'active' : 'inactive'}`}>
                        <span className="dept-status-dot" />
                        {dept.status || 'Active'}
                      </span>
                    </div>
                  </div>

                  <h3 className="dept-card-title">{dept.name}</h3>
                  <p className="dept-card-desc">
                    {dept.description || 'Specialized clinical care and diagnostic healthcare operations.'}
                  </p>
                </div>

                <div>
                  <div className="dept-card-stats">
                    <div className="dept-doctor-counter">
                      <Stethoscope size={15} />
                      <span>{dept.calculatedDoctorCount} {dept.calculatedDoctorCount === 1 ? 'Doctor' : 'Doctors'} Assigned</span>
                    </div>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: cardColor,
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 0 1px #cbd5e1'
                      }}
                      title={`Theme: ${cardColor}`}
                    />
                  </div>

                  <div className="dept-card-footer">
                    <button
                      type="button"
                      className="dept-view-docs-btn"
                      onClick={() => handleOpenDoctorsModal(dept)}
                    >
                      <Users size={15} />
                      <span>View Doctors ({dept.calculatedDoctorCount})</span>
                    </button>
                    <button
                      type="button"
                      className="dept-edit-btn"
                      onClick={() => handleOpenEditModal(dept)}
                      title="Edit Department"
                      aria-label={`Edit ${dept.name}`}
                    >
                      <Edit3 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="dept-table-container">
          <table className="dept-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Code / ID</th>
                <th>Description</th>
                <th>Assigned Staff</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((dept) => {
                const cardColor = dept.color || '#2563EB';
                const isActive = (dept.status || 'Active').toLowerCase() === 'active';

                return (
                  <tr key={dept.id}>
                    <td>
                      <div className="dept-table-name-cell">
                        <div
                          className="dept-table-icon"
                          style={{
                            backgroundColor: `${cardColor}15`,
                            color: cardColor,
                          }}
                        >
                          {renderDepartmentIcon(dept.icon, 20, cardColor)}
                        </div>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{dept.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="dept-id-badge">{dept.id}</span>
                    </td>
                    <td style={{ maxWidth: 320, color: '#64748b' }}>
                      {dept.description || 'Specialized clinical care.'}
                    </td>
                    <td>
                      <span className="dept-doctor-counter">
                        <Stethoscope size={14} />
                        {dept.calculatedDoctorCount} Doctors
                      </span>
                    </td>
                    <td>
                      <span className={`dept-status-badge ${isActive ? 'active' : 'inactive'}`}>
                        <span className="dept-status-dot" />
                        {dept.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button
                          type="button"
                          className="dept-view-docs-btn"
                          onClick={() => handleOpenDoctorsModal(dept)}
                          style={{ padding: '6px 12px' }}
                        >
                          <Users size={14} />
                          <span>Doctors ({dept.calculatedDoctorCount})</span>
                        </button>
                        <button
                          type="button"
                          className="dept-edit-btn"
                          onClick={() => handleOpenEditModal(dept)}
                          title="Edit Department"
                          style={{ width: 32, height: 32 }}
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
          5. Add Department Modal (Saves to SQL Database)
          ======================================================== */}
      {isAddModalOpen && (
        <div className="dept-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="dept-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="dept-modal-header">
              <h3>Add New Department</h3>
              <button
                type="button"
                className="dept-modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="dept-modal-body">
                <div className="dept-form-group">
                  <label className="dept-form-label">
                    Department Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="dept-form-input"
                    placeholder="e.g. Endocrinology & Metabolic Care"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!formId || formId.startsWith('dept-')) {
                        const slug = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '-')
                          .replace(/-+/g, '-')
                          .replace(/^-|-$/g, '');
                        setFormId(`dept-${slug}`);
                      }
                    }}
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Department Code / Slug</label>
                  <input
                    type="text"
                    className="dept-form-input"
                    placeholder="dept-endo"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Description & Medical Scope</label>
                  <textarea
                    className="dept-form-textarea"
                    placeholder="Provide a brief clinical summary of conditions treated and procedures performed..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Accent Theme Color</label>
                  <div className="dept-color-picker-grid">
                    {COLOR_PRESETS.map((color) => (
                      <div
                        key={color.hex}
                        className={`dept-color-swatch ${formColor === color.hex ? 'selected' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setFormColor(color.hex)}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Department Icon</label>
                  <div className="dept-icon-picker-grid">
                    {ICON_PRESETS.map((iconItem) => (
                      <div
                        key={iconItem.id}
                        className={`dept-icon-option ${formIcon === iconItem.id ? 'selected' : ''}`}
                        onClick={() => setFormIcon(iconItem.id)}
                        title={iconItem.label}
                      >
                        {renderDepartmentIcon(iconItem.id, 20)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Operational Status</label>
                  <select
                    className="dept-form-select"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="dept-modal-footer">
                <button
                  type="button"
                  className="dept-modal-cancel-btn"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dept-modal-submit-btn"
                  disabled={submitting || !formName.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="dept-spinner" />
                      <span>Saving to SQL...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Save Department</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          6. Edit Department Modal (Updates in SQL Database)
          ======================================================== */}
      {isEditModalOpen && selectedDeptForEdit && (
        <div className="dept-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
          <div className="dept-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="dept-modal-header">
              <h3>Edit Department: {selectedDeptForEdit.name}</h3>
              <button
                type="button"
                className="dept-modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="dept-modal-body">
                <div className="dept-form-group">
                  <label className="dept-form-label">
                    Department Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="dept-form-input"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Description & Medical Scope</label>
                  <textarea
                    className="dept-form-textarea"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Accent Theme Color</label>
                  <div className="dept-color-picker-grid">
                    {COLOR_PRESETS.map((color) => (
                      <div
                        key={color.hex}
                        className={`dept-color-swatch ${formColor === color.hex ? 'selected' : ''}`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => setFormColor(color.hex)}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Department Icon</label>
                  <div className="dept-icon-picker-grid">
                    {ICON_PRESETS.map((iconItem) => (
                      <div
                        key={iconItem.id}
                        className={`dept-icon-option ${formIcon === iconItem.id ? 'selected' : ''}`}
                        onClick={() => setFormIcon(iconItem.id)}
                        title={iconItem.label}
                      >
                        {renderDepartmentIcon(iconItem.id, 20)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="dept-form-group">
                  <label className="dept-form-label">Operational Status</label>
                  <select
                    className="dept-form-select"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="dept-modal-footer">
                <button
                  type="button"
                  className="dept-modal-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dept-modal-submit-btn"
                  disabled={submitting || !formName.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="dept-spinner" />
                      <span>Updating SQL...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Update Department</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          7. Department Doctors Modal
          ======================================================== */}
      {isDoctorsModalOpen && selectedDeptForDoctors && (
        <div className="dept-modal-backdrop" onClick={() => setIsDoctorsModalOpen(false)}>
          <div className="dept-modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dept-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  className="dept-icon-wrapper"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: `${selectedDeptForDoctors.color || '#2563EB'}15`,
                    color: selectedDeptForDoctors.color || '#2563EB',
                  }}
                >
                  {renderDepartmentIcon(selectedDeptForDoctors.icon, 20, selectedDeptForDoctors.color)}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{selectedDeptForDoctors.name} Doctors</h3>
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {selectedDeptDoctors.length} {selectedDeptDoctors.length === 1 ? 'provider' : 'providers'} registered in this department
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="dept-modal-close-btn"
                onClick={() => setIsDoctorsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="dept-modal-body">
              {selectedDeptDoctors.length === 0 ? (
                <div className="dept-empty-state" style={{ padding: '36px 20px' }}>
                  <Users size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                  <h4>No doctors assigned yet</h4>
                  <p>No medical staff are currently linked to this clinical department.</p>
                </div>
              ) : (
                <div className="dept-doctors-list">
                  {selectedDeptDoctors.map((doc) => (
                    <div key={doc.id} className="dept-doctor-item">
                      <div className="dept-doctor-info-left">
                        <img
                          src={doc.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80'}
                          alt={doc.name}
                          className="dept-doctor-avatar"
                        />
                        <div>
                          <div className="dept-doctor-name">{doc.name}</div>
                          <div className="dept-doctor-spec">{doc.specialization}</div>
                          <div className="dept-doctor-meta">
                            {doc.roomNumber && (
                              <span>
                                <MapPin size={13} />
                                {doc.roomNumber}
                              </span>
                            )}
                            {doc.workingHours && (
                              <span>
                                <Clock size={13} />
                                {doc.workingHours.start} - {doc.workingHours.end}
                              </span>
                            )}
                            {doc.experience && (
                              <span>
                                <Briefcase size={13} />
                                {doc.experience}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {onScheduleWithDoctor && (
                        <button
                          type="button"
                          className="dept-doc-book-btn"
                          onClick={() => {
                            setIsDoctorsModalOpen(false);
                            onScheduleWithDoctor(doc);
                          }}
                        >
                          <CalendarCheck size={14} />
                          <span>Schedule</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dept-modal-footer">
              <button
                type="button"
                className="dept-modal-cancel-btn"
                onClick={() => setIsDoctorsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
