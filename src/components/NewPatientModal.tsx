import React, { useState, useEffect } from 'react';
import { X, UserPlus, Phone, Mail, MapPin, Calendar, User, AlertCircle, Loader2 } from 'lucide-react';
import type { Patient, Gender } from '../types';
import { patientService } from '../services/patientService';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated: (patient: Patient) => void;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export const NewPatientModal: React.FC<NewPatientModalProps> = ({
  isOpen,
  onClose,
  onPatientCreated,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setFirstName('');
      setLastName('');
      setDob('');
      setGender('Male');
      setPhone('');
      setEmail('');
      setAddress('');
      setErrors({});
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required.';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required.';
    }

    if (!dob) {
      newErrors.dob = 'Date of birth is required.';
    } else {
      const parsedDate = new Date(dob);
      const today = new Date();
      if (isNaN(parsedDate.getTime())) {
        newErrors.dob = 'Invalid date format.';
      } else if (parsedDate > today) {
        newErrors.dob = 'Date of birth cannot be in the future.';
      }
    }

    if (!gender) {
      newErrors.gender = 'Gender selection is required.';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else {
      const cleanDigits = phone.replace(/\D/g, '');
      if (cleanDigits.length < 7 || cleanDigits.length > 15) {
        newErrors.phone = 'Please enter a valid phone number (7-15 digits).';
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Please enter a valid email address.';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setErrorMsg('Please correct the highlighted fields before saving.');
      return false;
    }

    setErrorMsg('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const created = await patientService.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: dob.trim(),
        gender,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim() || 'Address not provided',
      });

      onPatientCreated(created);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to register patient in PostgreSQL database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: keyof FormErrors, _value?: string) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (errorMsg) setErrorMsg('');
  };

  return (
    <div className="modal-backdrop" onClick={!isSubmitting ? onClose : undefined}>
      <div
        className="modal-content-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, background: '#eff6ff', borderRadius: 8, color: '#2563eb' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="modal-title">Register New Patient</h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Save patient details directly to the PostgreSQL database
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Body */}
          <div className="modal-body">
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: '0.84375rem',
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  First Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. David"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    handleFieldChange('firstName', e.target.value);
                  }}
                  disabled={isSubmitting}
                  style={errors.firstName ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  required
                />
                {errors.firstName && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {errors.firstName}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Last Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  className="form-input no-icon"
                  placeholder="e.g. Miller"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    handleFieldChange('lastName', e.target.value);
                  }}
                  disabled={isSubmitting}
                  style={errors.lastName ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  required
                />
                {errors.lastName && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {errors.lastName}
                  </span>
                )}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Date of Birth <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <Calendar size={15} className="form-input-icon" />
                  <input
                    type="date"
                    className="form-input"
                    value={dob}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      setDob(e.target.value);
                      handleFieldChange('dob', e.target.value);
                    }}
                    disabled={isSubmitting}
                    style={errors.dob ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    required
                  />
                </div>
                {errors.dob && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {errors.dob}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  Gender <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <User size={15} className="form-input-icon" />
                  <select
                    className="form-select"
                    value={gender}
                    onChange={(e) => {
                      setGender(e.target.value as Gender);
                      handleFieldChange('gender', e.target.value);
                    }}
                    disabled={isSubmitting}
                    style={errors.gender ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {errors.gender && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {errors.gender}
                  </span>
                )}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Phone Number <span className="required-star">*</span>
                </label>
                <div className="form-input-box">
                  <Phone size={15} className="form-input-icon" />
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. +1 (555) 234-5678"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      handleFieldChange('phone', e.target.value);
                    }}
                    disabled={isSubmitting}
                    style={errors.phone ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                    required
                  />
                </div>
                {errors.phone && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {errors.phone}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="form-input-box">
                  <Mail size={15} className="form-input-icon" />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="patient@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      handleFieldChange('email', e.target.value);
                    }}
                    disabled={isSubmitting}
                    style={errors.email ? { borderColor: '#ef4444', backgroundColor: '#fef2f2' } : {}}
                  />
                </div>
                {errors.email && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {errors.email}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <div className="form-input-box">
                <MapPin size={15} className="form-input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Street, City, State, Postal Code"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    handleFieldChange('address', e.target.value);
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create-apt"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 160,
                justifyContent: 'center',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Patient...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Save Patient Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
