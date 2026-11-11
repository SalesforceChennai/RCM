import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  UserCheck,
  Building2,
  CalendarDays,
  Activity,
  ClipboardCheck,
  ShieldCheck,
  FileCheck2,
  Receipt,
  FileCode2,
  FileText,
  Sparkles,
  Bot,
  type LucideIcon
} from 'lucide-react';

import type { AuthUser } from '../services/authService';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser?: AuthUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Scheduling Dashboard', icon: LayoutDashboard },
    { id: 'new-appointment', label: 'New Appointment', icon: CalendarCheck },
    { id: 'registration', label: 'Patient Registration', icon: ClipboardCheck },
    { id: 'insurance', label: 'Insurance Verification', icon: ShieldCheck },
    { id: 'prior-auth', label: 'Prior Authorization', icon: FileCheck2 },
    { id: 'charge-capture', label: 'Charge Capture', icon: Receipt },
    { id: 'medical-coding', label: 'Medical Coding', icon: FileCode2 },
    { id: 'claim-creation', label: 'Claim Creation', icon: FileText },
    { id: 'payment-prediction', label: 'Payment Prediction', icon: Sparkles },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'doctors', label: 'Doctors', icon: UserCheck },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'rcm-ai-assistant', label: 'RCM AI Assistant', icon: Bot },
  ];

  const handleItemClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'mobile-open' : ''}`}
        onClick={onCloseMobile}
      />

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-logo-area">
          <div className="brand-icon-box">
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">MediCare</div>
            <div className="brand-subtitle">RCM System</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleItemClick(item.id)}
              >
                <div className="nav-item-content">
                  <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                </div>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
