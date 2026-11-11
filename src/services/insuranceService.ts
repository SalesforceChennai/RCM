import type {
  Patient,
  InsuranceInfo,
  InsuranceVerificationResult,
  Appointment,
  PatientRegistration,
  ProviderVerificationStatus,
  InsuranceCommunicationRequest,
  RequestTimelineStep,
  ChatMessage,
  ChatAttachment,
  TreatmentCostItem,
  TreatmentBillingItem
} from '../types';
import { storageService } from './storageService';

export interface InsuranceSearchResult {
  patient: Patient;
  appointment?: Appointment | null;
  registration?: PatientRegistration | null;
  insurance?: InsuranceInfo | null;
}

export interface ProviderStatusCheckResult {
  providerStatus: ProviderVerificationStatus;
  providerStatusCheckedAt: string;
  providerStatusReason: string;
}

export const insuranceService = {
  async getInsurance(patientId: string): Promise<InsuranceInfo | null> {
    try {
      const res = await fetch(`/api/insurance/${encodeURIComponent(patientId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          storageService.saveInsurance(json.data);
          return json.data;
        }
      }
    } catch {
      // Fallback
    }
    return storageService.getInsuranceByPatientId(patientId);
  },

  async checkProviderStatus(
    patientId: string,
    insuranceProvider: string,
    preferredStatus?: ProviderVerificationStatus
  ): Promise<ProviderStatusCheckResult> {
    const checkedAt = new Date().toISOString();
    let status: ProviderVerificationStatus = 'Accepted';
    let reason = '';

    if (preferredStatus) {
      status = preferredStatus;
      if (status === 'Accepted') {
        reason = 'Insurance provider contract is verified, in-network, and active on real-time payer clearinghouse.';
      } else if (status === 'Pending') {
        reason = 'Insurance provider verification is still pending. Clearinghouse turnaround estimated 24-48 hours.';
      } else {
        reason = 'This insurance provider has declined the request. Non-contracted provider network or credentialing requirement not met.';
      }
    } else {
      // Default simulated rules based on provider
      const provLower = insuranceProvider.toLowerCase();
      if (provLower.includes('aetna') || provLower.includes('humana')) {
        status = 'Pending';
        reason = 'Insurance provider verification is still pending. Clearinghouse turnaround estimated 24-48 hours.';
      } else if (provLower.includes('cigna') || provLower.includes('kaiser')) {
        status = 'Declined';
        reason = 'This insurance provider has declined the request. Non-contracted provider network or credentialing requirement not met.';
      } else {
        status = 'Accepted';
        reason = 'Insurance provider contract is verified, in-network, and active on real-time payer clearinghouse.';
      }
    }

    const existing = storageService.getInsuranceByPatientId(patientId);
    const updatedRecord: InsuranceInfo = {
      ...(existing || {
        id: `ins-${Date.now()}`,
        patientId,
        memberId: '',
        policyNumber: '',
        policyHolderName: '',
        relationshipToPatient: 'Self',
        groupNumber: 'GRP-STANDARD-01',
        effectiveDate: '2024-01-01',
        expiryDate: '2024-12-31',
        insuranceStatus: 'Active',
        eligibilityStatus: 'Pending',
        coverageStatus: 'Consultation, Outpatient Care, and Diagnostic Procedures',
        copayAmount: 20,
        deductible: 500,
        coinsurance: 20,
        coveredServices: ['Outpatient Consultation', 'Diagnostic Lab Testing', 'Preventative Screenings', 'Specialist Consultations']
      }),
      insuranceProvider,
      providerStatus: status,
      providerStatusCheckedAt: checkedAt,
      providerStatusReason: reason,
      updatedAt: new Date().toISOString()
    };

    storageService.saveInsurance(updatedRecord);

    return {
      providerStatus: status,
      providerStatusCheckedAt: checkedAt,
      providerStatusReason: reason
    };
  },

  async saveInsurance(data: Omit<InsuranceInfo, 'id' | 'updatedAt'> & { id?: string }): Promise<InsuranceInfo> {
    const existing = storageService.getInsuranceByPatientId(data.patientId);
    const insId = data.id || existing?.id || `ins-${Date.now()}`;
    const record: InsuranceInfo = {
      ...data,
      id: insId,
      providerStatus: data.providerStatus || existing?.providerStatus || 'Accepted',
      providerStatusCheckedAt: data.providerStatusCheckedAt || existing?.providerStatusCheckedAt || new Date().toISOString(),
      providerStatusReason: data.providerStatusReason || existing?.providerStatusReason,
      treatmentAmount: data.treatmentAmount !== undefined ? data.treatmentAmount : existing?.treatmentAmount,
      requestedAmount: data.requestedAmount !== undefined ? data.requestedAmount : existing?.requestedAmount,
      patientResponsibilityAmount: data.patientResponsibilityAmount !== undefined ? data.patientResponsibilityAmount : existing?.patientResponsibilityAmount,
      additionalCharges: data.additionalCharges !== undefined ? data.additionalCharges : existing?.additionalCharges,
      treatmentBreakdown: data.treatmentBreakdown || existing?.treatmentBreakdown,
      billingBreakdown: data.billingBreakdown || existing?.billingBreakdown,
      updatedAt: new Date().toISOString()
    };
    try {
      await fetch('/api/insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch {
      // Fallback
    }

    storageService.saveInsurance(record);
    return record;
  },

  async verifyInsurance(
    patientId: string,
    insuranceData: Partial<InsuranceInfo>
  ): Promise<{ isVerified: boolean; verificationResult: InsuranceVerificationResult; insurance: InsuranceInfo }> {
    const currentDateStr = storageService.getCurrentDate();
    const existing = storageService.getInsuranceByPatientId(patientId);

    const provider = insuranceData.insuranceProvider || existing?.insuranceProvider || 'Blue Cross Blue Shield';
    const memberId = insuranceData.memberId || existing?.memberId || '';
    const policyNumber = insuranceData.policyNumber || existing?.policyNumber || '';
    const expiryDate = insuranceData.expiryDate || existing?.expiryDate || '2024-12-31';
    const policyHolder = insuranceData.policyHolderName || existing?.policyHolderName || 'Self';
    const relation = insuranceData.relationshipToPatient || existing?.relationshipToPatient || 'Self';
    const groupNum = insuranceData.groupNumber || existing?.groupNumber || 'GRP-STANDARD-01';

    // Verification Logic Checks
    let isEligible = true;
    let failureReason = '';

    if (!memberId.trim() || memberId.trim().length < 4) {
      isEligible = false;
      failureReason = 'Invalid Member ID format. Payer requires at least 4 alphanumeric characters.';
    } else if (insuranceData.insuranceStatus === 'Inactive') {
      isEligible = false;
      failureReason = `Policy is currently flagged as Inactive by ${provider}.`;
    } else if (insuranceData.insuranceStatus === 'Expired' || (expiryDate && expiryDate < currentDateStr)) {
      isEligible = false;
      failureReason = `Policy has expired on ${expiryDate}. Current verification date is ${currentDateStr}.`;
    }

    const verificationResult: InsuranceVerificationResult = isEligible
      ? {
          isVerified: true,
          verifiedAt: new Date().toISOString(),
          message: `Active coverage confirmed with ${provider}. Real-time EDI 270/271 transaction successful.`
        }
      : {
          isVerified: false,
          verifiedAt: new Date().toISOString(),
          message: `Insurance verification rejected by ${provider}.`,
          failureReason
        };

    const copay = isEligible ? (insuranceData.copayAmount !== undefined ? insuranceData.copayAmount : 20) : 0;
    const deductible = isEligible ? (insuranceData.deductible !== undefined ? insuranceData.deductible : 500) : 0;
    const coinsurance = isEligible ? (insuranceData.coinsurance !== undefined ? insuranceData.coinsurance : 20) : 0;
    const coverage = isEligible
      ? (insuranceData.coverageStatus || 'Consultation, Outpatient Care, and Basic Diagnostic Procedures')
      : 'No Active Coverage';

    const coveredServices = isEligible
      ? (insuranceData.coveredServices && insuranceData.coveredServices.length > 0
          ? insuranceData.coveredServices
          : ['Outpatient Visits', 'Diagnostic Lab Testing', 'Preventative Screenings', 'Specialist Consultations'])
      : [];

    const insuranceRecord: InsuranceInfo = {
      id: existing?.id || `ins-${Date.now()}`,
      patientId,
      appointmentId: insuranceData.appointmentId || existing?.appointmentId,
      insuranceProvider: provider,
      memberId,
      policyNumber,
      policyHolderName: policyHolder,
      relationshipToPatient: relation,
      groupNumber: groupNum,
      effectiveDate: insuranceData.effectiveDate || existing?.effectiveDate || '2024-01-01',
      expiryDate,
      insuranceStatus: isEligible ? 'Active' : (insuranceData.insuranceStatus === 'Expired' ? 'Expired' : 'Inactive'),
      eligibilityStatus: isEligible ? 'Eligible' : 'Not Eligible',
      coverageStatus: coverage,
      copayAmount: copay,
      deductible,
      coinsurance,
      coveredServices,
      treatmentAmount: insuranceData.treatmentAmount !== undefined ? insuranceData.treatmentAmount : existing?.treatmentAmount,
      requestedAmount: insuranceData.requestedAmount !== undefined ? insuranceData.requestedAmount : existing?.requestedAmount,
      patientResponsibilityAmount: insuranceData.patientResponsibilityAmount !== undefined ? insuranceData.patientResponsibilityAmount : existing?.patientResponsibilityAmount,
      additionalCharges: insuranceData.additionalCharges !== undefined ? insuranceData.additionalCharges : existing?.additionalCharges,
      treatmentBreakdown: insuranceData.treatmentBreakdown || existing?.treatmentBreakdown,
      billingBreakdown: insuranceData.billingBreakdown || existing?.billingBreakdown,
      verificationResult,
      providerStatus: insuranceData.providerStatus || existing?.providerStatus || 'Accepted',
      providerStatusCheckedAt: insuranceData.providerStatusCheckedAt || existing?.providerStatusCheckedAt || new Date().toISOString(),
      providerStatusReason: insuranceData.providerStatusReason || existing?.providerStatusReason,
      updatedAt: new Date().toISOString()
    };

    storageService.saveInsurance(insuranceRecord);

    return {
      isVerified: isEligible,
      verificationResult,
      insurance: insuranceRecord
    };
  },

  async searchPatientsForInsurance(query: string): Promise<InsuranceSearchResult[]> {
    const q = query.trim().toLowerCase();
    const patients = storageService.getPatients();
    const appointments = storageService.getAppointments();
    const registrations = storageService.getRegistrations();
    const insurances: InsuranceInfo[] = storageService.getInsuranceList();

    const filteredPatients = patients.filter((p) => {
      const matchName = `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
      const matchId = p.patientId.toLowerCase().includes(q);
      const matchAppt = appointments.some(
        (a) => a.patientId === p.id && a.appointmentCode.toLowerCase().includes(q)
      );
      const matchIns = insurances.some(
        (i: InsuranceInfo) =>
          i.patientId === p.id &&
          (i.memberId.toLowerCase().includes(q) || i.policyNumber.toLowerCase().includes(q))
      );
      return matchName || matchId || matchAppt || matchIns;
    });

    return filteredPatients.map((patient) => {
      const patientAppointments = appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));
      const reg = registrations.find((r) => r.patientId === patient.id) || null;
      const ins = insurances.find((i: InsuranceInfo) => i.patientId === patient.id) || null;
      return {
        patient,
        appointment: patientAppointments[0] || null,
        registration: reg,
        insurance: ins
      };
    });
  },

  async getInsuranceCommunication(patientId: string): Promise<InsuranceCommunicationRequest | null> {
    return storageService.getInsuranceCommunicationByPatientId(patientId);
  },

  async sendInsuranceRequest(payload: {
    patientId: string;
    insuranceProvider: string;
    memberId: string;
    policyNumber: string;
    treatmentAmount: number;
    requestedAmount: number;
    patientResponsibilityAmount?: number;
    additionalCharges?: number;
    treatmentBreakdown?: TreatmentCostItem[];
    billingBreakdown?: TreatmentBillingItem[];
    initialMessage?: string;
  }): Promise<InsuranceCommunicationRequest> {
    const existing = storageService.getInsuranceCommunicationByPatientId(payload.patientId);
    const reqId = existing?.id || `REQ-${payload.insuranceProvider.split(' ').map(w => w[0]).join('').toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const now = new Date().toISOString();

    const initialTimeline: RequestTimelineStep[] = [
      {
        stepKey: 'submitted',
        title: 'Request Submitted',
        description: `Initial insurance claim & pre-verification request submitted to ${payload.insuranceProvider} for $${payload.requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
        timestamp: now,
        status: 'completed',
        badgeText: 'Submitted'
      },
      {
        stepKey: 'under_review',
        title: 'Under Review',
        description: `${payload.insuranceProvider} electronic EDI clearinghouse accepted the request and initiated clinical coverage review.`,
        timestamp: new Date(Date.now() + 60000).toISOString(),
        status: 'completed',
        badgeText: 'Payer Reviewing'
      },
      {
        stepKey: 'info_requested',
        title: 'Additional Information Requested',
        description: `Insurance claims examiner requested supporting documents: Patient Insurance Card and Treatment Estimate.`,
        timestamp: new Date(Date.now() + 120000).toISOString(),
        status: 'active',
        badgeText: 'Action Required'
      },
      {
        stepKey: 'docs_submitted',
        title: 'Documents / Details Submitted',
        description: 'Hospital uploads and securely transmits requested clinical and insurance documents.',
        status: 'upcoming'
      },
      {
        stepKey: 'decision_pending',
        title: 'Decision Pending',
        description: 'Insurance medical review board evaluating submitted documents against policy limits.',
        status: 'upcoming'
      },
      {
        stepKey: 'decision_final',
        title: 'Approval / Denial',
        description: 'Final claim decision and electronic authorization issuance.',
        status: 'upcoming'
      }
    ];

    const billingItemsText = payload.billingBreakdown && payload.billingBreakdown.length > 0
      ? `\nTreatment & Billing Breakdown:\n${payload.billingBreakdown.map(b => `• ${b.serviceDescription} [${b.procedureCode} | ${b.diagnosisCode}]: $${b.amount.toLocaleString()}`).join('\n')}`
      : (payload.treatmentBreakdown && payload.treatmentBreakdown.length > 0
          ? `\nItemized Breakdown:\n${payload.treatmentBreakdown.map(b => `• ${b.serviceName} (${b.category}): ${b.quantity} × $${b.unitCost} = $${b.totalCost.toLocaleString()}`).join('\n')}`
          : '');

    const patientResp = payload.patientResponsibilityAmount !== undefined
      ? payload.patientResponsibilityAmount
      : Math.max(0, payload.treatmentAmount - payload.requestedAmount);

    const initialMessages: ChatMessage[] = [
      {
        id: `msg-${Date.now()}-1`,
        sender: 'Hospital Billing Desk',
        senderRole: 'Hospital / Admin',
        text: payload.initialMessage || `Submitted insurance pre-verification and coverage request for ${payload.insuranceProvider}.\n• Total Estimated Treatment Cost: $${payload.treatmentAmount.toLocaleString()}\n• Requested Insurance Coverage: $${payload.requestedAmount.toLocaleString()}\n• Estimated Patient Responsibility: $${patientResp.toLocaleString()}${billingItemsText}`,
        timestamp: now
      },
      {
        id: `msg-${Date.now()}-2`,
        sender: `${payload.insuranceProvider} Claims Desk`,
        senderRole: 'Insurance Provider',
        text: `Your request #${reqId} has been received and is under clinical benefits review.`,
        timestamp: new Date(Date.now() + 60000).toISOString()
      },
      {
        id: `msg-${Date.now()}-3`,
        sender: `${payload.insuranceProvider} Claims Desk`,
        senderRole: 'Insurance Provider',
        text: `Please upload the patient's insurance card (front & back) and itemized treatment estimate breakdown so we can proceed with eligibility clearance.`,
        timestamp: new Date(Date.now() + 120000).toISOString()
      }
    ];

    const newRequest: InsuranceCommunicationRequest = {
      id: reqId,
      patientId: payload.patientId,
      insuranceProvider: payload.insuranceProvider,
      memberId: payload.memberId,
      policyNumber: payload.policyNumber,
      treatmentAmount: payload.treatmentAmount,
      requestedAmount: payload.requestedAmount,
      patientResponsibilityAmount: patientResp,
      additionalCharges: payload.additionalCharges || 0,
      treatmentBreakdown: payload.treatmentBreakdown || [],
      billingBreakdown: payload.billingBreakdown || [],
      status: 'Additional Info Requested',
      submittedAt: now,
      timeline: initialTimeline,
      messages: initialMessages,
      updatedAt: now
    };

    storageService.saveInsuranceCommunication(newRequest);
    return newRequest;
  },

  async sendChatMessage(
    patientId: string,
    messagePayload: {
      text: string;
      senderRole?: 'Hospital / Admin' | 'Insurance Provider';
      senderName?: string;
      attachments?: ChatAttachment[];
    }
  ): Promise<{ request: InsuranceCommunicationRequest; autoResponseTriggered?: boolean }> {
    let req = storageService.getInsuranceCommunicationByPatientId(patientId);
    const now = new Date().toISOString();

    if (!req) {
      const ins = storageService.getInsuranceByPatientId(patientId);
      req = {
        id: `REQ-INS-${Math.floor(10000 + Math.random() * 90000)}`,
        patientId,
        insuranceProvider: ins?.insuranceProvider || 'Blue Cross Blue Shield',
        memberId: ins?.memberId || 'BCBS-10029',
        policyNumber: ins?.policyNumber || 'POL-9921',
        treatmentAmount: 3500,
        requestedAmount: 3000,
        status: 'Under Review',
        submittedAt: now,
        timeline: [
          {
            stepKey: 'submitted',
            title: 'Request Submitted',
            description: 'Request submitted to payer.',
            timestamp: now,
            status: 'completed',
            badgeText: 'Submitted'
          },
          {
            stepKey: 'under_review',
            title: 'Under Review',
            description: 'Under review by payer.',
            timestamp: now,
            status: 'active',
            badgeText: 'In Review'
          },
          {
            stepKey: 'info_requested',
            title: 'Additional Information Requested',
            description: 'Payer may request additional documents.',
            status: 'upcoming'
          },
          {
            stepKey: 'docs_submitted',
            title: 'Documents / Details Submitted',
            description: 'Hospital uploads and sends requested information.',
            status: 'upcoming'
          },
          {
            stepKey: 'decision_pending',
            title: 'Decision Pending',
            description: 'Payer reviewing submitted documents.',
            status: 'upcoming'
          },
          {
            stepKey: 'decision_final',
            title: 'Approval / Denial',
            description: 'Final status of the insurance request.',
            status: 'upcoming'
          }
        ],
        messages: [],
        updatedAt: now
      };
    }

    const role = messagePayload.senderRole || 'Hospital / Admin';
    const sender = messagePayload.senderName || (role === 'Hospital / Admin' ? 'Hospital Billing Desk' : `${req.insuranceProvider} Claims Specialist`);

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      senderRole: role,
      text: messagePayload.text,
      timestamp: now,
      attachments: messagePayload.attachments && messagePayload.attachments.length > 0 ? messagePayload.attachments : undefined
    };

    req.messages.push(newMsg);
    req.updatedAt = now;

    // If hospital uploaded attachments/sent details, advance timeline to 'Documents Submitted' -> 'Decision Pending'
    const hasAttachments = messagePayload.attachments && messagePayload.attachments.length > 0;
    if (role === 'Hospital / Admin' && (hasAttachments || messagePayload.text.toLowerCase().includes('document') || messagePayload.text.toLowerCase().includes('attached') || messagePayload.text.toLowerCase().includes('upload'))) {
      req.status = 'Documents Submitted';

      req.timeline = req.timeline.map((step) => {
        if (step.stepKey === 'submitted' || step.stepKey === 'under_review' || step.stepKey === 'info_requested') {
          return { ...step, status: 'completed' as const };
        }
        if (step.stepKey === 'docs_submitted') {
          return {
            ...step,
            status: 'completed' as const,
            timestamp: now,
            description: hasAttachments
              ? `Hospital uploaded and transmitted ${messagePayload.attachments!.length} document(s): ${messagePayload.attachments!.map(a => a.name).join(', ')}.`
              : 'Hospital uploaded and confirmed required insurance documents.'
          };
        }
        if (step.stepKey === 'decision_pending') {
          return {
            ...step,
            status: 'active' as const,
            timestamp: now,
            description: `${req!.insuranceProvider} medical review committee is evaluating submitted documents for final eligibility determination.`
          };
        }
        return step;
      });
    }

    storageService.saveInsuranceCommunication(req);
    return { request: req, autoResponseTriggered: hasAttachments };
  },

  async advanceTimelineDecision(
    patientId: string,
    decision: 'Approved' | 'Denied',
    customNotes?: string
  ): Promise<InsuranceCommunicationRequest> {
    let req = storageService.getInsuranceCommunicationByPatientId(patientId);
    const now = new Date().toISOString();
    if (!req) throw new Error('No active communication request found for this patient.');

    req.status = decision;
    const isApproved = decision === 'Approved';
    const authNum = `AUTH-${req.insuranceProvider.split(' ').map(w => w[0]).join('').toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    req.timeline = req.timeline.map((step) => {
      if (step.stepKey !== 'decision_final') {
        return { ...step, status: 'completed' as const };
      }
      return {
        ...step,
        status: 'completed' as const,
        timestamp: now,
        title: isApproved ? 'Approved' : 'Denied',
        badgeText: isApproved ? 'Approved' : 'Denied',
        description: isApproved
          ? (customNotes || `Insurance request APPROVED for $${req!.requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Electronic authorization code: ${authNum}.`)
          : (customNotes || `Insurance request DECLINED. Reason: Benefit coverage limitation or out-of-network service code.`)
      };
    });

    const responseMsg: ChatMessage = {
      id: `msg-${Date.now()}-decision`,
      sender: `${req.insuranceProvider} Adjudication Team`,
      senderRole: 'Insurance Provider',
      text: isApproved
        ? `Decision Notice: Your insurance request #${req.id} has been APPROVED for $${req.requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Authorization Code: ${authNum}. All verified covered services are authorized.`
        : `Decision Notice: Your insurance request #${req.id} has been DECLINED by payer review board. Reason: Service code not covered under standard outpatient benefit limits.`,
      timestamp: now
    };

    req.messages.push(responseMsg);
    req.updatedAt = now;
    storageService.saveInsuranceCommunication(req);
    return req;
  }
};
