import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BarChart3,
  Cpu,
  FileCheck2,
  Database,
  Eye
} from 'lucide-react';
import type {
  ClaimRecord,
  ModelMetrics,
  PaymentPredictionStats,
  RiskLevel,
  PaymentStatus
} from '../types/paymentPrediction';
import { paymentPredictionService } from '../services/paymentPredictionService';
import { PredictNewClaimModal } from '../components/PredictNewClaimModal';
import { ClaimDetailsModal } from '../components/ClaimDetailsModal';

interface PaymentPredictionPageProps {
  onSuccess?: (msg: string) => void;
}

export const PaymentPredictionPage: React.FC<PaymentPredictionPageProps> = ({ onSuccess }) => {
  // Loading & Data State
  const [isLoading, setIsLoading] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [stats, setStats] = useState<PaymentPredictionStats | null>(null);

  // Table & Filter State
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [totalClaims, setTotalClaims] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(12);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<RiskLevel | 'All'>('All');
  const [selectedPrediction, setSelectedPrediction] = useState<PaymentStatus | 'All'>('All');

  // Modals
  const [isPredictModalOpen, setIsPredictModalOpen] = useState(false);
  const [selectedClaimForDetails, setSelectedClaimForDetails] = useState<ClaimRecord | null>(null);

  // Load / Initialize Service
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const initRes = await paymentPredictionService.initialize();
      setMetrics(initRes.metrics);
      setStats(initRes.stats);

      const tableRes = paymentPredictionService.getClaims({
        searchQuery,
        provider: selectedProvider,
        riskLevel: selectedRiskLevel,
        prediction: selectedPrediction,
        page: currentPage,
        limit: pageSize
      });

      setClaims(tableRes.data);
      setTotalClaims(tableRes.total);
      setTotalPages(tableRes.totalPages);
    } catch (e) {
      console.error('Error loading prediction dashboard data', e);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedProvider, selectedRiskLevel, selectedPrediction, currentPage, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh Table Data
  const refreshTableOnly = useCallback(() => {
    const tableRes = paymentPredictionService.getClaims({
      searchQuery,
      provider: selectedProvider,
      riskLevel: selectedRiskLevel,
      prediction: selectedPrediction,
      page: currentPage,
      limit: pageSize
    });
    setClaims(tableRes.data);
    setTotalClaims(tableRes.total);
    setTotalPages(tableRes.totalPages);
    setStats(paymentPredictionService.getSummaryStats());
  }, [searchQuery, selectedProvider, selectedRiskLevel, selectedPrediction, currentPage, pageSize]);

  useEffect(() => {
    if (!isLoading) {
      refreshTableOnly();
    }
  }, [searchQuery, selectedProvider, selectedRiskLevel, selectedPrediction, currentPage, refreshTableOnly, isLoading]);

  // Model Retrain Handler
  const handleRetrainModel = () => {
    setIsRetraining(true);
    setTimeout(() => {
      const retrainRes = paymentPredictionService.retrainModel();
      setMetrics(retrainRes.metrics);
      setStats(retrainRes.stats);
      refreshTableOnly();
      setIsRetraining(false);
      if (onSuccess) {
        if (retrainRes.metrics) {
          onSuccess(`✓ Random Forest Model evaluated across ${claims.length} claim records! Test Accuracy: ${retrainRes.metrics.accuracy}%`);
        } else {
          onSuccess(`✓ Model registry refreshed. Add at least 5 claim records to train test-split metrics.`);
        }
      }
    }, 600);
  };

  const handleClaimAdded = (newClaim: ClaimRecord) => {
    refreshTableOnly();
    if (onSuccess) {
      onSuccess(`✓ Claim ${newClaim.claimId} predicted as ${newClaim.predictedStatus?.toUpperCase()} (${Math.round((newClaim.paymentProbability || 0.8) * 100)}% prob) and saved to table!`);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedProvider('All');
    setSelectedRiskLevel('All');
    setSelectedPrediction('All');
    setCurrentPage(1);
  };

  return (
    <div className="page-body animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* ------------------------------------------------------------- */}
      {/* TOP COMPLIANCE & DEMO BANNER                                   */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, #0b1528 0%, #1e293b 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 4px 20px rgba(11, 21, 40, 0.15)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Cpu size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                PAYMENT PREDICTION
              </h2>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  padding: '3px 9px',
                  borderRadius: 9999,
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
                }}
              >
                {stats && stats.totalClaimsAnalyzed > 0 ? `${stats.totalClaimsAnalyzed} Claims Evaluated` : 'Live Evaluation Engine'}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: '1px solid rgba(147, 197, 253, 0.25)'
                }}
              >
                Random Forest Classifier • 28 Decision Trees
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
              Pre-submission claim reimbursement forecasting & risk stratification powered by Random Forest ML
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRetrainModel}
            disabled={isRetraining}
            style={{
              fontSize: '0.8125rem',
              color: '#ffffff',
              borderColor: 'rgba(255,255,255,0.2)',
              backgroundColor: 'rgba(255,255,255,0.06)'
            }}
          >
            <RefreshCw size={14} className={isRetraining ? 'animate-spin' : ''} />
            <span>{isRetraining ? 'Evaluating Model...' : 'Evaluate / Train Model'}</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsPredictModalOpen(true)}
            style={{
              backgroundColor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.875rem',
              padding: '9px 18px'
            }}
          >
            <Plus size={18} />
            <span>+ Predict New Claim</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5 TOP SUMMARY STATS CARDS                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 24 }}>
        {/* Card 1: Total Claims Analyzed */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper blue">
              <Database size={22} />
            </div>
            <div>
              <div className="stat-label-title">Total Claims Analyzed</div>
              <div className="stat-count-value">
                {stats ? stats.totalClaimsAnalyzed.toLocaleString() : 0}
              </div>
            </div>
          </div>
          <div className="stat-action-link blue">
            <span>
              {metrics && stats && stats.totalClaimsAnalyzed > 0
                ? `${metrics.trainCount} Train / ${metrics.testCount} Test Split`
                : 'Awaiting claim evaluation data'}
            </span>
          </div>
        </div>

        {/* Card 2: Predicted Paid Claims */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper green">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="stat-label-title">Predicted Paid Claims</div>
              <div className="stat-count-value" style={{ color: '#16a34a' }}>
                {stats ? stats.predictedPaidClaims.toLocaleString() : 0}
              </div>
            </div>
          </div>
          <div className="stat-action-link green">
            <span>{stats && stats.totalClaimsAnalyzed > 0 ? `${stats.paidPercentage}% approval forecast` : '0% approval forecast'}</span>
          </div>
        </div>

        {/* Card 3: Predicted Unpaid Claims */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper red">
              <XCircle size={22} />
            </div>
            <div>
              <div className="stat-label-title">Predicted Unpaid Claims</div>
              <div className="stat-count-value" style={{ color: '#dc2626' }}>
                {stats ? stats.predictedUnpaidClaims.toLocaleString() : 0}
              </div>
            </div>
          </div>
          <div className="stat-action-link red">
            <span>{stats && stats.totalClaimsAnalyzed > 0 ? `${stats.unpaidPercentage}% denial / non-pay risk` : '0% denial risk'}</span>
          </div>
        </div>

        {/* Card 4: Average Payment Probability */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper purple">
              <TrendingUp size={22} />
            </div>
            <div>
              <div className="stat-label-title">Average Payment Probability</div>
              <div className="stat-count-value" style={{ color: '#7e22ce' }}>
                {stats && stats.totalClaimsAnalyzed > 0 ? `${stats.averagePaymentProbability}%` : '0%'}
              </div>
            </div>
          </div>
          <div className="stat-action-link purple">
            <span>{stats && stats.totalClaimsAnalyzed > 0 ? 'Across evaluated claims' : 'No claim predictions recorded'}</span>
          </div>
        </div>

        {/* Card 5: High Risk Claims */}
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon-wrapper orange">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="stat-label-title">High Risk Claims</div>
              <div className="stat-count-value" style={{ color: '#d97706' }}>
                {stats ? stats.highRiskClaimsCount.toLocaleString() : 0}
              </div>
            </div>
          </div>
          <div className="stat-action-link orange">
            <span>{stats && stats.totalClaimsAnalyzed > 0 ? `${stats.highRiskPercentage}% probability < 50%` : '0 high-risk claims'}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODEL PERFORMANCE & FEATURE IMPORTANCE SECTION                 */}
      {/* ------------------------------------------------------------- */}
      <div
        className="form-section-card"
        style={{
          marginBottom: 24,
          padding: 24,
          background: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Random Forest Model Architecture & Performance
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                {metrics && metrics.testCount > 0
                  ? `Evaluated on held-out test split (${metrics.testCount} evaluated claims) • Gini impurity split criterion`
                  : 'Multi-tree ensemble evaluated using Gini impurity split criterion'}
              </p>
            </div>
          </div>

          {/* Model Accuracy Metrics Chips */}
          {metrics && metrics.testCount > 0 ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                  Model Accuracy
                </div>
                <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: '#15803d' }}>
                  {metrics.accuracy}%
                </div>
              </div>

              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Precision
                </div>
                <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: '#1d4ed8' }}>
                  {metrics.precision}%
                </div>
              </div>

              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  backgroundColor: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase' }}>
                  Recall
                </div>
                <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: '#7e22ce' }}>
                  {metrics.recall}%
                </div>
              </div>

              <div
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  F1 Score
                </div>
                <div style={{ fontSize: '1.1875rem', fontWeight: 800, color: '#b45309' }}>
                  {metrics.f1Score}%
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '0.8125rem',
                fontWeight: 600
              }}
            >
              No model results available
            </div>
          )}
        </div>

        {/* 2-Column Grid: Feature Importance & ML Pipeline / Confusion Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {/* Column A: Feature Importance from Random Forest */}
          <div
            style={{
              padding: 16,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Feature Importance (Mean Decrease in Impurity)
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Top Predictors</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {metrics && metrics.featureImportances && metrics.featureImportances.length > 0 ? (
                metrics.featureImportances.slice(0, 6).map((feat, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78125rem', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{feat.label}</span>
                      <span style={{ fontWeight: 700, color: '#2563eb' }}>{feat.importance}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, feat.importance * 3.5)}%`,
                          height: '100%',
                          backgroundColor: i === 0 ? '#2563eb' : i === 1 ? '#3b82f6' : i === 2 ? '#60a5fa' : '#93c5fd',
                          borderRadius: 9999
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    No feature importance data available
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: '#94a3b8' }}>
                    Feature weights will be computed once the Random Forest model is trained on evaluated claims.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column B: Confusion Matrix & ML Workflow */}
          <div
            style={{
              padding: 16,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Test Set Confusion Matrix
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {metrics && metrics.testCount > 0 ? `Evaluated ${metrics.testCount} Claims` : 'Test Evaluation'}
                </span>
              </div>

              {metrics && metrics.confusionMatrix && metrics.testCount > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ padding: '10px 12px', backgroundColor: '#dcfce7', borderRadius: 8, border: '1px solid #86efac' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534' }}>TRUE POSITIVE (TP)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                      {metrics.confusionMatrix.truePositives}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#166534' }}>Predicted Paid & Paid</div>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#991b1b' }}>FALSE POSITIVE (FP)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>
                      {metrics.confusionMatrix.falsePositives}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#991b1b' }}>Predicted Paid, Unpaid</div>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#991b1b' }}>FALSE NEGATIVE (FN)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626' }}>
                      {metrics.confusionMatrix.falseNegatives}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#991b1b' }}>Predicted Unpaid, Paid</div>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: '#dcfce7', borderRadius: 8, border: '1px solid #86efac' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534' }}>TRUE NEGATIVE (TN)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                      {metrics.confusionMatrix.trueNegatives}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#166534' }}>Predicted Unpaid & Unpaid</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b', marginBottom: 14 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    No model evaluation results available
                  </div>
                  <div style={{ fontSize: '0.78125rem', color: '#94a3b8' }}>
                    Confusion matrix metrics will be generated upon model training.
                  </div>
                </div>
              )}
            </div>

            {/* Workflow Breadcrumb Strip */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                ML Pipeline Flow:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: '0.71875rem', color: '#475569' }}>
                <span style={{ fontWeight: 600, color: '#2563eb' }}>Claims Ingestion</span>
                <span>→</span>
                <span>Data Cleaning</span>
                <span>→</span>
                <span>Feature Encoding</span>
                <span>→</span>
                <span>Train/Test Split</span>
                <span>→</span>
                <span style={{ fontWeight: 600, color: '#059669' }}>Random Forest</span>
                <span>→</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>Paid / Unpaid</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN DASHBOARD PREDICTION TABLE CARD                           */}
      {/* ------------------------------------------------------------- */}
      <div className="dashboard-main-card">
        {/* Card Header */}
        <div className="dashboard-card-header">
          <div className="card-header-left">
            <div className="card-header-icon-box">
              <FileCheck2 size={22} />
            </div>
            <div>
              <div className="card-header-title">Claim Payment Predictions & Risk Stratification</div>
              <div className="card-header-sub">
                {claims.length > 0
                  ? `Showing ${claims.length} of ${totalClaims} analyzed insurance claims • Real-time probability scoring`
                  : '0 analyzed insurance claims • Real-time probability scoring'}
              </div>
            </div>
          </div>

          <div className="card-header-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsPredictModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={16} />
              <span>+ Predict New Claim</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="filter-search-box">
            <Search size={16} className="filter-search-icon" />
            <input
              type="text"
              className="filter-search-input"
              placeholder="Search Claim ID, Diagnosis, CPT, Payer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Insurance Provider Filter */}
          <select
            className="filter-select"
            value={selectedProvider}
            onChange={(e) => {
              setSelectedProvider(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All Payers</option>
            <option value="Medicare">Medicare</option>
            <option value="Blue Cross Blue Shield">Blue Cross Blue Shield</option>
            <option value="UnitedHealthcare">UnitedHealthcare</option>
            <option value="Humana">Humana</option>
            <option value="Cigna">Cigna</option>
            <option value="Aetna">Aetna</option>
            <option value="Medicaid">Medicaid</option>
          </select>

          {/* Risk Level Filter */}
          <select
            className="filter-select"
            value={selectedRiskLevel}
            onChange={(e) => {
              setSelectedRiskLevel(e.target.value as RiskLevel | 'All');
              setCurrentPage(1);
            }}
          >
            <option value="All">All Risk Levels</option>
            <option value="Low Risk">Low Risk (80%+)</option>
            <option value="Medium Risk">Medium Risk (50%–79%)</option>
            <option value="High Risk">High Risk (&lt; 50%)</option>
          </select>

          {/* Prediction Filter */}
          <select
            className="filter-select"
            value={selectedPrediction}
            onChange={(e) => {
              setSelectedPrediction(e.target.value as PaymentStatus | 'All');
              setCurrentPage(1);
            }}
          >
            <option value="All">All Predictions</option>
            <option value="Paid">PAID Only</option>
            <option value="Unpaid">UNPAID Only</option>
          </select>

          {(searchQuery || selectedProvider !== 'All' || selectedRiskLevel !== 'All' || selectedPrediction !== 'All') && (
            <button
              type="button"
              className="filter-clear-btn"
              onClick={handleClearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Claims Prediction Table */}
        <div className="table-container">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Clinical Service</th>
                <th>Insurance Provider</th>
                <th>Claim Amount</th>
                <th>Prediction</th>
                <th>Payment Probability</th>
                <th>Risk Level</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <FileCheck2 size={36} color="#94a3b8" />
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                        {searchQuery || selectedProvider !== 'All' || selectedRiskLevel !== 'All' || selectedPrediction !== 'All'
                          ? 'No claims matched current filters'
                          : 'No prediction data available'}
                      </div>
                      <div style={{ fontSize: '0.875rem', maxWidth: 440 }}>
                        {searchQuery || selectedProvider !== 'All' || selectedRiskLevel !== 'All' || selectedPrediction !== 'All'
                          ? 'Try clearing your search query or changing the filter selections.'
                          : 'There are currently no claim payment predictions recorded. Click "+ Predict New Claim" to evaluate a claim through the Random Forest model.'}
                      </div>
                      {searchQuery || selectedProvider !== 'All' || selectedRiskLevel !== 'All' || selectedPrediction !== 'All' ? (
                        <button type="button" className="btn-secondary" onClick={handleClearFilters} style={{ marginTop: 8 }}>
                          Reset Filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setIsPredictModalOpen(true)}
                          style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Plus size={16} />
                          <span>+ Predict New Claim</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                claims.map((claim) => {
                  const isPaid = claim.predictedStatus === 'Paid';
                  const prob = claim.paymentProbability ?? 0.8;
                  const probPercent = Math.round(prob * 100);
                  const risk = claim.riskLevel || (prob >= 0.8 ? 'Low Risk' : prob >= 0.5 ? 'Medium Risk' : 'High Risk');

                  return (
                    <tr
                      key={claim.claimId}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedClaimForDetails(claim)}
                    >
                      {/* Claim ID */}
                      <td style={{ fontWeight: 700 }}>
                        <span className="apt-code-link" style={{ fontSize: '0.875rem' }}>
                          {claim.claimId}
                        </span>
                        <div style={{ fontSize: '0.71875rem', color: '#94a3b8' }}>
                          {claim.procedureCode}
                        </div>
                      </td>

                      {/* Clinical Service */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {claim.department}
                        </div>
                        <div style={{ fontSize: '0.71875rem', color: '#64748b' }}>
                          {claim.claimType} • {claim.doctor}
                        </div>
                      </td>

                      {/* Insurance Provider */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: '#334155',
                              backgroundColor: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: 6
                            }}
                          >
                            {claim.insuranceProvider}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.71875rem', color: '#94a3b8', marginTop: 2 }}>
                          {claim.diagnosisCode}
                        </div>
                      </td>

                      {/* Claim Amount */}
                      <td style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9375rem' }}>
                        ${claim.claimAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        {claim.outstandingAmount > 0 && (
                          <div style={{ fontSize: '0.71875rem', color: '#dc2626', fontWeight: 500 }}>
                            Bal: ${claim.outstandingAmount.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* Prediction (PAID / UNPAID) */}
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 10px',
                            borderRadius: 9999,
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            backgroundColor: isPaid ? '#dcfce7' : '#fee2e2',
                            color: isPaid ? '#15803d' : '#b91c1c',
                            border: `1px solid ${isPaid ? '#86efac' : '#fca5a5'}`
                          }}
                        >
                          {isPaid ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {isPaid ? 'PAID' : 'UNPAID'}
                        </span>
                      </td>

                      {/* Payment Probability */}
                      <td style={{ minWidth: 140 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.875rem',
                              color: prob >= 0.8 ? '#15803d' : prob >= 0.5 ? '#b45309' : '#dc2626'
                            }}
                          >
                            {probPercent}%
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                            {claim.daysSinceClaimSubmission}d aged
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 6, backgroundColor: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${probPercent}%`,
                              height: '100%',
                              backgroundColor: prob >= 0.8 ? '#16a34a' : prob >= 0.5 ? '#f59e0b' : '#ef4444',
                              borderRadius: 9999
                            }}
                          />
                        </div>
                      </td>

                      {/* Risk Level */}
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: '0.71875rem',
                            fontWeight: 800,
                            letterSpacing: '0.03em',
                            backgroundColor:
                              risk === 'Low Risk' ? '#ecfdf5' : risk === 'Medium Risk' ? '#fffbeb' : '#fef2f2',
                            color:
                              risk === 'Low Risk' ? '#047857' : risk === 'Medium Risk' ? '#b45309' : '#b91c1c',
                            border: `1px solid ${
                              risk === 'Low Risk' ? '#a7f3d0' : risk === 'Medium Risk' ? '#fde68a' : '#fecaca'
                            }`
                          }}
                        >
                          {risk.toUpperCase()}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClaimForDetails(claim);
                          }}
                        >
                          <Eye size={13} />
                          <span>Inspect Factors</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Showing page <strong style={{ color: '#0f172a' }}>{currentPage}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong> ({totalClaims} total claims)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            {/* Numeric Page Buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum = idx + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = Math.min(totalPages - 4 + idx, currentPage - 2 + idx);
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 'var(--radius-sm)',
                    border: currentPage === pageNum ? 'none' : '1px solid #e2e8f0',
                    backgroundColor: currentPage === pageNum ? 'var(--primary-600)' : '#ffffff',
                    color: currentPage === pageNum ? '#ffffff' : '#475569',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              className="btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODALS                                                        */}
      {/* ------------------------------------------------------------- */}
      <PredictNewClaimModal
        isOpen={isPredictModalOpen}
        onClose={() => setIsPredictModalOpen(false)}
        onClaimAdded={handleClaimAdded}
      />

      <ClaimDetailsModal
        claim={selectedClaimForDetails}
        isOpen={!!selectedClaimForDetails}
        onClose={() => setSelectedClaimForDetails(null)}
      />
    </div>
  );
};
