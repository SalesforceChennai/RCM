import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  Building2,
  DollarSign,
  Layers
} from 'lucide-react';
import type { ClaimRecord, ClaimPredictionResult, Gender, ClaimType } from '../types/paymentPrediction';
import { paymentPredictionService } from '../services/paymentPredictionService';

interface PredictNewClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimAdded?: (record: ClaimRecord) => void;
}

export const PredictNewClaimModal: React.FC<PredictNewClaimModalProps> = ({
  isOpen,
  onClose,
  onClaimAdded
}) => {
  // Form State
  const [formData, setFormData] = useState(() => ({
    claimId: `CLM-${Math.floor(2000 + Math.random() * 8000)}`,
    patientName: '',
    patientId: '',
    patientAge: 45,
    gender: 'Female' as Gender,
    department: 'General Medicine',
    doctor: 'Dr. Robert Davis',
    insuranceProvider: 'Medicare',
    claimAmount: 450,
    procedureCode: 'CPT 99214',
    procedureDescription: 'Office Outpatient Visit 30-39 Min',
    diagnosisCode: 'ICD-10 E11.9',
    diagnosisDescription: 'Type 2 diabetes mellitus without complications',
    numberOfProcedures: 1,
    previousClaimsCount: 4,
    previousPaidClaims: 4,
    previousUnpaidClaims: 0,
    previousDenials: 0,
    outstandingAmount: 0,
    daysSinceClaimSubmission: 14,
    claimType: 'Outpatient' as ClaimType
  }));

  // Prediction State
  const [predictionResult, setPredictionResult] = useState<ClaimPredictionResult | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
    // Reset prediction on edit
    if (predictionResult) {
      setPredictionResult(null);
      setIsSaved(false);
    }
  };

  const handleRunPrediction = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPredicting(true);

    // Simulate short ML inference latency for user feedback
    setTimeout(() => {
      const result = paymentPredictionService.predictNewClaim(formData);
      setPredictionResult(result);
      setIsPredicting(false);
    }, 300);
  };

  const handleSaveToRegistry = () => {
    if (!predictionResult) return;
    const added = paymentPredictionService.addClaimToRegistry(
      {
        ...formData,
        finalPaymentStatus: predictionResult.prediction
      },
      predictionResult
    );
    setIsSaved(true);
    if (onClaimAdded) {
      onClaimAdded(added);
    }
  };

  const handleReset = () => {
    setPredictionResult(null);
    setIsSaved(false);
    setFormData({
      claimId: `CLM-${Math.floor(2000 + Math.random() * 8000)}`,
      patientName: '',
      patientId: '',
      patientAge: 45,
      gender: 'Female',
      department: 'General Medicine',
      doctor: 'Dr. Robert Davis',
      insuranceProvider: 'Medicare',
      claimAmount: 450,
      procedureCode: 'CPT 99214',
      procedureDescription: 'Office Outpatient Visit 30-39 Min',
      diagnosisCode: 'ICD-10 E11.9',
      diagnosisDescription: 'Type 2 diabetes mellitus without complications',
      numberOfProcedures: 1,
      previousClaimsCount: 4,
      previousPaidClaims: 4,
      previousUnpaidClaims: 0,
      previousDenials: 0,
      outstandingAmount: 0,
      daysSinceClaimSubmission: 14,
      claimType: 'Outpatient'
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          width: '95%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 0
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0b1528 0%, #1e293b 100%)',
            color: '#ffffff',
            borderTopLeftRadius: 'var(--radius-xl)',
            borderTopRightRadius: 'var(--radius-xl)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa'
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  AI Payment Prediction Engine
                </h2>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    letterSpacing: '0.04em'
                  }}
                >
                  RANDOM FOREST
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                Forecast claim adjudication outcome, probability score, and top influencing factors
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px 28px' }}>
          <form onSubmit={handleRunPrediction}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
              {/* Section 1: Encounter & Setting Info */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                  <Building2 size={16} color="#2563eb" />
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    1. Encounter & Setting Info
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Department
                      </label>
                      <select
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="form-control"
                      >
                        <option value="Cardiology">Cardiology</option>
                        <option value="Orthopedics">Orthopedics</option>
                        <option value="Neurology">Neurology</option>
                        <option value="Dermatology">Dermatology</option>
                        <option value="Pediatrics">Pediatrics</option>
                        <option value="General Medicine">General Medicine</option>
                        <option value="Radiology">Radiology</option>
                        <option value="Oncology">Oncology</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Claim Type
                      </label>
                      <select
                        name="claimType"
                        value={formData.claimType}
                        onChange={handleInputChange}
                        className="form-control"
                      >
                        <option value="Outpatient">Outpatient</option>
                        <option value="Inpatient">Inpatient</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Telehealth">Telehealth</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Attending Physician
                    </label>
                    <input
                      type="text"
                      name="doctor"
                      value={formData.doctor}
                      onChange={handleInputChange}
                      className="form-control"
                      placeholder="Dr. Robert Davis"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Patient Age (Years)
                      </label>
                      <input
                        type="number"
                        name="patientAge"
                        value={formData.patientAge}
                        onChange={handleInputChange}
                        min="1"
                        max="105"
                        required
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Gender
                      </label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="form-control"
                      >
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Clinical Coding & Payer */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                  <Layers size={16} color="#059669" />
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    2. Payer & Clinical Codes
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                      Insurance Provider
                    </label>
                    <select
                      name="insuranceProvider"
                      value={formData.insuranceProvider}
                      onChange={handleInputChange}
                      className="form-control"
                    >
                      <option value="Medicare">Medicare</option>
                      <option value="Blue Cross Blue Shield">Blue Cross Blue Shield</option>
                      <option value="UnitedHealthcare">UnitedHealthcare</option>
                      <option value="Humana">Humana</option>
                      <option value="Cigna">Cigna</option>
                      <option value="Aetna">Aetna</option>
                      <option value="Medicaid">Medicaid</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Procedure Code (CPT)
                      </label>
                      <input
                        type="text"
                        name="procedureCode"
                        value={formData.procedureCode}
                        onChange={handleInputChange}
                        className="form-control"
                        placeholder="CPT 99214"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Diagnosis Code (ICD)
                      </label>
                      <input
                        type="text"
                        name="diagnosisCode"
                        value={formData.diagnosisCode}
                        onChange={handleInputChange}
                        className="form-control"
                        placeholder="ICD-10 I10"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Claim Amount ($)
                      </label>
                      <input
                        type="number"
                        name="claimAmount"
                        value={formData.claimAmount}
                        onChange={handleInputChange}
                        min="50"
                        step="50"
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        No. of Procedures
                      </label>
                      <input
                        type="number"
                        name="numberOfProcedures"
                        value={formData.numberOfProcedures}
                        onChange={handleInputChange}
                        min="1"
                        max="8"
                        className="form-control"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Adjudication & Payment History */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  padding: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                  <DollarSign size={16} color="#d97706" />
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                    3. History & Financial Risk
                  </h4>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Previous Claims
                      </label>
                      <input
                        type="number"
                        name="previousClaimsCount"
                        value={formData.previousClaimsCount}
                        onChange={handleInputChange}
                        min="0"
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Previous Paid Claims
                      </label>
                      <input
                        type="number"
                        name="previousPaidClaims"
                        value={formData.previousPaidClaims}
                        onChange={handleInputChange}
                        min="0"
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#dc2626', marginBottom: 4 }}>
                        Previous Denials ⚠
                      </label>
                      <input
                        type="number"
                        name="previousDenials"
                        value={formData.previousDenials}
                        onChange={handleInputChange}
                        min="0"
                        className="form-control"
                        style={{ borderColor: formData.previousDenials > 1 ? '#f87171' : undefined }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Previous Unpaid
                      </label>
                      <input
                        type="number"
                        name="previousUnpaidClaims"
                        value={formData.previousUnpaidClaims}
                        onChange={handleInputChange}
                        min="0"
                        className="form-control"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Outstanding Balance ($)
                      </label>
                      <input
                        type="number"
                        name="outstandingAmount"
                        value={formData.outstandingAmount}
                        onChange={handleInputChange}
                        min="0"
                        step="50"
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                        Days Aging
                      </label>
                      <input
                        type="number"
                        name="daysSinceClaimSubmission"
                        value={formData.daysSinceClaimSubmission}
                        onChange={handleInputChange}
                        min="1"
                        max="180"
                        className="form-control"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Run Prediction Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
              >
                Reset Fields
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isPredicting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: '#2563eb',
                  padding: '11px 24px'
                }}
              >
                {isPredicting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Evaluating Random Forest...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Run AI Payment Prediction</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* ------------------------------------------------------------- */}
          {/* PREDICTION RESULTS SECTION                                    */}
          {/* ------------------------------------------------------------- */}
          {predictionResult && (
            <div
              className="animate-fade-in"
              style={{
                marginTop: 28,
                padding: 24,
                borderRadius: 'var(--radius-lg)',
                border: predictionResult.prediction === 'Paid' ? '2px solid #86efac' : '2px solid #fca5a5',
                background: predictionResult.prediction === 'Paid'
                  ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)'
                  : 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)'
              }}
            >
              {/* Top Result Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  paddingBottom: 20,
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: predictionResult.prediction === 'Paid' ? '#dcfce7' : '#fee2e2',
                      color: predictionResult.prediction === 'Paid' ? '#16a34a' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                    }}
                  >
                    {predictionResult.prediction === 'Paid' ? (
                      <CheckCircle2 size={32} />
                    ) : (
                      <XCircle size={32} />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: '1.5rem',
                          fontWeight: 900,
                          color: predictionResult.prediction === 'Paid' ? '#15803d' : '#b91c1c'
                        }}
                      >
                        PREDICTION: {predictionResult.prediction.toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 800,
                          padding: '4px 12px',
                          borderRadius: 9999,
                          backgroundColor:
                            predictionResult.riskLevel === 'Low Risk'
                              ? '#dcfce7'
                              : predictionResult.riskLevel === 'Medium Risk'
                              ? '#fef3c7'
                              : '#fee2e2',
                          color:
                            predictionResult.riskLevel === 'Low Risk'
                              ? '#15803d'
                              : predictionResult.riskLevel === 'Medium Risk'
                              ? '#b45309'
                              : '#be123c',
                          border: `1px solid ${
                            predictionResult.riskLevel === 'Low Risk'
                              ? '#86efac'
                              : predictionResult.riskLevel === 'Medium Risk'
                              ? '#fde68a'
                              : '#fca5a5'
                          }`
                        }}
                      >
                        {predictionResult.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Claim {formData.claimId} • Amount: ${formData.claimAmount.toLocaleString()} • Payer: {formData.insuranceProvider}
                    </span>
                  </div>
                </div>

                {/* Probability Meter */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Payment Probability
                  </div>
                  <div
                    style={{
                      fontSize: '2rem',
                      fontWeight: 900,
                      color:
                        predictionResult.probability >= 0.8
                          ? '#15803d'
                          : predictionResult.probability >= 0.5
                          ? '#d97706'
                          : '#dc2626'
                    }}
                  >
                    {Math.round(predictionResult.probability * 100)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Ensemble consensus: {predictionResult.votesPaid} of {predictionResult.votesTotal} decision trees
                  </div>
                </div>
              </div>

              {/* Probability Progress Bar */}
              <div style={{ margin: '18px 0 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: 6 }}>
                  <span>High Risk (&lt; 50%)</span>
                  <span>Medium Risk (50% – 79%)</span>
                  <span>Low Risk (80%+)</span>
                </div>
                <div style={{ width: '100%', height: 10, backgroundColor: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round(predictionResult.probability * 100)}%`,
                      height: '100%',
                      backgroundColor:
                        predictionResult.probability >= 0.8
                          ? '#16a34a'
                          : predictionResult.probability >= 0.5
                          ? '#f59e0b'
                          : '#ef4444',
                      borderRadius: 9999,
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>
              </div>

              {/* Factors Influencing This Prediction */}
              <div>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Key Factors Influencing This Prediction:</span>
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {predictionResult.topFactors.map((factor, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#ffffff',
                        border: factor.impact === 'positive' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: factor.impact === 'positive' ? '#dcfce7' : '#fee2e2',
                          color: factor.impact === 'positive' ? '#16a34a' : '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 2
                        }}
                      >
                        {factor.impact === 'positive' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: factor.impact === 'positive' ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {factor.factor}
                        </div>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78125rem', color: '#475569', lineHeight: 1.4 }}>
                          {factor.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                  Demo Prediction – Trained using synthetic historical claim data
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveToRegistry}
                    disabled={isSaved}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: isSaved ? '#059669' : '#2563eb'
                    }}
                  >
                    {isSaved ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Added to Claims Registry</span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        <span>Add Claim to Dashboard Table</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
