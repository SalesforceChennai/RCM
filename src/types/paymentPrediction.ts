export type Gender = 'Male' | 'Female' | 'Other';
export type ClaimType = 'Inpatient' | 'Outpatient' | 'Emergency' | 'Telehealth';
export type PaymentStatus = 'Paid' | 'Unpaid';
export type RiskLevel = 'Low Risk' | 'Medium Risk' | 'High Risk';

export interface ClaimRecord {
  claimId: string;
  patientId?: string;
  patientName?: string;
  patientAge: number;
  gender: Gender;
  department: string;
  doctor: string;
  insuranceProvider: string;
  claimAmount: number;
  procedureCode: string;
  procedureDescription?: string;
  diagnosisCode: string;
  diagnosisDescription?: string;
  numberOfProcedures: number;
  previousClaimsCount: number;
  previousPaidClaims: number;
  previousUnpaidClaims: number;
  previousDenials: number;
  outstandingAmount: number;
  daysSinceClaimSubmission: number;
  claimType: ClaimType;
  finalPaymentStatus: PaymentStatus;
  
  // Model prediction fields (populated after analysis)
  predictedStatus?: PaymentStatus;
  paymentProbability?: number; // 0.00 to 1.00
  riskLevel?: RiskLevel;
}

export interface PredictionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface ClaimPredictionResult {
  claimId?: string;
  prediction: PaymentStatus;
  probability: number; // 0.00 to 1.00 (e.g. 0.92 for 92%)
  riskLevel: RiskLevel;
  votesPaid: number;
  votesUnpaid: number;
  votesTotal: number;
  topFactors: PredictionFactor[];
  inputFeatures?: Record<string, number | string>;
}

export interface FeatureImportance {
  feature: string;
  label: string;
  importance: number; // 0.0 to 1.0 (or %)
  category: 'clinical' | 'financial' | 'history' | 'administrative';
}

export interface ConfusionMatrix {
  truePositives: number;  // Actual Paid, Predicted Paid
  falsePositives: number; // Actual Unpaid, Predicted Paid
  trueNegatives: number;  // Actual Unpaid, Predicted Unpaid
  falseNegatives: number; // Actual Paid, Predicted Unpaid
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: ConfusionMatrix;
  trainCount: number;
  testCount: number;
  totalRecords: number;
  treesCount: number;
  featureImportances: FeatureImportance[];
  trainedAt: string;
}

export interface PaymentPredictionStats {
  totalClaimsAnalyzed: number;
  predictedPaidClaims: number;
  predictedUnpaidClaims: number;
  paidPercentage: number;
  unpaidPercentage: number;
  averagePaymentProbability: number;
  highRiskClaimsCount: number;
  highRiskPercentage: number;
  mediumRiskClaimsCount: number;
  lowRiskClaimsCount: number;
  totalAmountAnalyzed: number;
  predictedPaidAmount: number;
  predictedAtRiskAmount: number;
}
