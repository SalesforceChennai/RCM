import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCode2,
  Search,
  Calendar,
  AlertCircle,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  Stethoscope,
  X,
  Clock,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  RefreshCw,
  CheckSquare,
  Square,
  Cpu
} from 'lucide-react';
import type {
  Patient,
  DiagnosisCodeItem,
  ProcedureCodeItem,
  MedicalCodingRecord,
  CodingStatus
} from '../types';
import { storageService } from '../services/storageService';
import {
  medicalCodingService,
  STANDARD_ICD10_CODES,
  STANDARD_CPT_CODES,
  STANDARD_MODIFIERS
} from '../services/medicalCodingService';
import {
  aiCodingService,
  type AiCodingResponse
} from '../services/aiCodingService';

interface MedicalCodingPageProps {
  preselectedPatientId?: string | null;
  onNavigateToChargeCapture?: (patientId?: string) => void;
  onNavigateToClaimCreation?: (patientId?: string) => void;
  onNavigateToDashboard: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

// Hierarchical Candidate Code Definitions for Stage 4
interface CandidateChildCode {
  code: string;
  description: string;
}

interface CandidateParentGroup {
  parentCode: string;
  description: string;
  children: CandidateChildCode[];
}

const CANDIDATE_DIAGNOSIS_GROUPS: CandidateParentGroup[] = [
  {
    parentCode: 'J06',
    description: 'Acute upper respiratory infections of multiple and unspecified sites',
    children: [
      { code: 'J06.0', description: 'Acute laryngopharyngitis' },
      { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' }
    ]
  },
  {
    parentCode: 'R05',
    description: 'Cough',
    children: [
      { code: 'R05.1', description: 'Acute cough' },
      { code: 'R05.2', description: 'Subacute cough' },
      { code: 'R05.3', description: 'Chronic cough' },
      { code: 'R05.4', description: 'Cough syncope' },
      { code: 'R05.8', description: 'Other specified cough' },
      { code: 'R05.9', description: 'Cough, unspecified' }
    ]
  },
  {
    parentCode: 'R07',
    description: 'Pain in throat and chest',
    children: [
      { code: 'R07.0', description: 'Pain in throat' },
      { code: 'R07.1', description: 'Chest pain on breathing' },
      { code: 'R07.2', description: 'Precordial pain' },
      { code: 'R07.9', description: 'Chest pain, unspecified' }
    ]
  },
  {
    parentCode: 'R50',
    description: 'Fever of other and unknown origin',
    children: [
      { code: 'R50.2', description: 'Drug induced fever' },
      { code: 'R50.9', description: 'Fever, unspecified' }
    ]
  },
  {
    parentCode: 'R51',
    description: 'Headache',
    children: [
      { code: 'R51.0', description: 'Headache with orthostatic component' },
      { code: 'R51.9', description: 'Headache, unspecified' }
    ]
  },
  {
    parentCode: 'I10',
    description: 'Essential (primary) hypertension',
    children: [
      { code: 'I10', description: 'Essential (primary) hypertension, benign or unspecified' }
    ]
  }
];

const CANDIDATE_PROCEDURE_GROUPS: CandidateParentGroup[] = [
  {
    parentCode: '99211-99215',
    description: 'Office or other outpatient visit for established patient',
    children: [
      { code: '99211', description: 'Office visit, minimal problems, typically 5 mins' },
      { code: '99212', description: 'Office visit, straightforward complexity, 10-19 mins' },
      { code: '99213', description: 'Office visit, low medical complexity, 20-29 mins' },
      { code: '99214', description: 'Office visit, moderate complexity, 30-39 mins' },
      { code: '99215', description: 'Office visit, high medical complexity, 40-54 mins' }
    ]
  },
  {
    parentCode: '80048-80053',
    description: 'Organ or disease oriented laboratory panels',
    children: [
      { code: '80048', description: 'Basic metabolic panel (BMP), 8 chemistry tests' },
      { code: '80053', description: 'Comprehensive metabolic panel (CMP), 14 chemistry tests' },
      { code: '85025', description: 'Complete blood count (CBC) with automated differential' }
    ]
  },
  {
    parentCode: '71045-71048',
    description: 'Radiologic examination, chest',
    children: [
      { code: '71045', description: 'Radiologic examination, chest; single view, frontal' },
      { code: '71046', description: 'Radiologic examination, chest; 2 views, frontal and lateral' },
      { code: '71047', description: 'Radiologic examination, chest; 3 views' }
    ]
  },
  {
    parentCode: '93000-93010',
    description: 'Electrocardiography diagnostic services',
    children: [
      { code: '93000', description: 'Electrocardiogram (ECG/EKG), routine with interpretation & report' },
      { code: '93005', description: 'Electrocardiogram, tracing only, without interpretation' },
      { code: '93010', description: 'Electrocardiogram, interpretation and report only' }
    ]
  },
  {
    parentCode: '96360-96361',
    description: 'Intravenous hydration infusion',
    children: [
      { code: '96360', description: 'Intravenous hydration infusion, initial, 31-60 minutes' },
      { code: '96361', description: 'Intravenous hydration infusion, each additional hour' }
    ]
  }
];

export const MedicalCodingPage: React.FC<MedicalCodingPageProps> = ({
  preselectedPatientId,
  onNavigateToChargeCapture,
  onNavigateToClaimCreation,
  onNavigateToDashboard,
  onSuccess,
  onError
}) => {
  // Available patients & encounters
  const [patients] = useState<Patient[]>(() => storageService.getPatients());
  const [selectedPatientId, setSelectedPatientId] = useState<string>(() => {
    return preselectedPatientId || '';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);

  // Admission Note Editor State - Completely empty by default (no pre-filled sample text)
  const [admissionNoteText, setAdmissionNoteText] = useState<string>('');
  const [isNoteEditing, setIsNoteEditing] = useState<boolean>(true);

  // Pipeline Panel Stages State
  const [expandedPipelineStages, setExpandedPipelineStages] = useState<{ [key: number]: boolean }>({
    1: true,
    2: true,
    3: true,
    4: true, // Expanded by default as required
    5: true
  });
  const [candidateActiveCategory, setCandidateActiveCategory] = useState<'Diagnosis' | 'Procedures'>('Diagnosis');

  // AI Medical Coding State
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<AiCodingResponse | null>(null);
  const [selectedAiDxCodes, setSelectedAiDxCodes] = useState<Set<string>>(new Set());
  const [selectedAiPxCodes, setSelectedAiPxCodes] = useState<Set<string>>(new Set());

  // Active Coding Record
  const [codingRecord, setCodingRecord] = useState<MedicalCodingRecord | null>(() => {
    return preselectedPatientId ? medicalCodingService.getOrCreateCodingRecord(preselectedPatientId) : null;
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(() => new Date().toLocaleTimeString());

  // Modals for adding/editing diagnoses and procedures
  const [isAddDiagnosisModalOpen, setIsAddDiagnosisModalOpen] = useState<boolean>(false);
  const [newDiagnosisCode, setNewDiagnosisCode] = useState<string>('');
  const [newDiagnosisDesc, setNewDiagnosisDesc] = useState<string>('');
  const [newDiagnosisType, setNewDiagnosisType] = useState<'Primary' | 'Secondary'>('Secondary');

  const [isEditProcedureModalOpen, setIsEditProcedureModalOpen] = useState<boolean>(false);
  const [editingProcedure, setEditingProcedure] = useState<ProcedureCodeItem | null>(null);

  // Sync when preselectedPatientId changes externally
  useEffect(() => {
    if (preselectedPatientId && preselectedPatientId !== selectedPatientId) {
      setSelectedPatientId(preselectedPatientId);
      setAdmissionNoteText('');
      setAiResponse(null);
      setAiError(null);
      setSelectedAiDxCodes(new Set());
      setSelectedAiPxCodes(new Set());
      const record = medicalCodingService.getOrCreateCodingRecord(preselectedPatientId);
      setCodingRecord(record);
      setLastValidatedAt(new Date().toLocaleTimeString());
    }
  }, [preselectedPatientId, selectedPatientId]);

  // Selected Patient Details
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return patients.slice(0, 5);
    }
    return medicalCodingService.searchEncounters(searchQuery).map((r) => r.patient);
  }, [searchQuery, patients]);

  // Dynamic Validation Checks
  const validationResult = useMemo(() => {
    if (!codingRecord) {
      return { isValid: false, messages: [], canProceedToClaim: false };
    }
    return medicalCodingService.validateCoding(codingRecord);
  }, [codingRecord]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    if (!codingRecord) {
      return {
        totalCapturedServices: 0,
        servicesCoded: 0,
        pendingCoding: 0,
        diagnosisCodes: 0,
        procedureCodes: 0,
        totalCharge: 0,
        statusText: 'IN PROGRESS'
      };
    }

    const totalCaptured = codingRecord.services.length;
    const codedCount = codingRecord.services.filter(
      (s) => s.procedureCode?.trim() && s.diagnosisCode?.trim()
    ).length;
    const pendingCount = Math.max(0, totalCaptured - codedCount);
    const totalCharge = codingRecord.services.reduce((acc, s) => acc + (Number(s.totalCharge) || 0), 0);

    const isReady = validationResult.canProceedToClaim && pendingCount === 0;

    return {
      totalCapturedServices: totalCaptured,
      servicesCoded: codedCount,
      pendingCoding: pendingCount,
      diagnosisCodes: codingRecord.diagnoses.length,
      procedureCodes: codingRecord.procedures.length,
      totalCharge,
      statusText: isReady ? 'READY FOR CLAIM CREATION' : 'REQUIRES REVIEW'
    };
  }, [codingRecord, validationResult]);

  // Toggle Pipeline Stage Expansion
  const togglePipelineStage = (stageNum: number) => {
    setExpandedPipelineStages((prev) => ({
      ...prev,
      [stageNum]: !prev[stageNum]
    }));
  };

  // Dynamic Candidate Groups for Stage 2 (Populated by AI analysis when available)
  const shortlistedCandidateGroups = useMemo(() => {
    if (aiResponse) {
      const groupsMap = new Map<string, { cat: string; desc: string }>();

      aiResponse.diagnosisCodeSuggestions.forEach((dx) => {
        const code = dx.code.toUpperCase();
        if (code.startsWith('I1') || code.startsWith('I2')) {
          groupsMap.set('I10-I15', { cat: 'I10-I15', desc: 'Hypertensive & circulatory diseases' });
        } else if (code.startsWith('R05') || code.startsWith('R07')) {
          groupsMap.set('R05-R09', { cat: 'R05-R09', desc: 'Symptoms involving respiratory & circulatory systems' });
        } else if (code.startsWith('J0') || code.startsWith('J')) {
          groupsMap.set('J00-J06', { cat: 'J00-J06', desc: 'Acute upper respiratory infections' });
        } else if (code.startsWith('R5')) {
          groupsMap.set('R50-R53', { cat: 'R50-R53', desc: 'General symptoms and signs (Fever, Headache)' });
        } else if (code.startsWith('E')) {
          groupsMap.set('E08-E13', { cat: 'E08-E13', desc: 'Diabetes mellitus & endocrine disorders' });
        } else {
          groupsMap.set(code.slice(0, 3), { cat: `${code.slice(0, 3)}-Group`, desc: dx.description });
        }
      });

      aiResponse.procedureCodeSuggestions.forEach((px) => {
        const num = parseInt(px.code, 10);
        if (num >= 99201 && num <= 99215) {
          groupsMap.set('99202-99215', { cat: '99202-99215', desc: 'Evaluation and Management services' });
        } else if (num >= 80000 && num <= 89999) {
          groupsMap.set('80047-80053', { cat: '80047-80053', desc: 'Organ or disease oriented laboratory panels' });
        } else if (num >= 70000 && num <= 79999) {
          groupsMap.set('71045-71048', { cat: '71045-71048', desc: 'Chest radiologic examinations' });
        } else if (num >= 93000 && num <= 93010) {
          groupsMap.set('93000-93010', { cat: '93000-93010', desc: 'Cardiovascular diagnostic tests' });
        } else {
          groupsMap.set(px.code, { cat: px.code, desc: px.description });
        }
      });

      if (groupsMap.size > 0) {
        return Array.from(groupsMap.values());
      }
    }

    // No pre-filled groups by default until AI suggestions are generated
    return [];
  }, [aiResponse]);

  // Dynamic Top Relevant Groups for Stage 3 (Populated by AI analysis with actual confidence %)
  const topRelevantGroups = useMemo(() => {
    if (aiResponse) {
      const items: { code: string; label: string; score: string }[] = [];

      aiResponse.diagnosisCodeSuggestions.forEach((dx) => {
        items.push({
          code: dx.code,
          label: dx.description,
          score: `${dx.confidence}%`
        });
      });

      aiResponse.procedureCodeSuggestions.forEach((px) => {
        items.push({
          code: px.code,
          label: px.description,
          score: `${px.confidence}%`
        });
      });

      if (items.length > 0) return items;
    }

    // No pre-filled groups by default until AI suggestions are generated
    return [];
  }, [aiResponse]);

  // AI Action Handlers
  const handleGenerateAiSuggestions = async () => {
    const trimmed = admissionNoteText.trim();
    if (!trimmed) {
      const msg = "Please enter the doctor's clinical description before generating AI coding suggestions.";
      setAiError(msg);
      onError(msg);
      return;
    }

    setIsAiAnalyzing(true);
    setAiError(null);

    try {
      const result = await aiCodingService.generateAiCodingSuggestions(trimmed);
      setAiResponse(result);

      // Pre-select all suggested diagnosis codes for user review
      const dxSet = new Set<string>();
      result.diagnosisCodeSuggestions.forEach((d) => dxSet.add(d.code));
      setSelectedAiDxCodes(dxSet);

      // Pre-select all suggested procedure codes for user review
      const pxSet = new Set<string>();
      result.procedureCodeSuggestions.forEach((p) => pxSet.add(p.code));
      setSelectedAiPxCodes(pxSet);

      // Expand stages 1, 2, 3 so user immediately sees populated pipeline
      setExpandedPipelineStages((prev) => ({
        ...prev,
        1: true,
        2: true,
        3: true
      }));

      onSuccess('✓ Groq AI analysis completed! Review suggestions and confirm final codes.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate AI coding suggestions';
      setAiError(msg);
      onError(msg);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleToggleAiDx = (code: string) => {
    setSelectedAiDxCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleToggleAiPx = (code: string) => {
    setSelectedAiPxCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSelectAllAiCodes = () => {
    if (!aiResponse) return;
    const dxSet = new Set<string>();
    aiResponse.diagnosisCodeSuggestions.forEach((d) => dxSet.add(d.code));
    setSelectedAiDxCodes(dxSet);

    const pxSet = new Set<string>();
    aiResponse.procedureCodeSuggestions.forEach((p) => pxSet.add(p.code));
    setSelectedAiPxCodes(pxSet);
  };

  const handleDeselectAllAiCodes = () => {
    setSelectedAiDxCodes(new Set());
    setSelectedAiPxCodes(new Set());
  };

  const handleConfirmFinalCodes = () => {
    if (!codingRecord) return;

    if (!aiResponse) {
      onError('Please generate AI coding suggestions first.');
      return;
    }

    const confirmedDxList = aiResponse.diagnosisCodeSuggestions.filter((d) =>
      selectedAiDxCodes.has(d.code)
    );
    const confirmedPxList = aiResponse.procedureCodeSuggestions.filter((p) =>
      selectedAiPxCodes.has(p.code)
    );

    if (confirmedDxList.length === 0 && confirmedPxList.length === 0) {
      onError('No AI suggestions selected. Please select at least one code to confirm.');
      return;
    }

    // Merge diagnosis codes
    let updatedDiagnoses = [...codingRecord.diagnoses];
    confirmedDxList.forEach((sug, idx) => {
      const exists = updatedDiagnoses.find(
        (d) => d.code.toUpperCase() === sug.code.toUpperCase()
      );
      if (!exists) {
        const isFirst = updatedDiagnoses.length === 0 && idx === 0;
        updatedDiagnoses.push({
          id: `dx-ai-${Date.now()}-${idx}`,
          type: isFirst ? 'Primary' : 'Secondary',
          code: sug.code.toUpperCase(),
          description: sug.description,
          status: 'Validated',
          isPrimary: isFirst
        });
      }
    });

    // Ensure at least one primary diagnosis
    if (
      updatedDiagnoses.length > 0 &&
      !updatedDiagnoses.some((d) => d.isPrimary || d.type === 'Primary')
    ) {
      updatedDiagnoses[0].isPrimary = true;
      updatedDiagnoses[0].type = 'Primary';
    }

    // Update captured services with confirmed procedure & diagnosis codes
    let updatedServices = [...codingRecord.services];
    let updatedProcedures = [...codingRecord.procedures];

    if (updatedServices.length > 0) {
      updatedServices = updatedServices.map((srv, idx) => {
        const matchedPx = confirmedPxList[idx] || confirmedPxList[0];
        const matchedDx = confirmedDxList[idx] || confirmedDxList[0];

        const nextProc = matchedPx ? matchedPx.code : srv.procedureCode;
        const nextDiag = matchedDx ? matchedDx.code : srv.diagnosisCode;

        return {
          ...srv,
          procedureCode: nextProc,
          diagnosisCode: nextDiag,
          codingStatus: (nextProc?.trim() && nextDiag?.trim() ? 'Coded' : 'Pending Coding') as CodingStatus
        };
      });

      // Synchronize procedures list
      updatedProcedures = updatedServices.map((srv) => {
        const existingProc = updatedProcedures.find((p) => p.serviceId === srv.id);
        return {
          id: existingProc?.id || `px-${srv.id}`,
          serviceId: srv.id,
          serviceDescription: srv.serviceDescription,
          cptCode: srv.procedureCode,
          modifier: srv.modifiers || '—',
          units: srv.quantity || 1,
          chargeAmount: srv.totalCharge || 500,
          codingStatus: 'Ready' as const
        };
      });
    } else if (confirmedPxList.length > 0) {
      updatedProcedures = confirmedPxList.map((px, idx) => ({
        id: `px-ai-${Date.now()}-${idx}`,
        serviceDescription: px.description,
        cptCode: px.code,
        modifier: '—',
        units: 1,
        chargeAmount: 500,
        codingStatus: 'Ready' as const
      }));
    }

    const nextRecord: MedicalCodingRecord = {
      ...codingRecord,
      diagnoses: updatedDiagnoses,
      procedures: updatedProcedures,
      services: updatedServices,
      updatedAt: new Date().toISOString()
    };

    setCodingRecord(nextRecord);
    try {
      medicalCodingService.saveCoding(nextRecord, false);
      setLastValidatedAt(new Date().toLocaleTimeString());
      onSuccess(
        `✓ Confirmed ${confirmedDxList.length} diagnosis & ${confirmedPxList.length} procedure codes into Final Selected Codes!`
      );
    } catch {
      onError('Failed to save confirmed codes.');
    }
  };

  // Patient Selection Handler
  const handleSelectPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsSearchDropdownOpen(false);
    setSearchQuery('');
    setAdmissionNoteText('');
    setAiResponse(null);
    setAiError(null);
    setSelectedAiDxCodes(new Set());
    setSelectedAiPxCodes(new Set());
    const record = medicalCodingService.getOrCreateCodingRecord(patientId);
    setCodingRecord(record);
    setLastValidatedAt(new Date().toLocaleTimeString());
  };

  // Service Inline Update Handler
  const handleServiceChange = (
    serviceId: string,
    field: 'procedureCode' | 'diagnosisCode',
    val: string
  ) => {
    if (!codingRecord) return;

    const updatedServices = codingRecord.services.map((srv) => {
      if (srv.id === serviceId) {
        const next = { ...srv, [field]: val };
        const hasBoth = Boolean(next.procedureCode?.trim() && next.diagnosisCode?.trim());
        return {
          ...next,
          codingStatus: (hasBoth ? 'Coded' : 'Pending Coding') as CodingStatus
        };
      }
      return srv;
    });

    // Synchronize corresponding procedure item
    const updatedProcedures = codingRecord.procedures.map((proc) => {
      if (proc.serviceId === serviceId && field === 'procedureCode') {
        return {
          ...proc,
          cptCode: val,
          codingStatus: val.trim() ? ('Ready' as const) : ('Pending' as const)
        };
      }
      return proc;
    });

    setCodingRecord({
      ...codingRecord,
      services: updatedServices,
      procedures: updatedProcedures
    });
  };

  // Diagnosis Management Handlers
  const handleOpenAddDiagnosis = () => {
    setNewDiagnosisCode('I10');
    setNewDiagnosisDesc('Essential (primary) hypertension');
    setNewDiagnosisType(codingRecord?.diagnoses.length === 0 ? 'Primary' : 'Secondary');
    setIsAddDiagnosisModalOpen(true);
  };

  const handleSaveNewDiagnosis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codingRecord) return;

    const trimmedCode = newDiagnosisCode.trim().toUpperCase();
    if (!trimmedCode) {
      onError('Please specify a valid ICD-10 diagnosis code.');
      return;
    }

    let updatedDiagnoses = [...codingRecord.diagnoses];
    if (newDiagnosisType === 'Primary') {
      updatedDiagnoses = updatedDiagnoses.map((d) => ({
        ...d,
        type: 'Secondary' as const,
        isPrimary: false
      }));
    }

    const newItem: DiagnosisCodeItem = {
      id: `dx-${Date.now()}`,
      type: newDiagnosisType,
      code: trimmedCode,
      description: newDiagnosisDesc.trim() || 'Clinical Diagnosis',
      status: 'Validated',
      isPrimary: newDiagnosisType === 'Primary'
    };

    updatedDiagnoses.push(newItem);

    setCodingRecord({
      ...codingRecord,
      diagnoses: updatedDiagnoses
    });

    setIsAddDiagnosisModalOpen(false);
    onSuccess(`ICD-10 Diagnosis ${newItem.code} added successfully.`);
  };

  const handleRemoveDiagnosis = (dxId: string) => {
    if (!codingRecord) return;
    const itemToRemove = codingRecord.diagnoses.find((d) => d.id === dxId);
    let updatedDiagnoses = codingRecord.diagnoses.filter((d) => d.id !== dxId);

    if (itemToRemove?.isPrimary && updatedDiagnoses.length > 0) {
      updatedDiagnoses = updatedDiagnoses.map((d, idx) => ({
        ...d,
        type: idx === 0 ? ('Primary' as const) : ('Secondary' as const),
        isPrimary: idx === 0
      }));
    }

    setCodingRecord({
      ...codingRecord,
      diagnoses: updatedDiagnoses
    });

    onSuccess('Diagnosis code removed.');
  };

  const handleSetAsPrimaryDiagnosis = (dxId: string) => {
    if (!codingRecord) return;
    const updated = codingRecord.diagnoses.map((d) => ({
      ...d,
      type: d.id === dxId ? ('Primary' as const) : ('Secondary' as const),
      isPrimary: d.id === dxId
    }));

    setCodingRecord({
      ...codingRecord,
      diagnoses: updated
    });

    onSuccess('Primary diagnosis updated.');
  };

  // Procedure Management Handlers
  const handleOpenEditProcedure = (proc: ProcedureCodeItem) => {
    setEditingProcedure({ ...proc });
    setIsEditProcedureModalOpen(true);
  };

  const handleSaveEditProcedure = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codingRecord || !editingProcedure) return;

    const updatedProcedures = codingRecord.procedures.map((p) =>
      p.id === editingProcedure.id ? editingProcedure : p
    );

    const updatedServices = codingRecord.services.map((s) => {
      if (s.id === editingProcedure.serviceId) {
        return {
          ...s,
          procedureCode: editingProcedure.cptCode,
          modifiers: editingProcedure.modifier,
          totalCharge: editingProcedure.chargeAmount
        };
      }
      return s;
    });

    setCodingRecord({
      ...codingRecord,
      procedures: updatedProcedures,
      services: updatedServices
    });

    setIsEditProcedureModalOpen(false);
    setEditingProcedure(null);
    onSuccess('Procedure code details updated.');
  };

  // Validation Trigger
  const handleRunValidation = () => {
    if (!codingRecord) return;
    const result = medicalCodingService.validateCoding(codingRecord);
    setLastValidatedAt(new Date().toLocaleTimeString());

    if (result.isValid && result.canProceedToClaim) {
      onSuccess('✓ Coding validation complete! All procedures and diagnoses comply with billing rules.');
    } else if (result.isValid) {
      onSuccess('Coding validation finished with informational advisories.');
    } else {
      onError('⚠ Validation errors detected. Please address highlighted items before claim creation.');
    }
  };

  // Save Draft
  const handleSaveDraft = () => {
    if (!codingRecord) return;
    setIsSaving(true);
    try {
      medicalCodingService.saveCoding(codingRecord, false);
      setIsSaving(false);
      onSuccess('Medical coding draft saved successfully.');
    } catch {
      setIsSaving(false);
      onError('Failed to save coding draft.');
    }
  };

  // Complete Coding
  const handleCompleteCoding = () => {
    if (!codingRecord) return;
    const result = medicalCodingService.validateCoding(codingRecord);

    if (!result.canProceedToClaim) {
      onError('Cannot complete coding: Missing required procedure/diagnosis codes or primary diagnosis error.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = medicalCodingService.saveCoding(codingRecord, true);
      setCodingRecord(saved);
      setIsSaving(false);
      onSuccess('✓ Medical Coding successfully completed and marked READY FOR CLAIM CREATION!');
    } catch {
      setIsSaving(false);
      onError('Failed to complete medical coding.');
    }
  };

  // Proceed to Claim Creation
  const handleProceedToClaimCreation = () => {
    if (!validationResult.canProceedToClaim) {
      onError('Please ensure all captured services have valid procedure and diagnosis codes before proceeding.');
      return;
    }

    if (codingRecord) {
      medicalCodingService.saveCoding(codingRecord, true);
    }

    onSuccess('Redirecting to Module 7: Claim Creation...');
    if (onNavigateToClaimCreation) {
      onNavigateToClaimCreation(selectedPatientId);
    }
  };

  return (
    <div className="page-body animate-fade-in" style={{ paddingBottom: 80 }}>
      {/* ==================================================== */}
      {/* PAGE HEADER */}
      {/* ==================================================== */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#2563eb',
                backgroundColor: '#eff6ff',
                padding: '3px 10px',
                borderRadius: 6,
                border: '1px solid #bfdbfe'
              }}
            >
              MODULE 6
            </span>
            <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
              MediCare RCM Workflow
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#15803d' : '#b45309',
                backgroundColor: summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#dcfce7' : '#fef3c7',
                padding: '2px 8px',
                borderRadius: 12,
                border: `1px solid ${summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#86efac' : '#fde68a'}`
              }}
            >
              {summaryMetrics.statusText}
            </span>
          </div>

          <h1 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Medical Coding
          </h1>

          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem', maxWidth: 780 }}>
            Review captured healthcare services and assign standardized diagnosis and procedure codes before claim creation.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {onNavigateToChargeCapture && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigateToChargeCapture(selectedPatientId)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ArrowLeft size={16} />
              <span>Charge Capture</span>
            </button>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={handleSaveDraft}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={16} />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={handleRunValidation}
            style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#4f46e5' }}
          >
            <ShieldCheck size={16} />
            <span>Validate Codes</span>
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={handleProceedToClaimCreation}
            disabled={!validationResult.canProceedToClaim}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: validationResult.canProceedToClaim ? '#16a34a' : '#94a3b8',
              cursor: validationResult.canProceedToClaim ? 'pointer' : 'not-allowed',
              opacity: validationResult.canProceedToClaim ? 1 : 0.65
            }}
            title={
              validationResult.canProceedToClaim
                ? 'Proceed to Claim Creation'
                : 'All captured services must have valid procedure and diagnosis codes'
            }
          >
            <span>Proceed to Claim Creation</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* WORKFLOW ROADMAP PROGRESSION */}
      {/* ==================================================== */}
      <div
        className="form-section-card"
        style={{
          padding: '12px 18px',
          marginBottom: 24,
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          overflowX: 'auto'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 700, justifyContent: 'space-between' }}>
          {[
            { step: '1', label: 'Patient Encounter', completed: true },
            { step: '2', label: 'Captured Charges', completed: true },
            { step: '3', label: 'Assign Diagnosis Codes', active: true },
            { step: '4', label: 'Assign Procedure Codes', active: true },
            { step: '5', label: 'Validate Coding', active: true },
            { step: '6', label: 'Complete Coding', ready: validationResult.canProceedToClaim },
            { step: '7', label: 'Claim Creation', next: true }
          ].map((item, idx, arr) => (
            <React.Fragment key={item.step}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    backgroundColor: item.completed
                      ? '#16a34a'
                      : item.active
                      ? '#2563eb'
                      : item.ready
                      ? '#7c3aed'
                      : '#e2e8f0',
                    color: item.completed || item.active || item.ready ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 800
                  }}
                >
                  {item.completed ? '✓' : item.step}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: item.active ? 800 : 600,
                    color: item.active ? '#1e40af' : item.completed ? '#166534' : '#64748b',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {item.label}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: item.completed ? '#86efac' : '#e2e8f0',
                    margin: '0 8px',
                    minWidth: 16
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ==================================================== */}
      {/* STEP 1: SELECT PATIENT / ENCOUNTER */}
      {/* ==================================================== */}
      <div className="form-section-card" style={{ marginBottom: 24 }}>
        <div className="form-section-header">
          <div className="form-section-title-wrap">
            <div className="section-number-badge" style={{ backgroundColor: '#2563eb' }}>
              1
            </div>
            <div>
              <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem' }}>
                Select Patient / Encounter
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Search and select patient encounter to retrieve previously recorded services from Charge Capture
              </span>
            </div>
          </div>

          {selectedPatient && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe'
                }}
              >
                Encounter: {codingRecord?.encounterId || 'ENC-10031'}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac'
                }}
              >
                {codingRecord?.services.length || 0} Captured Services
              </span>
            </div>
          )}
        </div>

        {/* Quick Patient Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Quick Patient:</span>
          {patients.slice(0, 5).map((p) => {
            const isSelected = p.id === selectedPatientId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPatient(p.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                  color: isSelected ? '#1d4ed8' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.firstName} {p.lastName} ({p.patientId})
              </button>
            );
          })}
        </div>

        {/* Patient / Encounter Search Bar */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontWeight: 700, color: '#334155' }}>
              Search Patient / Encounter
            </label>
            <div className="form-input-box">
              <Search size={17} className="form-input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search by Patient Name, Patient ID, Appointment ID, or Encounter Date..."
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8'
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Search Dropdown */}
          {isSearchDropdownOpen && searchResults.length > 0 && (
            <div
              className="patient-search-dropdown animate-slide-down"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 40,
                backgroundColor: '#ffffff',
                borderRadius: 10,
                boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                border: '1px solid #cbd5e1',
                marginTop: 4,
                maxHeight: 280,
                overflowY: 'auto'
              }}
            >
              {searchResults.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPatient(p.id)}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: p.id === selectedPatientId ? '#f0fdf4' : '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src={p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                      alt={p.firstName}
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                        {p.firstName} {p.lastName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        ID: <strong style={{ color: '#2563eb' }}>{p.patientId}</strong> • DOB: {p.dob} • Gender: {p.gender}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#2563eb',
                      backgroundColor: '#eff6ff',
                      padding: '3px 8px',
                      borderRadius: 4
                    }}
                  >
                    Select Encounter →
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patient Information Summary Card */}
        {selectedPatient ? (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={selectedPatient.avatar || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'}
                  alt={selectedPatient.firstName}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 800, color: '#0f172a' }}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: 10, alignItems: 'center', marginTop: 2 }}>
                    <span>Patient ID: <strong style={{ color: '#0f172a' }}>{selectedPatient.patientId}</strong></span>
                    <span>•</span>
                    <span>DOB: <strong>{selectedPatient.dob}</strong></span>
                    <span>•</span>
                    <span>Gender: <strong>{selectedPatient.gender}</strong></span>
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe'
                }}
              >
                Outpatient Encounter
              </span>
            </div>

            {/* Structured Encounter Detail Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12
              }}
            >
              <div style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Patient
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
              </div>

              <div style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Patient ID
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                  {selectedPatient.patientId}
                </div>
              </div>

              <div style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Doctor
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {codingRecord?.doctorName || 'Dr. Smith'}
                </div>
              </div>

              <div style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Department
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {codingRecord?.departmentName || 'Cardiology'}
                </div>
              </div>

              <div style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Encounter Date
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  31-05-2026
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: 8 }}>
            Please select a patient or search for an encounter.
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MAIN DUAL-PANE WORKSPACE: LEFT EDITOR vs RIGHT PIPELINE */}
      {/* ==================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 440px',
          gap: 24,
          alignItems: 'start',
          marginBottom: 24
        }}
        className="medical-coding-split-layout"
      >
        {/* ================================================== */}
        {/* LEFT COLUMN: ADMISSION NOTE & CLINICAL WORKSPACE */}
        {/* ================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ADMISSION NOTE EDITOR CARD */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#0f172a' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem' }}>
                    Admission Note & Clinical Encounter Documentation
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Review or edit physician clinical notes used by the AI coding engine to extract diagnosis and procedure codes
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGenerateAiSuggestions}
                  disabled={isAiAnalyzing}
                  style={{
                    fontSize: '0.75rem',
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: isAiAnalyzing ? '#94a3b8' : '#4f46e5',
                    cursor: isAiAnalyzing ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Sparkles size={13} className={isAiAnalyzing ? 'animate-spin' : ''} />
                  <span>{isAiAnalyzing ? 'AI is analyzing the clinical description...' : 'Generate AI Coding Suggestions'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNoteEditing(!isNoteEditing)}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Edit2 size={13} />
                  <span>{isNoteEditing ? 'Lock Note' : 'Edit Note'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onSuccess('Clinical note re-analyzed. Pipeline candidate codes updated.');
                  }}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb' }}
                >
                  <RefreshCw size={13} />
                  <span>Re-parse Note</span>
                </button>
              </div>
            </div>

            {/* Error Notification Banner if AI analysis fails */}
            {aiError && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={16} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 2 }}>AI Medical Coding Advisory</strong>
                    <span>{aiError}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiError(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#991b1b',
                    padding: 2
                  }}
                  title="Dismiss alert"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Clinical Note Textbox / Document Box */}
            <div
              style={{
                backgroundColor: isNoteEditing ? '#ffffff' : '#f8fafc',
                border: isNoteEditing ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 14,
                position: 'relative'
              }}
            >
              {isNoteEditing ? (
                <textarea
                  id="clinical-description-textarea"
                  rows={14}
                  value={admissionNoteText}
                  onChange={(e) => setAdmissionNoteText(e.target.value)}
                  placeholder="Enter or paste the doctor's clinical description here..."
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    lineHeight: 1.6,
                    color: '#0f172a',
                    resize: 'vertical',
                    background: 'transparent'
                  }}
                />
              ) : (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    lineHeight: 1.6,
                    color: admissionNoteText ? '#1e293b' : '#94a3b8'
                  }}
                >
                  {admissionNoteText || "Enter or paste the doctor's clinical description here..."}
                </pre>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '0.6875rem',
                  color: '#64748b'
                }}
              >
                <span>Document Type: <strong>Doctor Clinical Description / Admission Note</strong></span>
                <span>Mode: <strong>Manual Entry</strong></span>
                <span>Status: <strong style={{ color: admissionNoteText.trim() ? '#16a34a' : '#64748b' }}>
                  {admissionNoteText.trim() ? 'Ready for AI' : 'Empty - Ready for input'}
                </strong></span>
              </div>
            </div>

            {/* AI Analysis Quick Launch Action Bar */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGenerateAiSuggestions}
                  disabled={isAiAnalyzing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: isAiAnalyzing ? '#94a3b8' : '#4f46e5',
                    cursor: isAiAnalyzing ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontWeight: 700,
                    boxShadow: '0 2px 10px rgba(79, 70, 229, 0.25)'
                  }}
                >
                  <Sparkles size={16} className={isAiAnalyzing ? 'animate-spin' : ''} />
                  <span>{isAiAnalyzing ? 'AI is analyzing the clinical description...' : 'Generate AI Coding Suggestions'}</span>
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cpu size={14} color="#6366f1" />
                <span>Powered by Groq LLM API • JSON Structured Extraction</span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* AI MEDICAL CODING SUGGESTIONS & CODE REVIEW PANEL */}
          {/* ==================================================== */}
          {aiResponse && (
            <div
              className="form-section-card animate-fade-in"
              style={{
                border: '1.5px solid #a5b4fc',
                backgroundColor: '#fbfbfe',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.08)'
              }}
            >
              <div className="form-section-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div className="form-section-title-wrap">
                  <div
                    className="section-number-badge"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      color: '#ffffff'
                    }}
                  >
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem', color: '#1e1b4b' }}>
                        AI Medical Coding Suggestions
                      </h2>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '2px 8px',
                          borderRadius: 12,
                          backgroundColor: '#e0e7ff',
                          color: '#4338ca',
                          border: '1px solid #c7d2fe'
                        }}
                      >
                        AI Suggested Codes
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Recommendations generated by Groq LLM ({aiResponse.modelUsed || 'llama-3.3-70b-versatile'}). Select codes to confirm into Final Selected Codes.
                    </span>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllAiCodes}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#475569'
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllAiCodes}
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: 600,
                      color: '#475569'
                    }}
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleConfirmFinalCodes}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#059669',
                      fontSize: '0.8125rem',
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontWeight: 800
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Confirm Final Codes ({selectedAiDxCodes.size + selectedAiPxCodes.size})</span>
                  </button>
                </div>
              </div>

              {/* Possible Diagnoses Overview */}
              {aiResponse.possibleDiagnoses && aiResponse.possibleDiagnoses.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0e7ff',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 16
                  }}
                >
                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', color: '#4338ca', letterSpacing: '0.04em' }}>
                    Potential Clinical Diagnoses Identified:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {aiResponse.possibleDiagnoses.map((diag, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 6,
                          backgroundColor: '#f5f3ff',
                          border: '1px solid #ddd6fe',
                          fontSize: '0.75rem',
                          color: '#5b21b6',
                          fontWeight: 700
                        }}
                      >
                        <span>{diag.name}</span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            backgroundColor: '#ede9fe',
                            padding: '1px 5px',
                            borderRadius: 4,
                            color: '#6d28d9'
                          }}
                        >
                          {diag.confidence}% Confidence
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI DIAGNOSIS CODE SUGGESTIONS */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stethoscope size={16} color="#7c3aed" />
                    <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#1e1b4b' }}>
                      Diagnosis Code Suggestions (ICD-10-CM)
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {aiResponse.diagnosisCodeSuggestions.length} suggested • {selectedAiDxCodes.size} selected
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aiResponse.diagnosisCodeSuggestions.map((dx) => {
                    const isSelected = selectedAiDxCodes.has(dx.code);
                    const confColor = dx.confidence >= 85 ? '#15803d' : dx.confidence >= 70 ? '#2563eb' : '#b45309';
                    const confBg = dx.confidence >= 85 ? '#dcfce7' : dx.confidence >= 70 ? '#eff6ff' : '#fef3c7';

                    return (
                      <div
                        key={dx.code}
                        onClick={() => handleToggleAiDx(dx.code)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: isSelected ? '1.5px solid #8b5cf6' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#faf5ff' : '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ marginTop: 2, color: isSelected ? '#7c3aed' : '#94a3b8' }}>
                            {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: '0.875rem',
                                  color: '#6d28d9',
                                  backgroundColor: '#ede9fe',
                                  padding: '1px 6px',
                                  borderRadius: 4
                                }}
                              >
                                {dx.code}
                              </span>
                              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8125rem' }}>
                                {dx.description}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                              <strong style={{ color: '#64748b' }}>Clinical Explanation: </strong>
                              {dx.reason}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 10,
                              backgroundColor: confBg,
                              color: confColor
                            }}
                          >
                            {dx.confidence}% Confidence
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI PROCEDURE CODE SUGGESTIONS (Only when supported by note) */}
              {aiResponse.procedureCodeSuggestions && aiResponse.procedureCodeSuggestions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileCode2 size={16} color="#2563eb" />
                      <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 800, color: '#1e1b4b' }}>
                        Procedure Code Suggestions (CPT/HCPCS)
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {aiResponse.procedureCodeSuggestions.length} suggested • {selectedAiPxCodes.size} selected
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {aiResponse.procedureCodeSuggestions.map((px) => {
                      const isSelected = selectedAiPxCodes.has(px.code);
                      const confColor = px.confidence >= 85 ? '#15803d' : px.confidence >= 70 ? '#2563eb' : '#b45309';
                      const confBg = px.confidence >= 85 ? '#dcfce7' : px.confidence >= 70 ? '#eff6ff' : '#fef3c7';

                      return (
                        <div
                          key={px.code}
                          onClick={() => handleToggleAiPx(px.code)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: isSelected ? '1.5px solid #60a5fa' : '1px solid #e2e8f0',
                            backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 12,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ marginTop: 2, color: isSelected ? '#2563eb' : '#94a3b8' }}>
                              {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 800,
                                    fontSize: '0.875rem',
                                    color: '#1e40af',
                                    backgroundColor: '#dbeafe',
                                    padding: '1px 6px',
                                    borderRadius: 4
                                  }}
                                >
                                  CPT: {px.code}
                                </span>
                                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.8125rem' }}>
                                  {px.description}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4, lineHeight: 1.4 }}>
                                <strong style={{ color: '#64748b' }}>Clinical Explanation: </strong>
                                {px.reason}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 10,
                                backgroundColor: confBg,
                                color: confColor
                              }}
                            >
                              {px.confidence}% Confidence
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom Confirmation Action Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  paddingTop: 12,
                  borderTop: '1px solid #e2e8f0'
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  Selected for encounter: <strong style={{ color: '#0f172a' }}>{selectedAiDxCodes.size} Diagnosis</strong> and <strong style={{ color: '#0f172a' }}>{selectedAiPxCodes.size} Procedure</strong> codes
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmFinalCodes}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#059669',
                    fontSize: '0.8125rem',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontWeight: 800
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Confirm Final Codes</span>
                </button>
              </div>

              {/* MEDICAL SAFETY / DEMO LABEL */}
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fef3c7',
                  color: '#92400e',
                  fontSize: '0.75rem',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                <ShieldCheck size={18} color="#d97706" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Medical Safety Note:</strong> AI-generated coding suggestions are for demonstration and decision-support purposes. Final diagnosis and medical codes must be reviewed and confirmed by a qualified healthcare professional or medical coder.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: CAPTURED SERVICES FOR CODING */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#0284c7' }}>
                  2
                </div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem' }}>
                    Captured Services Awaiting Coding
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Healthcare services captured in Module 5. Assign Procedure (CPT/HCPCS) and Diagnosis (ICD-10) codes for each service.
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 12,
                  backgroundColor: summaryMetrics.pendingCoding === 0 ? '#dcfce7' : '#fef3c7',
                  color: summaryMetrics.pendingCoding === 0 ? '#15803d' : '#b45309',
                  border: `1px solid ${summaryMetrics.pendingCoding === 0 ? '#86efac' : '#fde68a'}`
                }}
              >
                {summaryMetrics.pendingCoding === 0
                  ? '✓ All Services Assigned'
                  : `${summaryMetrics.pendingCoding} Services Pending Codes`}
              </span>
            </div>

            {/* TABLE: Captured Services Awaiting Coding */}
            <div className="responsive-table-wrap" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.875rem'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Service Date</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Service Description</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Charge</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Procedure Code</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Diagnosis Code</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {codingRecord?.services.map((service, idx) => {
                    const isComplete = Boolean(service.procedureCode?.trim() && service.diagnosisCode?.trim());
                    const cleanProc = medicalCodingService.cleanCode(service.procedureCode);
                    const cleanDiag = medicalCodingService.cleanCode(service.diagnosisCode);

                    return (
                      <tr
                        key={service.id || idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={13} color="#64748b" />
                            <span>31-05-2026</span>
                          </div>
                        </td>

                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                          <div>{service.serviceDescription}</div>
                          {service.category && (
                            <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 500 }}>
                              {service.category}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                          ${Number(service.totalCharge || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td style={{ padding: '10px 12px' }}>
                          <select
                            className="form-select no-icon"
                            value={cleanProc}
                            onChange={(e) => handleServiceChange(service.id, 'procedureCode', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              fontSize: '0.8125rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              borderColor: cleanProc ? '#bfdbfe' : '#f87171',
                              backgroundColor: cleanProc ? '#eff6ff' : '#fef2f2'
                            }}
                          >
                            <option value="">-- Select CPT/HCPCS --</option>
                            {STANDARD_CPT_CODES.map((cpt) => (
                              <option key={cpt.code} value={cpt.code}>
                                {cpt.code} - {cpt.description.slice(0, 32)}...
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: '10px 12px' }}>
                          <select
                            className="form-select no-icon"
                            value={cleanDiag}
                            onChange={(e) => handleServiceChange(service.id, 'diagnosisCode', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              fontSize: '0.8125rem',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: '#7c3aed',
                              borderColor: cleanDiag ? '#ddd6fe' : '#f87171',
                              backgroundColor: cleanDiag ? '#f5f3ff' : '#fef2f2'
                            }}
                          >
                            <option value="">-- Select ICD-10 --</option>
                            {codingRecord?.diagnoses.map((d) => (
                              <option key={`enc-${d.code}`} value={d.code}>
                                {d.code} - {d.description} ({d.type})
                              </option>
                            ))}
                            {STANDARD_ICD10_CODES.filter(
                              (std) => !codingRecord?.diagnoses.some((d) => d.code === std.code)
                            ).map((std) => (
                              <option key={`std-${std.code}`} value={std.code}>
                                {std.code} - {std.description}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              backgroundColor: isComplete ? '#dcfce7' : '#fee2e2',
                              color: isComplete ? '#15803d' : '#b91c1c',
                              border: `1px solid ${isComplete ? '#86efac' : '#fca5a5'}`
                            }}
                          >
                            {isComplete ? '✓ Completed' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* STEP 3: DIAGNOSIS CODING */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#7c3aed' }}>
                  3
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem' }}>
                      Diagnosis Coding
                    </h2>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac'
                      }}
                    >
                      Final Selected Codes
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ICD-10 Clinical Modification (CM) codes justifying medical necessity. Mark one code as Primary Diagnosis.
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenAddDiagnosis}
                style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#7c3aed', fontSize: '0.8125rem', padding: '6px 12px' }}
              >
                <Plus size={14} />
                <span>Add Diagnosis</span>
              </button>
            </div>

            {/* Diagnosis Coding Table */}
            <div className="responsive-table-wrap" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.875rem'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155', width: '22%' }}>Primary / Secondary</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155', width: '38%' }}>Diagnosis Description</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155', width: '18%' }}>ICD-10 Code</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155', width: '12%' }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155', width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codingRecord?.diagnoses.map((dx, idx) => {
                    const isPrimary = dx.isPrimary || dx.type === 'Primary';
                    return (
                      <tr
                        key={dx.id || idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isPrimary ? '#fbf8ff' : '#ffffff'
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '3px 8px',
                              borderRadius: 14,
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              backgroundColor: isPrimary ? '#f3e8ff' : '#f1f5f9',
                              color: isPrimary ? '#7e22ce' : '#475569',
                              border: `1px solid ${isPrimary ? '#d8b4fe' : '#cbd5e1'}`
                            }}
                          >
                            {isPrimary ? '★ Primary' : 'Secondary'}
                          </span>
                        </td>

                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {dx.description}
                        </td>

                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '0.875rem',
                              color: '#6d28d9',
                              backgroundColor: '#faf5ff',
                              padding: '2px 8px',
                              borderRadius: 4,
                              border: '1px solid #e9d5ff'
                            }}
                          >
                            {dx.code}
                          </span>
                        </td>

                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#15803d',
                              backgroundColor: '#dcfce7',
                              padding: '2px 6px',
                              borderRadius: 4,
                              border: '1px solid #86efac'
                            }}
                          >
                            ✓ {dx.status || 'Validated'}
                          </span>
                        </td>

                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            {!isPrimary && (
                              <button
                                type="button"
                                onClick={() => handleSetAsPrimaryDiagnosis(dx.id)}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  borderRadius: 4,
                                  border: '1px solid #c084fc',
                                  backgroundColor: '#f3e8ff',
                                  color: '#7e22ce',
                                  cursor: 'pointer'
                                }}
                                title="Mark as Primary Diagnosis"
                              >
                                Set Primary
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveDiagnosis(dx.id)}
                              style={{
                                padding: '2px 6px',
                                fontSize: '0.6875rem',
                                fontWeight: 700,
                                borderRadius: 4,
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                cursor: 'pointer'
                              }}
                              title="Remove Diagnosis"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* STEP 4: PROCEDURE CODING */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#2563eb' }}>
                  4
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem' }}>
                      Procedure Coding
                    </h2>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '2px 8px',
                        borderRadius: 12,
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        border: '1px solid #86efac'
                      }}
                    >
                      Final Selected Codes
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Standardized CPT / HCPCS procedure codes linked to captured services with billing modifiers and units.
                  </span>
                </div>
              </div>
            </div>

            {/* Procedure Coding Table */}
            <div className="responsive-table-wrap" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.875rem'
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Service Description</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>CPT / HCPCS Code</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Modifier</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Units</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Charge</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155' }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 800, color: '#334155', textAlign: 'right' }}>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {codingRecord?.procedures.map((proc, idx) => (
                    <tr
                      key={proc.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                        {proc.serviceDescription}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            color: '#1e40af',
                            backgroundColor: '#eff6ff',
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid #bfdbfe'
                          }}
                        >
                          CPT: {proc.cptCode}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>
                        {proc.modifier || '—'}
                      </td>

                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                        {proc.units || 1}
                      </td>

                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                        ${Number(proc.chargeAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac'
                          }}
                        >
                          Ready
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditProcedure(proc)}
                          style={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            color: '#2563eb',
                            padding: 4
                          }}
                          title="Edit Procedure Details"
                        >
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CODING VALIDATION SECTION */}
          <div className="form-section-card">
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#059669' }}>
                  5
                </div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem' }}>
                    Coding Validation
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Automated clinical rules audit checking code completeness, valid pairings, primary diagnosis, and modifiers.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {lastValidatedAt && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Audited at: {lastValidatedAt}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleRunValidation}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <ShieldCheck size={14} color="#059669" />
                  <span>Re-run Audit</span>
                </button>
              </div>
            </div>

            {/* Validation Messages Container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {validationResult.messages.map((msg) => {
                const isError = msg.level === 'Error';
                const isReview = msg.level === 'Review';

                const bgColor = isError ? '#fef2f2' : isReview ? '#fffbeb' : '#f0fdf4';
                const borderColor = isError ? '#fecaca' : isReview ? '#fde68a' : '#bbf7d0';
                const textColor = isError ? '#991b1b' : isReview ? '#92400e' : '#166534';
                const iconColor = isError ? '#dc2626' : isReview ? '#d97706' : '#16a34a';

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 8,
                      backgroundColor: bgColor,
                      border: `1px solid ${borderColor}`
                    }}
                  >
                    <div style={{ marginTop: 2 }}>
                      {isError ? (
                        <AlertCircle size={16} color={iconColor} />
                      ) : isReview ? (
                        <AlertTriangle size={16} color={iconColor} />
                      ) : (
                        <CheckCircle2 size={16} color={iconColor} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: textColor }}>
                        {msg.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: textColor, opacity: 0.9, marginTop: 2 }}>
                        {msg.message}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: isError ? '#fee2e2' : isReview ? '#fef3c7' : '#dcfce7',
                        color: textColor
                      }}
                    >
                      {isError ? 'Coding Error' : isReview ? 'Needs Review' : 'Coding Complete'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CODING SUMMARY CARD */}
          <div
            className="form-section-card"
            style={{
              border: '1px solid #bfdbfe',
              background: 'linear-gradient(180deg, #f0f7ff 0%, #ffffff 100%)',
              boxShadow: '0 4px 16px -2px rgba(37, 99, 235, 0.08)'
            }}
          >
            <div className="form-section-header">
              <div className="form-section-title-wrap">
                <div className="section-number-badge" style={{ backgroundColor: '#2563eb' }}>
                  6
                </div>
                <div>
                  <h2 className="section-title-text" style={{ margin: 0, fontSize: '1.125rem', color: '#1e3a8a' }}>
                    Coding Summary
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: '#1d4ed8' }}>
                    Comprehensive medical coding status and financial readiness for claim creation
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '5px 12px',
                  borderRadius: 16,
                  backgroundColor: summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#dcfce7' : '#fef3c7',
                  color: summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#15803d' : '#b45309',
                  border: `1px solid ${summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#86efac' : '#fde68a'}`,
                  fontWeight: 800,
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? <Check size={14} /> : <Clock size={14} />}
                <span>{summaryMetrics.statusText}</span>
              </div>
            </div>

            {/* Quick Stat Blocks */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 14
              }}
            >
              <div style={{ backgroundColor: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b' }}>Total Captured Services</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                  {summaryMetrics.totalCapturedServices}
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#166534' }}>Services Coded</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', marginTop: 2 }}>
                  {summaryMetrics.servicesCoded}
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: 12, borderRadius: 8, border: `1px solid ${summaryMetrics.pendingCoding > 0 ? '#fed7aa' : '#e2e8f0'}` }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: summaryMetrics.pendingCoding > 0 ? '#c2410c' : '#64748b' }}>Pending Coding</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: summaryMetrics.pendingCoding > 0 ? '#ea580c' : '#0f172a', marginTop: 2 }}>
                  {summaryMetrics.pendingCoding}
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #ddd6fe' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6d28d9' }}>Diagnosis Codes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7c3aed', marginTop: 2 }}>
                  {summaryMetrics.diagnosisCodes}
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#1d4ed8' }}>Procedure Codes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
                  {summaryMetrics.procedureCodes}
                </div>
              </div>
            </div>

            {/* Total Charge & Claim Readiness */}
            <div
              style={{
                backgroundColor: summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${summaryMetrics.statusText === 'READY FOR CLAIM CREATION' ? '#bbf7d0' : '#fde68a'}`,
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#16a34a" />
                <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#166534' }}>
                  Ready to bill: ${summaryMetrics.totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                {summaryMetrics.statusText === 'READY FOR CLAIM CREATION'
                  ? 'All services successfully assigned valid CPT & ICD-10 codes'
                  : 'Complete missing codes to proceed'}
              </span>
            </div>
          </div>
        </div>

        {/* ================================================== */}
        {/* RIGHT COLUMN: PIPELINE PANEL (INDEPENDENTLY SCROLLABLE) */}
        {/* ================================================== */}
        <div
          style={{
            position: 'sticky',
            top: 20,
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}
          className="pipeline-panel-container"
        >
          <div
            className="form-section-card"
            style={{
              padding: 20,
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06)'
            }}
          >
            {/* Pipeline Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 14,
                marginBottom: 16,
                borderBottom: '1.5px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Pipeline
                  </h3>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                    Automated Clinical Coding Workflow
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0'
                }}
              >
                5 Stages Active
              </span>
            </div>

            {/* PIPELINE STAGES LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* STAGE 1: Extracting Keywords */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div
                  onClick={() => togglePipelineStage(1)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b' }}>
                      1. Extracting Keywords
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: aiResponse ? '#16a34a' : '#64748b',
                        fontWeight: 700,
                        backgroundColor: aiResponse ? '#dcfce7' : '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: 4
                      }}
                    >
                      {aiResponse ? `✓ AI Extracted (${aiResponse.keywords.length})` : 'Awaiting Description'}
                    </span>
                  </div>
                  {expandedPipelineStages[1] ? <ChevronDown size={15} color="#64748b" /> : <ChevronRight size={15} color="#64748b" />}
                </div>

                {expandedPipelineStages[1] && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#475569' }}>
                    {aiResponse && aiResponse.keywords.length > 0 ? (
                      <>
                        <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '0.6875rem' }}>
                          Clinical entities identified by Groq AI from Doctor's Description:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {aiResponse.keywords.map((kw) => (
                            <span
                              key={kw}
                              style={{
                                padding: '2px 8px',
                                backgroundColor: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: 4,
                                fontSize: '0.6875rem',
                                color: '#1d4ed8',
                                fontWeight: 600
                              }}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                        No clinical entities extracted yet. Enter or paste the doctor's clinical description above and click "Generate AI Coding Suggestions".
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STAGE 2: Shortlisting Candidate Groups */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div
                  onClick={() => togglePipelineStage(2)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b' }}>
                      2. Shortlisting Candidate Groups
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: shortlistedCandidateGroups.length > 0 ? '#16a34a' : '#64748b',
                        fontWeight: 700,
                        backgroundColor: shortlistedCandidateGroups.length > 0 ? '#dcfce7' : '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: 4
                      }}
                    >
                      {shortlistedCandidateGroups.length > 0 ? `✓ ${shortlistedCandidateGroups.length} Groups` : 'Awaiting Description'}
                    </span>
                  </div>
                  {expandedPipelineStages[2] ? <ChevronDown size={15} color="#64748b" /> : <ChevronRight size={15} color="#64748b" />}
                </div>

                {expandedPipelineStages[2] && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                    {shortlistedCandidateGroups.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {shortlistedCandidateGroups.map((item) => (
                          <div key={item.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', minWidth: 70 }}>
                              {item.cat}
                            </span>
                            <span style={{ color: '#475569' }}>{item.desc}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                        No candidate groups shortlisted yet. Enter clinical description to trigger AI analysis.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STAGE 3: Selecting Top Relevant Groups */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div
                  onClick={() => togglePipelineStage(3)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b' }}>
                      3. Selecting Top Relevant Groups
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: topRelevantGroups.length > 0 ? '#16a34a' : '#64748b',
                        fontWeight: 700,
                        backgroundColor: topRelevantGroups.length > 0 ? '#dcfce7' : '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: 4
                      }}
                    >
                      {topRelevantGroups.length > 0 ? `✓ Top ${topRelevantGroups.length} AI Matches` : 'Awaiting Description'}
                    </span>
                  </div>
                  {expandedPipelineStages[3] ? <ChevronDown size={15} color="#64748b" /> : <ChevronRight size={15} color="#64748b" />}
                </div>

                {expandedPipelineStages[3] && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                    {topRelevantGroups.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {topRelevantGroups.map((grp) => (
                          <div key={grp.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>{grp.code}</span>
                              <span style={{ color: '#475569' }}>{grp.label}</span>
                            </div>
                            <span style={{ fontWeight: 800, color: '#15803d', fontSize: '0.6875rem' }}>{grp.score}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                        No top relevant groups selected yet. Enter clinical description to trigger AI analysis.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ==================================================== */}
              {/* STAGE 4: GATHERING CANDIDATE CODES (EXPANDED HIERARCHY) */}
              {/* ==================================================== */}
              <div
                style={{
                  border: '1.5px solid #93c5fd',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 10px rgba(37, 99, 235, 0.08)'
                }}
              >
                {/* Stage Header */}
                <div
                  onClick={() => togglePipelineStage(4)}
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: '#eff6ff',
                    borderBottom: expandedPipelineStages[4] ? '1px solid #bfdbfe' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#1e40af' }}>
                      4. Gathering Candidate Codes
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: 4
                      }}
                    >
                      Active Stage
                    </span>
                  </div>
                  {expandedPipelineStages[4] ? <ChevronDown size={16} color="#2563eb" /> : <ChevronRight size={16} color="#2563eb" />}
                </div>

                {/* Stage 4 Content */}
                {expandedPipelineStages[4] && (
                  <div style={{ padding: '14px 16px' }}>
                    {/* Two Main Category Tabs: 1. Diagnosis, 2. Procedures */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        marginBottom: 16,
                        backgroundColor: '#f1f5f9',
                        padding: 4,
                        borderRadius: 8
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setCandidateActiveCategory('Diagnosis')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: candidateActiveCategory === 'Diagnosis' ? 800 : 600,
                          backgroundColor: candidateActiveCategory === 'Diagnosis' ? '#ffffff' : 'transparent',
                          color: candidateActiveCategory === 'Diagnosis' ? '#0f172a' : '#64748b',
                          border: candidateActiveCategory === 'Diagnosis' ? '1px solid #cbd5e1' : 'none',
                          boxShadow: candidateActiveCategory === 'Diagnosis' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <span>1. Diagnosis</span>
                        <span style={{ fontSize: '0.6875rem', color: '#7c3aed', fontWeight: 800 }}>
                          (ICD-10)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCandidateActiveCategory('Procedures')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: candidateActiveCategory === 'Procedures' ? 800 : 600,
                          backgroundColor: candidateActiveCategory === 'Procedures' ? '#ffffff' : 'transparent',
                          color: candidateActiveCategory === 'Procedures' ? '#0f172a' : '#64748b',
                          border: candidateActiveCategory === 'Procedures' ? '1px solid #cbd5e1' : 'none',
                          boxShadow: candidateActiveCategory === 'Procedures' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}
                      >
                        <span>2. Procedures</span>
                        <span style={{ fontSize: '0.6875rem', color: '#2563eb', fontWeight: 800 }}>
                          (CPT/HCPCS)
                        </span>
                      </button>
                    </div>

                    {/* HIERARCHICAL CANDIDATE CODE TREE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {candidateActiveCategory === 'Diagnosis' ? (
                        <>
                          {CANDIDATE_DIAGNOSIS_GROUPS.map((group) => (
                            <div key={group.parentCode} style={{ display: 'flex', flexDirection: 'column' }}>
                              {/* Parent Code Group Header: Bold, parent code first, em dash, description */}
                              <div
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  lineHeight: 1.4,
                                  marginBottom: 6
                                }}
                              >
                                <span style={{ fontFamily: 'monospace', color: '#6d28d9', fontWeight: 800 }}>
                                  {group.parentCode}
                                </span>
                                {' '}—{' '}
                                <span>{group.description}</span>
                              </div>

                              {/* Child Codes List: Indented with subtle vertical line on the left */}
                              <div
                                style={{
                                  marginLeft: 8,
                                  paddingLeft: 12,
                                  borderLeft: '2px solid #cbd5e1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6
                                }}
                              >
                                {group.children.map((child) => (
                                  <div
                                    key={child.code}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'baseline',
                                      gap: 10,
                                      fontSize: '0.75rem',
                                      padding: '2px 4px',
                                      borderRadius: 4
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 800,
                                        color: '#1e293b',
                                        minWidth: 54,
                                        letterSpacing: '0.02em'
                                      }}
                                    >
                                      {child.code}
                                    </span>
                                    <span style={{ color: '#475569', lineHeight: 1.4 }}>
                                      {child.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {CANDIDATE_PROCEDURE_GROUPS.map((group) => (
                            <div key={group.parentCode} style={{ display: 'flex', flexDirection: 'column' }}>
                              {/* Parent Procedure Code Group Header */}
                              <div
                                style={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  lineHeight: 1.4,
                                  marginBottom: 6
                                }}
                              >
                                <span style={{ fontFamily: 'monospace', color: '#1e40af', fontWeight: 800 }}>
                                  {group.parentCode}
                                </span>
                                {' '}—{' '}
                                <span>{group.description}</span>
                              </div>

                              {/* Child Procedure Codes List */}
                              <div
                                style={{
                                  marginLeft: 8,
                                  paddingLeft: 12,
                                  borderLeft: '2px solid #cbd5e1',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6
                                }}
                              >
                                {group.children.map((child) => (
                                  <div
                                    key={child.code}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'baseline',
                                      gap: 10,
                                      fontSize: '0.75rem',
                                      padding: '2px 4px',
                                      borderRadius: 4
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontFamily: 'monospace',
                                        fontWeight: 800,
                                        color: '#1e293b',
                                        minWidth: 54,
                                        letterSpacing: '0.02em'
                                      }}
                                    >
                                      {child.code}
                                    </span>
                                    <span style={{ color: '#475569', lineHeight: 1.4 }}>
                                      {child.description}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STAGE 5: Final Code Selection / Results */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div
                  onClick={() => togglePipelineStage(5)}
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#1e293b' }}>
                      5. Final Code Selection / Results
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#16a34a', fontWeight: 700, backgroundColor: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                      ✓ {codingRecord?.diagnoses.length || 0} Dx • {codingRecord?.procedures.length || 0} Px
                    </span>
                  </div>
                  {expandedPipelineStages[5] ? <ChevronDown size={15} color="#64748b" /> : <ChevronRight size={15} color="#64748b" />}
                </div>

                {expandedPipelineStages[5] && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Active Diagnoses ({codingRecord?.diagnoses.length || 0})
                      </span>
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {codingRecord && codingRecord.diagnoses.length > 0 ? (
                          codingRecord.diagnoses.map((dx) => {
                            const isPrimary = dx.isPrimary || dx.type === 'Primary';
                            return (
                              <div key={dx.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#7e22ce', minWidth: 46 }}>{dx.code}</span>
                                <span style={{ color: '#0f172a' }}>{dx.description} {isPrimary ? '(Primary)' : '(Secondary)'}</span>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No diagnoses assigned yet</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Assigned Procedures ({codingRecord?.procedures.length || 0})
                      </span>
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {codingRecord && codingRecord.procedures.length > 0 ? (
                          codingRecord.procedures.map((px) => (
                            <div key={px.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1d4ed8', minWidth: 46 }}>{px.cptCode}</span>
                              <span style={{ color: '#0f172a' }}>{px.serviceDescription} (${px.chargeAmount})</span>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No procedures assigned yet</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* BOTTOM ACTION BUTTONS */}
      {/* ==================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          padding: '16px 24px',
          backgroundColor: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onNavigateToDashboard}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} />
            <span>Dashboard</span>
          </button>

          {onNavigateToChargeCapture && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onNavigateToChargeCapture(selectedPatientId)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>Back to Charge Capture</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Save Draft */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSaveDraft}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={16} />
            <span>Save Draft</span>
          </button>

          {/* Validate Codes */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleRunValidation}
            style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#4f46e5' }}
          >
            <ShieldCheck size={16} />
            <span>Validate Codes</span>
          </button>

          {/* Complete Coding */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleCompleteCoding}
            disabled={isSaving || !validationResult.canProceedToClaim}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#059669',
              opacity: validationResult.canProceedToClaim ? 1 : 0.6
            }}
          >
            <CheckCircle2 size={16} />
            <span>Complete Coding</span>
          </button>

          {/* Proceed to Claim Creation */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleProceedToClaimCreation}
            disabled={!validationResult.canProceedToClaim}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: validationResult.canProceedToClaim ? '#2563eb' : '#94a3b8',
              cursor: validationResult.canProceedToClaim ? 'pointer' : 'not-allowed',
              opacity: validationResult.canProceedToClaim ? 1 : 0.6
            }}
          >
            <span>Proceed to Claim Creation</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL: ADD DIAGNOSIS */}
      {/* ==================================================== */}
      {isAddDiagnosisModalOpen && (
        <div className="modal-backdrop animate-fade-in" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: 520, padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stethoscope size={20} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                  Add ICD-10 Diagnosis Code
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDiagnosisModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewDiagnosis}>
              <div className="form-group">
                <label className="form-label">Diagnosis Category & Classification</label>
                <select
                  className="form-select no-icon"
                  value={newDiagnosisCode}
                  onChange={(e) => {
                    const selected = STANDARD_ICD10_CODES.find((c) => c.code === e.target.value);
                    setNewDiagnosisCode(e.target.value);
                    if (selected) setNewDiagnosisDesc(selected.description);
                  }}
                >
                  {STANDARD_ICD10_CODES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} — {item.description} ({item.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">ICD-10 Code *</label>
                  <input
                    type="text"
                    required
                    className="form-input no-icon"
                    placeholder="e.g. I10, R07.9, E11.9"
                    value={newDiagnosisCode}
                    onChange={(e) => setNewDiagnosisCode(e.target.value.toUpperCase())}
                    style={{ fontFamily: 'monospace', fontWeight: 800, color: '#6d28d9' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Diagnosis Type *</label>
                  <select
                    className="form-select no-icon"
                    value={newDiagnosisType}
                    onChange={(e) => setNewDiagnosisType(e.target.value as 'Primary' | 'Secondary')}
                  >
                    <option value="Primary">Primary Diagnosis</option>
                    <option value="Secondary">Secondary Diagnosis</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Diagnosis Description *</label>
                <input
                  type="text"
                  required
                  className="form-input no-icon"
                  placeholder="e.g. Essential Hypertension, Chest Pain"
                  value={newDiagnosisDesc}
                  onChange={(e) => setNewDiagnosisDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddDiagnosisModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: '#7c3aed' }}
                >
                  Save Diagnosis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: EDIT PROCEDURE CODE */}
      {/* ==================================================== */}
      {isEditProcedureModalOpen && editingProcedure && (
        <div className="modal-backdrop animate-fade-in" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: 520, padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCode2 size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#0f172a' }}>
                  Edit Procedure Code & Modifiers
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProcedureModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditProcedure}>
              <div className="form-group">
                <label className="form-label">Service Description</label>
                <input
                  type="text"
                  disabled
                  className="form-input no-icon"
                  value={editingProcedure.serviceDescription}
                  style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">CPT / HCPCS Code *</label>
                  <input
                    type="text"
                    required
                    className="form-input no-icon"
                    value={editingProcedure.cptCode}
                    onChange={(e) =>
                      setEditingProcedure({ ...editingProcedure, cptCode: e.target.value.trim() })
                    }
                    style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1d4ed8' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Modifier</label>
                  <select
                    className="form-select no-icon"
                    value={editingProcedure.modifier || '—'}
                    onChange={(e) =>
                      setEditingProcedure({ ...editingProcedure, modifier: e.target.value })
                    }
                  >
                    {STANDARD_MODIFIERS.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Units (Quantity)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input no-icon"
                    value={editingProcedure.units || 1}
                    onChange={(e) =>
                      setEditingProcedure({
                        ...editingProcedure,
                        units: Math.max(1, parseInt(e.target.value) || 1)
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Charge Amount ($)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input no-icon"
                    value={editingProcedure.chargeAmount}
                    onChange={(e) =>
                      setEditingProcedure({
                        ...editingProcedure,
                        chargeAmount: Math.max(0, parseFloat(e.target.value) || 0)
                      })
                    }
                    style={{ fontWeight: 800, color: '#0f172a' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsEditProcedureModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  Update Procedure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
