import type {
  ClaimRecord,
  ClaimPredictionResult,
  ModelMetrics,
  PaymentPredictionStats,
  RiskLevel,
  PaymentStatus
} from '../types/paymentPrediction';
import { RandomForestClassifier } from './randomForestClassifier';

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

  constructor() {
    this.model = new RandomForestClassifier(28, 6, 6);
  }

  /**
   * Fetches real claims exclusively from /api/claims (Neon PostgreSQL) and trains Random Forest if >= 5 records exist.
   */
  public async initialize(): Promise<{ metrics: ModelMetrics | null; stats: PaymentPredictionStats }> {
    try {
      const res = await fetch('/api/claims?limit=500');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.claims = (json.data as ClaimRecord[]).map((c) => {
            if (!c.predictedStatus || c.paymentProbability === undefined || !c.riskLevel) {
              const pred = this.model.predictClaim(c);
              return {
                ...c,
                predictedStatus: c.predictedStatus || pred.prediction,
                paymentProbability: c.paymentProbability ?? pred.probability,
                riskLevel: c.riskLevel || pred.riskLevel,
              };
            }
            return c;
          });
        } else {
          this.claims = [];
        }
      } else {
        this.claims = [];
      }
    } catch (err) {
      console.error('[paymentPredictionService] Failed to fetch claims from API:', err);
      this.claims = [];
    }

    if (this.claims.length >= 5) {
      this.metrics = this.model.train(this.claims);
    } else {
      this.metrics = null;
    }

    return {
      metrics: this.metrics,
      stats: this.getSummaryStats(),
    };
  }

  public retrainModel(): { metrics: ModelMetrics | null; stats: PaymentPredictionStats } {
    if (this.claims.length >= 5) {
      this.metrics = this.model.train(this.claims);
    } else {
      this.metrics = null;
    }

    return {
      metrics: this.metrics,
      stats: this.getSummaryStats(),
    };
  }

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
        predictedAtRiskAmount: 0,
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
      const prob = claim.paymentProbability ?? 0;
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
      predictedAtRiskAmount: atRiskAmount,
    };
  }

  public getClaims(options: ClaimsFilterOptions = {}): PaginatedClaimsResult {
    const {
      searchQuery = '',
      provider = 'All',
      riskLevel = 'All',
      prediction = 'All',
      page = 1,
      limit = 12,
    } = options;

    let filtered = [...this.claims];

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

    if (provider && provider !== 'All') {
      filtered = filtered.filter((c) => c.insuranceProvider.toLowerCase().includes(provider.toLowerCase()));
    }

    if (riskLevel && riskLevel !== 'All') {
      filtered = filtered.filter((c) => c.riskLevel === riskLevel);
    }

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
      limit,
    };
  }

  public predictNewClaim(claimInput: Partial<ClaimRecord>): ClaimPredictionResult {
    const fullRecord: ClaimRecord = {
      claimId: claimInput.claimId || `CLM-${Math.floor(2000 + Math.random() * 8000)}`,
      patientId: claimInput.patientId || '',
      patientName: claimInput.patientName || '',
      patientAge: Number(claimInput.patientAge) || 0,
      gender: claimInput.gender || 'Other',
      department: claimInput.department || '',
      doctor: claimInput.doctor || '',
      insuranceProvider: claimInput.insuranceProvider || '',
      claimAmount: Number(claimInput.claimAmount) || 0,
      procedureCode: claimInput.procedureCode || '',
      procedureDescription: claimInput.procedureDescription || '',
      diagnosisCode: claimInput.diagnosisCode || '',
      diagnosisDescription: claimInput.diagnosisDescription || '',
      numberOfProcedures: Number(claimInput.numberOfProcedures) || 1,
      previousClaimsCount: Number(claimInput.previousClaimsCount) || 0,
      previousPaidClaims: Number(claimInput.previousPaidClaims) || 0,
      previousUnpaidClaims: Number(claimInput.previousUnpaidClaims) || 0,
      previousDenials: Number(claimInput.previousDenials) || 0,
      outstandingAmount: Number(claimInput.outstandingAmount) || 0,
      daysSinceClaimSubmission: Number(claimInput.daysSinceClaimSubmission) || 0,
      claimType: claimInput.claimType || 'Outpatient',
      finalPaymentStatus: 'Paid',
    };

    return this.model.predictClaim(fullRecord);
  }

  public async addClaimToRegistry(record: ClaimRecord, prediction: ClaimPredictionResult): Promise<ClaimRecord> {
    const enrichedRecord: ClaimRecord = {
      ...record,
      predictedStatus: prediction.prediction,
      paymentProbability: prediction.probability,
      riskLevel: prediction.riskLevel,
      finalPaymentStatus: prediction.prediction,
    };

    const claimRes = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...enrichedRecord,
        claimStatus: 'Submitted',
      }),
    });

    if (!claimRes.ok) {
      const errJson = await claimRes.json().catch(() => ({}));
      throw new Error(errJson.message || 'Failed to save claim to database.');
    }

    const savedJson = await claimRes.json();
    const savedClaim: ClaimRecord = savedJson.data || enrichedRecord;

    await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimId: savedClaim.claimId,
        prediction: prediction.prediction,
        probability: prediction.probability,
        riskLevel: prediction.riskLevel,
        votesPaid: prediction.votesPaid,
        votesUnpaid: prediction.votesUnpaid,
        votesTotal: prediction.votesTotal,
        topFactors: prediction.topFactors,
        inputFeatures: savedClaim,
      }),
    }).catch((err) => console.warn('[paymentPredictionService] Prediction log error:', err));

    this.claims.unshift(savedClaim);

    if (this.claims.length >= 5) {
      this.metrics = this.model.train(this.claims);
    }

    return savedClaim;
  }

  public getModelMetrics(): ModelMetrics | null {
    return this.metrics || this.model.getMetrics();
  }

  public getDatasetLabel(): string {
    return 'Neon PostgreSQL Claims Registry';
  }
}

export const paymentPredictionService = new PaymentPredictionService();
