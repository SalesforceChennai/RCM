import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound
} from 'lucide-react';
import { authService, type AuthUser } from '../services/authService';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onSuccessToast,
  onErrorToast
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'User' | 'Admin'>('User');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!email.trim()) {
          throw new Error('Please enter your email address.');
        }
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }

        const regResult = await authService.register(name, email, password, role);
        setSuccessMessage(`Account for ${regResult.user.name} created successfully! Logging you in...`);
        onSuccessToast?.('Account created successfully!');

        // Automatically log in after registration
        const loginResult = await authService.login(email, password);
        onLoginSuccess(loginResult.user);
      } else {
        if (!email.trim() || !password) {
          throw new Error('Please enter both email and password.');
        }

        const loginResult = await authService.login(email, password);
        onSuccessToast?.(`Welcome back, ${loginResult.user.name}!`);
        onLoginSuccess(loginResult.user);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials.';
      setErrorMessage(msg);
      onErrorToast?.(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setErrorMessage(null);
    setLoading(true);

    try {
      const loginResult = await authService.login(quickEmail, quickPass);
      onSuccessToast?.(`Logged in as ${loginResult.user.name} (${loginResult.user.role})!`);
      onLoginSuccess(loginResult.user);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 50%, #ede9fe 100%)',
        padding: '24px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          overflow: 'hidden'
        }}
      >
        {/* Brand Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #0284c7 100%)',
            padding: '32px 32px 28px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)'
            }}
          >
            <ShieldCheck size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            MediCare RCM
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
            Enterprise Healthcare Revenue Cycle Management
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: '32px' }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: 10,
              padding: 4,
              marginBottom: 24
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: !isRegisterMode ? '#ffffff' : 'transparent',
                color: !isRegisterMode ? '#0f172a' : '#64748b',
                fontWeight: !isRegisterMode ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: !isRegisterMode ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(true);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={{
                flex: 1,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: isRegisterMode ? '#ffffff' : 'transparent',
                color: isRegisterMode ? '#0f172a' : '#64748b',
                fontWeight: isRegisterMode ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: isRegisterMode ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Register
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#b91c1c',
                fontSize: '0.8125rem',
                marginBottom: 20
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
                padding: '12px 14px',
                color: '#15803d',
                fontSize: '0.8125rem',
                marginBottom: 20
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {isRegisterMode && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: 6
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8'
                    }}
                  />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 38px',
                      borderRadius: 10,
                      border: '1px solid #3B82F6',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={18}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8'
                  }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@medicare.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 10,
                    border: '1px solid #3B82F6',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: isRegisterMode ? 16 : 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: 6
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8'
                  }}
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: 10,
                    border: '1px solid #3B82F6',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {isRegisterMode && (
              <div style={{ marginBottom: 24 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: 6
                  }}
                >
                  Account Role
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      border: role === 'User' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: 10,
                      background: role === 'User' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: role === 'User' ? '#1d4ed8' : '#475569'
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="User"
                      checked={role === 'User'}
                      onChange={() => setRole('User')}
                    />
                    <span>User (Standard)</span>
                  </label>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      border: role === 'Admin' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      borderRadius: 10,
                      background: role === 'Admin' ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: role === 'Admin' ? '#1d4ed8' : '#475569'
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value="Admin"
                      checked={role === 'Admin'}
                      onChange={() => setRole('Admin')}
                    />
                    <span>Administrator</span>
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                fontSize: '0.9375rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{isRegisterMode ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          {!isRegisterMode && (
            <div
              style={{
                marginTop: 28,
                paddingTop: 20,
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 10
                }}
              >
                <KeyRound size={14} color="#3b82f6" />
                <span>Instant Demo Login</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('admin@medicare.com', 'Admin@123')}
                  disabled={loading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
                    <span>Admin User</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Administrator)</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 700 }}>Login →</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('user@medicare.com', 'User@123')}
                  disabled={loading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span>Medicare User</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(User Role)</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Login →</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
