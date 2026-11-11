import type {
  ClaimRecord,
  ClaimPredictionResult,
  ModelMetrics,
  PaymentPredictionStats,
  RiskLevel,
  PaymentStatus
} from '../types/paymentPrediction';
import { RandomForestClassifier } from './randomForestClassifier';

const STORAGE_KEY_CUSTOM_CLAIMS = 'medicare_rcm_claims_registry_v2';

// Purge any legacy synthetic claims from localStorage
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('medicare_rcm_custom_claims_v1');
  } catch {
    // Ignore error
  }
}

export interface ClaimsFilterOptions {
  searchQuery?: string;
  provider?: string;
  riskLevel?: RiskLevel | 'All';
  prediction?: PaymentStatus | 'All';
  page?: number;
  limit?: number;
}

export interface PaginatedClaimsResult {
  data: ClaimRecord[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

class PaymentPredictionService {
  private model: RandomForestClassifier;
  private claims: ClaimRecord[] = [];
  private metrics: ModelMetrics | null = null;
  private isInitialized = false;

  constructor() {
    this.model = new RandomForestClassifier(28, 6, 6);
  }

  /**
   * Initializes dataset and trains the Random Forest model on real available claims
   */
  public async initialize(): Promise<{ metrics: ModelMetrics | null; stats: PaymentPredictionStats }> {
    if (this.isInitialized) {
      return {
        metrics: this.metrics,
        stats: this.getSummaryStats()
      };
    }

    const baseClaims: ClaimRecord[] = [];

    // Load any user-created or persisted claims from localStorage
    try {
      const storedRaw = localStorage.getItem(STORAGE_KEY_CUSTOM_CLAIMS);
      if (storedRaw) {
        const customClaims: ClaimRecord[] = JSON.parse(storedRaw);
        if (Array.isArray(customClaims)) {
          baseClaims.push(...customClaims);
        }
      }
    } catch (e) {
      console.warn('Could not read stored claims', e);
    }

    this.claims = baseClaims;

    // Only compute model metrics if real claim records exist
    if (this.claims.length >= 5) {
      this.metrics = this.model.train(this.claims);
    } else {
      this.metrics = null;
    }

    this.isInitialized = true;

    return {
      metrics: this.metrics,
      stats: this.getSummaryStats()
    };
  }

  /**
   * Retrains model from scratch on available real claim records
   */
  public retrainModel(): { metrics: ModelMetrics | null; stats: PaymentPredictionStats } {
    if (this.claims.length >= 5) {
      this.metrics = this.model.train(this.claims);
    } else {
      this.metrics = null;
    }

    return {
      metrics: this.metrics,
      stats: this.getSummaryStats()
    };
  }

  /**
   * Computes top-level dashboard summary cards
   */
  public getSummaryStats(): PaymentPredictionStats {
    const total = this.claims.length;
    if (total === 0) {
      return {
        totalClaimsAnalyzed: 0,
        predictedPaidClaims: 0,
        predictedUnpaidClaims: 0,
        paidPercentage: 0,
        unpaidPercentage: 0,
        averagePaymentProbability: 0,
        highRiskClaimsCount: 0,
        highRiskPercentage: 0,
        mediumRiskClaimsCount: 0,
        lowRiskClaimsCount: 0,
        totalAmountAnalyzed: 0,
        predictedPaidAmount: 0,
        predictedAtRiskAmount: 0
      };
    }

    let paidCount = 0;
    let unpaidCount = 0;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    let sumProbability = 0;
    let totalAmount = 0;
    let paidAmount = 0;
    let atRiskAmount = 0;

    for (const claim of this.claims) {
      const prob = claim.paymentProbability ?? 0.8;
      sumProbability += prob;
      totalAmount += claim.claimAmount;

      if (claim.predictedStatus === 'Paid') {
        paidCount++;
        paidAmount += claim.claimAmount;
      } else {
        unpaidCount++;
        atRiskAmount += claim.claimAmount;
      }

      if (claim.riskLevel === 'High Risk') {
        highRiskCount++;
      } else if (claim.riskLevel === 'Medium Risk') {
        mediumRiskCount++;
      } else {
        lowRiskCount++;
      }
    }

    return {
      totalClaimsAnalyzed: total,
      predictedPaidClaims: paidCount,
      predictedUnpaidClaims: unpaidCount,
      paidPercentage: Number(((paidCount / total) * 100).toFixed(1)),
      unpaidPercentage: Number(((unpaidCount / total) * 100).toFixed(1)),
      averagePaymentProbability: Number(((sumProbability / total) * 100).toFixed(1)),
      highRiskClaimsCount: highRiskCount,
      highRiskPercentage: Number(((highRiskCount / total) * 100).toFixed(1)),
      mediumRiskClaimsCount: mediumRiskCount,
      lowRiskClaimsCount: lowRiskCount,
      totalAmountAnalyzed: totalAmount,
      predictedPaidAmount: paidAmount,
      predictedAtRiskAmount: atRiskAmount
    };
  }

  /**
   * Retrieves paginated, filtered claims
   */
  public getClaims(options: ClaimsFilterOptions = {}): PaginatedClaimsResult {
    const {
      searchQuery = '',
      provider = 'All',
      riskLevel = 'All',
      prediction = 'All',
      page = 1,
      limit = 12
    } = options;

    let filtered = [...this.claims];

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.claimId.toLowerCase().includes(q) ||
          (c.patientName ? c.patientName.toLowerCase().includes(q) : false) ||
          (c.patientId ? c.patientId.toLowerCase().includes(q) : false) ||
          c.procedureCode.toLowerCase().includes(q) ||
          (c.procedureDescription && c.procedureDescription.toLowerCase().includes(q)) ||
          c.diagnosisCode.toLowerCase().includes(q) ||
          c.insuranceProvider.toLowerCase().includes(q) ||
          c.doctor.toLowerCase().includes(q)
      );
    }

    // Insurance Provider Filter
    if (provider && provider !== 'All') {
      filtered = filtered.filter((c) => c.insuranceProvider.toLowerCase().includes(provider.toLowerCase()));
    }

    // Risk Level Filter
    if (riskLevel && riskLevel !== 'All') {
      filtered = filtered.filter((c) => c.riskLevel === riskLevel);
    }

    // Prediction Filter
    if (prediction && prediction !== 'All') {
      filtered = filtered.filter((c) => c.predictedStatus === prediction);
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * limit;
    const pagedData = filtered.slice(startIdx, startIdx + limit);

    return {
      data: pagedData,
      total,
      page: safePage,
      totalPages,
      limit
    };
  }

  /**
   * Predicts payment for a new claim using the Random Forest model
   */
  public predictNewClaim(claimInput: Partial<ClaimRecord>): ClaimPredictionResult {
    // Build a standardized claim record with safe defaults
    const fullRecord: ClaimRecord = {
      claimId: claimInput.claimId || `CLM-${Math.floor(2000 + Math.random() * 8000)}`,
      patientId: claimInput.patientId || '',
      patientName: claimInput.patientName || '',
      patientAge: Number(claimInput.patientAge) || 45,
      gender: claimInput.gender || 'Female',
      department: claimInput.department || 'General Medicine',
      doctor: claimInput.doctor || 'Dr. Robert Davis',
      insuranceProvider: claimInput.insuranceProvider || 'Medicare',
      claimAmount: Number(claimInput.claimAmount) || 450,
      procedureCode: claimInput.procedureCode || 'CPT 99214',
      procedureDescription: claimInput.procedureDescription || 'Office Outpatient Visit',
      diagnosisCode: claimInput.diagnosisCode || 'ICD-10 E11.9',
      diagnosisDescription: claimInput.diagnosisDescription || 'Type 2 diabetes mellitus',
      numberOfProcedures: Number(claimInput.numberOfProcedures) || 1,
      previousClaimsCount: Number(claimInput.previousClaimsCount) || 0,
      previousPaidClaims: Number(claimInput.previousPaidClaims) || 0,
      previousUnpaidClaims: Number(claimInput.previousUnpaidClaims) || 0,
      previousDenials: Number(claimInput.previousDenials) || 0,
      outstandingAmount: Number(claimInput.outstandingAmount) || 0,
      daysSinceClaimSubmission: Number(claimInput.daysSinceClaimSubmission) || 14,
      claimType: claimInput.claimType || 'Outpatient',
      finalPaymentStatus: 'Paid'
    };

    return this.model.predictClaim(fullRecord);
  }

  /**
   * Appends newly submitted claim into active registry and localStorage
   */
  public addClaimToRegistry(record: ClaimRecord, prediction: ClaimPredictionResult): ClaimRecord {
    const enrichedRecord: ClaimRecord = {
      ...record,
      predictedStatus: prediction.prediction,
      paymentProbability: prediction.probability,
      riskLevel: prediction.riskLevel,
      finalPaymentStatus: prediction.prediction
    };

    this.claims.unshift(enrichedRecord);

    try {
      const storedRaw = localStorage.getItem(STORAGE_KEY_CUSTOM_CLAIMS);
      const existing: ClaimRecord[] = storedRaw ? JSON.parse(storedRaw) : [];
      existing.unshift(enrichedRecord);
      localStorage.setItem(STORAGE_KEY_CUSTOM_CLAIMS, JSON.stringify(existing.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to persist claim', e);
    }

    // Train or re-evaluate Random Forest model if 5 or more real claims exist
    if (this.claims.length >= 5) {
      this.metrics = this.model.train(this.claims);
    }

    return enrichedRecord;
  }

  public getModelMetrics(): ModelMetrics | null {
    return this.metrics || this.model.getMetrics();
  }

  public getDatasetLabel(): string {
    return 'Evaluated Claims Registry';
  }
}

export const paymentPredictionService = new PaymentPredictionService();
