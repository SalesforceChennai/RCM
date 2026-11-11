import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Calendar,
  ArrowLeft,
  User,
  Settings,
  LogOut,
  ChevronDown,
  X,
  Shield,
  Mail,
  Fingerprint
} from 'lucide-react';
import type { AuthUser } from '../services/authService';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onToggleMobileMenu: () => void;
  globalSearchQuery: string;
  onGlobalSearchChange: (q: string) => void;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onToggleMobileMenu,
  globalSearchQuery,
  onGlobalSearchChange,
  currentUser,
  onLogout,
}) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Dynamic user display:
  // If Admin: "Admin User", "Administrator"
  // If User: user.name, "User"
  const isAdmin = currentUser?.role === 'Admin';
  const displayName = currentUser
    ? (isAdmin ? (currentUser.name || 'Admin User') : currentUser.name)
    : 'Admin User';
  const displayRole = isAdmin ? 'Administrator' : (currentUser?.role || 'User');
  const displayEmail = currentUser?.email || 'admin@medicare.com';
  const avatarUrl = isAdmin
    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

  const isDashboard = currentView === 'dashboard' || currentView === 'appointments';

  const renderSearchBar = (expanded = false) => (
    <div className={`header-search-wrap ${expanded ? 'header-search-expanded' : ''}`}>
      <Search size={17} className="header-search-icon" />
      <input
        type="text"
        className="header-search-input"
        placeholder="Search patient, doctor, appointment..."
        value={globalSearchQuery}
        onChange={(e) => onGlobalSearchChange(e.target.value)}
      />
    </div>
  );

  return (
    <>
      <header className={`header ${isDashboard ? 'header-dashboard' : ''}`}>
        <div className={`header-left ${isDashboard ? 'header-left-dashboard' : ''}`}>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>

          {isDashboard ? (
            renderSearchBar(true)
          ) : (
            <div className="header-title-box">
              {currentView === 'new-appointment' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>New Appointment</h1>
                  <p>Schedule a new appointment for the patient</p>
                </>
              ) : currentView === 'registration' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Patient Registration & Intake</h1>
                  <p>Verify patient identity, capture government ID, and register arrivals</p>
                </>
              ) : currentView === 'insurance' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Insurance Eligibility & Verification</h1>
                  <p>Real-time payer coverage lookup, copay parameters, and eligibility checking</p>
                </>
              ) : currentView === 'prior-auth' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Prior Authorization</h1>
                  <p>Review services requiring insurance approval and manage authorization requests.</p>
                </>
              ) : currentView === 'charge-capture' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Charge Capture</h1>
                  <p>Track encounters, professional coding, and outpatient reimbursement.</p>
                </>
              ) : currentView === 'medical-coding' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('charge-capture')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Charge Capture</span>
                  </button>
                  <h1>Medical Coding</h1>
                  <p>Review captured healthcare services and assign standardized diagnosis and procedure codes before claim creation.</p>
                </>
              ) : currentView === 'claim-creation' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('medical-coding')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Medical Coding</span>
                  </button>
                  <h1>Claim Creation</h1>
                  <p>Generate CMS-1500 and UB-04 electronic claim batches from validated medical codes.</p>
                </>
              ) : currentView === 'payment-prediction' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>AI Payment Prediction</h1>
                  <p>Random Forest machine learning model forecasting insurance claim approval status and risk analysis</p>
                </>
              ) : currentView === 'patients' ? (
                <>
                  <h1>Patients Management</h1>
                  <p>Search, filter, and review all registered patients, consulting doctors, and health records</p>
                </>
              ) : currentView === 'doctors' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Doctors & Medical Staff</h1>
                  <p>Browse hospital physicians, specialties, consultation suites, and clinical schedules</p>
                </>
              ) : currentView === 'calendar' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Appointments Calendar</h1>
                  <p>Monthly and daily schedule overview, appointments tracking, and availability</p>
                </>
              ) : currentView === 'rcm-ai-assistant' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>RCM AI Assistant</h1>
                </>
              ) : currentView === 'settings' ? (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>Account Settings</h1>
                  <p>Manage your account profile, role credentials, and MediCare RCM preferences</p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="back-link-btn"
                    onClick={() => onNavigate('dashboard')}
                  >
                    <ArrowLeft size={16} />
                    <span>Back to Dashboard</span>
                  </button>
                  <h1>{currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h1>
                  <p>Manage {currentView} records and operations</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="header-right">
          {!isDashboard && renderSearchBar(false)}

          {/* Quick Calendar Button */}
          <button
            type="button"
            className={`header-icon-btn ${currentView === 'calendar' ? 'active' : ''}`}
            title="Open Calendar"
            aria-label="Open Calendar Module"
            onClick={() => onNavigate('calendar')}
          >
            <Calendar size={18} />
          </button>

          {/* Profile Pill & Dropdown */}
          <div style={{ position: 'relative' }} ref={profileDropdownRef}>
            <div
              className="header-profile-pill"
              onClick={() => setShowProfileDropdown((prev) => !prev)}
              role="button"
              tabIndex={0}
              aria-haspopup="true"
              aria-expanded={showProfileDropdown}
              title="Click to view profile & options"
              style={{
                userSelect: 'none',
                cursor: 'pointer',
                border: showProfileDropdown ? '1px solid #2563eb' : undefined,
                boxShadow: showProfileDropdown ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : undefined
              }}
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="header-avatar"
              />
              <div className="header-profile-details">
                <span className="header-profile-name">{displayName}</span>
                <span className="header-profile-sub">{displayRole}</span>
              </div>
              <ChevronDown
                size={14}
                style={{
                  color: '#94a3b8',
                  marginLeft: 2,
                  transform: showProfileDropdown ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </div>

            {/* Profile Dropdown Menu */}
            {showProfileDropdown && (
              <div
                className="action-dropdown-menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 270,
                  padding: 0,
                  borderRadius: 14,
                  boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  zIndex: 1000,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                {/* 1. Profile Summary Card */}
                <div
                  style={{
                    padding: '16px 18px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid #ffffff',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {displayName}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {displayEmail}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 9999,
                            backgroundColor: isAdmin ? '#dbeafe' : '#e0e7ff',
                            color: isAdmin ? '#1d4ed8' : '#4338ca'
                          }}
                        >
                          {displayRole}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dropdown Navigation Actions */}
                <div style={{ padding: '6px' }}>
                  {/* 1. Profile item */}
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setShowProfileModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.8125rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <User size={16} color="#64748b" />
                    <span style={{ fontWeight: 500 }}>Profile Details</span>
                  </button>

                  {/* 2. Account Settings item */}
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onNavigate('settings');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.8125rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <Settings size={16} color="#64748b" />
                    <span style={{ fontWeight: 500 }}>Account Settings</span>
                  </button>

                  <div className="dropdown-divider" style={{ margin: '4px 0' }} />

                  {/* 3. Logout item */}
                  <button
                    type="button"
                    className="dropdown-item danger"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onLogout?.();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: '0.8125rem',
                      color: '#dc2626',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <LogOut size={16} color="#dc2626" />
                    <span style={{ fontWeight: 600 }}>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile Details Modal */}
      {showProfileModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20
          }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 440,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '24px 24px 20px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img
                  src={avatarUrl}
                  alt={displayName}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #ffffff',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                  }}
                />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                    {displayName}
                  </h2>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: 9999,
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    {displayRole}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Details */}
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  <User size={18} color="#3b82f6" />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Full Name</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>{displayName}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  <Mail size={18} color="#3b82f6" />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Email Address</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{displayEmail}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                  <Shield size={18} color="#3b82f6" />
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assigned System Role</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                      {displayRole} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>({isAdmin ? 'Full System Access' : 'Standard Access'})</span>
                    </div>
                  </div>
                </div>

                {currentUser?.id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                    <Fingerprint size={18} color="#3b82f6" />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>User ID</div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {currentUser.id}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowProfileModal(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setShowProfileModal(false);
                    onNavigate('settings');
                  }}
                >
                  <Settings size={16} />
                  <span>Account Settings</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
