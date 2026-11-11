import React from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import type { ClaimRecord } from '../types/paymentPrediction';
import { paymentPredictionService } from '../services/paymentPredictionService';

interface ClaimDetailsModalProps {
  claim: ClaimRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ClaimDetailsModal: React.FC<ClaimDetailsModalProps> = ({
  claim,
  isOpen,
  onClose
}) => {
  if (!isOpen || !claim) return null;

  // Generate real-time prediction factors for this specific claim
  const prediction = paymentPredictionService.predictNewClaim(claim);

  const isPaid = (claim.predictedStatus || prediction.prediction) === 'Paid';
  const prob = claim.paymentProbability ?? prediction.probability;
  const riskLevel = claim.riskLevel || prediction.riskLevel;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 0
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
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
                backgroundColor: isPaid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isPaid ? '#4ade80' : '#f87171'
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                  {claim.claimId}
                </h3>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: isPaid ? '#dcfce7' : '#fee2e2',
                    color: isPaid ? '#15803d' : '#b91c1c'
                  }}
                >
                  PREDICTED: {(claim.predictedStatus || prediction.prediction).toUpperCase()}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                Department: {claim.department} • Payer: {claim.insuranceProvider}
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
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {/* AI Score Banner */}
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: isPaid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${isPaid ? '#bbf7d0' : '#fecaca'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              flexWrap: 'wrap',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {isPaid ? (
                <CheckCircle2 size={36} color="#16a34a" />
              ) : (
                <XCircle size={36} color="#dc2626" />
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 800, color: isPaid ? '#15803d' : '#b91c1c' }}>
                    Payment Forecast: {isPaid ? 'PAID' : 'UNPAID'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      backgroundColor:
                        riskLevel === 'Low Risk' ? '#dcfce7' : riskLevel === 'Medium Risk' ? '#fef3c7' : '#fee2e2',
                      color:
                        riskLevel === 'Low Risk' ? '#15803d' : riskLevel === 'Medium Risk' ? '#b45309' : '#be123c'
                    }}
                  >
                    {riskLevel.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: 2 }}>
                  Random Forest consensus: {prediction.votesPaid} of {prediction.votesTotal} decision trees voted Paid
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Payment Probability
              </div>
              <div
                style={{
                  fontSize: '1.75rem',
                  fontWeight: 900,
                  color: prob >= 0.8 ? '#15803d' : prob >= 0.5 ? '#d97706' : '#dc2626'
                }}
              >
                {Math.round(prob * 100)}%
              </div>
            </div>
          </div>

          {/* Key Influencing Factors */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
              AI Model Explanation Factors:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
              {prediction.topFactors.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#ffffff',
                    border: f.impact === 'positive' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      backgroundColor: f.impact === 'positive' ? '#dcfce7' : '#fee2e2',
                      color: f.impact === 'positive' ? '#16a34a' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2
                    }}
                  >
                    {f.impact === 'positive' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: f.impact === 'positive' ? '#15803d' : '#b91c1c' }}>
                      {f.factor}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
                      {f.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical & Financial Breakdown Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Clinical & Encounter Details */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                backgroundColor: '#f8fafc'
              }}
            >
              <h5 style={{ margin: '0 0 12px', fontSize: '0.8125rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Clinical Details
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Department:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{claim.department}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Physician:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{claim.doctor}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Procedure (CPT):</span>
                  <span style={{ fontWeight: 600, color: '#2563eb' }}>{claim.procedureCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Diagnosis (ICD):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{claim.diagnosisCode}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Setting / Type:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{claim.claimType}</span>
                </div>
              </div>
            </div>

            {/* Financial & Adjudication History */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                backgroundColor: '#f8fafc'
              }}
            >
              <h5 style={{ margin: '0 0 12px', fontSize: '0.8125rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Financial & History
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Claim Amount:</span>
                  <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.9375rem' }}>
                    ${claim.claimAmount.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Payer:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{claim.insuranceProvider}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Outstanding Balance:</span>
                  <span style={{ fontWeight: 600, color: claim.outstandingAmount > 2000 ? '#dc2626' : '#0f172a' }}>
                    ${claim.outstandingAmount.toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Days Since Submission:</span>
                  <span style={{ fontWeight: 600, color: claim.daysSinceClaimSubmission > 60 ? '#d97706' : '#0f172a' }}>
                    {claim.daysSinceClaimSubmission} days
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Previous Claims History:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    {claim.previousPaidClaims} Paid / {claim.previousUnpaidClaims} Unpaid
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Previous Denials:</span>
                  <span style={{ fontWeight: 700, color: claim.previousDenials > 0 ? '#dc2626' : '#16a34a' }}>
                    {claim.previousDenials} denials recorded
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Notice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
              Demo Prediction – Trained using synthetic historical claim data
            </span>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
