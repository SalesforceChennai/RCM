import { pool } from '../db.ts';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { getLangChainChatModel } from './sqlAgent.ts';
import type { AssistantResponse } from './rcmAssistant.ts';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sqlExecuted?: string;
  category?: string;
}

export interface ThreadState {
  threadId: string;
  turns: ChatTurn[];
  lastTopic?: string;
  lastSql?: string;
  updatedAt: string;
}

// ============================================================================
// SINGLETON POSTGRES CHECKPOINTER
// ============================================================================

let checkpointerInstance: PostgresSaver | null = null;
let isCheckpointerInitialized = false;

export async function getPostgresCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointerInstance) {
    checkpointerInstance = new PostgresSaver(pool);
  }

  if (!isCheckpointerInitialized) {
    try {
      await checkpointerInstance.setup();
      isCheckpointerInitialized = true;
      console.log('✅ [LangGraph Memory] PostgreSQL checkpointer tables verified in rcm_database');
    } catch (err: any) {
      console.warn('[LangGraph Memory] Checkpointer setup notice:', err?.message);
      // In case tables were already initialized concurrently
      isCheckpointerInitialized = true;
    }
  }

  return checkpointerInstance;
}

// ============================================================================
// THREAD MEMORY RETRIEVAL & PERSISTENCE
// ============================================================================

const MAX_HISTORY_TURNS = 20;

export interface WorkflowState {
  activeIntent?: 'patient.registration' | 'appointment.create' | 'patient.doctor_query' | 'patient.appointments' | null;
  patientName?: string | null;
  patientId?: string | null;
  patientCode?: string | null;
  doctorName?: string | null;
  doctorId?: string | null;
  departmentName?: string | null;
  departmentId?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  reasonForVisit?: string | null;
  symptoms?: string | null;
  recommendedSpecialty?: string | null;
  recommendedDoctorNames?: string[] | null;
  lastAppointmentId?: string | null;
  lastAppointmentCode?: string | null;
  lastAppointmentDate?: string | null;
  lastAppointmentTime?: string | null;
  lastAppointmentsSummary?: Array<{
    appointmentCode: string;
    doctorName: string;
    departmentName: string;
    appointmentDate: string;
    appointmentTime: string;
    status: string;
  }> | null;
  missingRequiredFields?: string[];
  workflowStatus?:
    | 'idle'
    | 'collecting_appointment_details'
    | 'patient_not_found_prompt'
    | 'collecting_registration_details'
    | 'awaiting_registration_confirmation'
    | 'awaiting_appointment_confirmation'
    | 'completed';
  pendingAction?: {
    type: string;
    payload: any;
  } | null;
  registrationDraft?: {
    firstName?: string;
    lastName?: string;
    dob?: string;
    gender?: string;
    phone?: string;
    email?: string;
    address?: string;
    bloodGroup?: string;
  } | null;
}

/**
 * Loads conversation history for a given thread_id from PostgreSQL.
 */
export async function getThreadHistory(threadId: string): Promise<ChatTurn[]> {
  if (!threadId) return [];

  try {
    const saver = await getPostgresCheckpointer();
    const config = { configurable: { thread_id: threadId } };
    const tuple = await saver.getTuple(config);

    if (tuple && tuple.checkpoint && tuple.checkpoint.channel_values) {
      const turns = (tuple.checkpoint.channel_values as any).turns;
      if (Array.isArray(turns)) {
        return turns;
      }
    }
  } catch (err: any) {
    console.warn(`[LangGraph Memory] Could not load checkpoint for thread '${threadId}':`, err?.message);
  }

  return [];
}

/**
 * Loads workflow state for a given thread_id from PostgreSQL checkpointer.
 */
export async function getThreadWorkflowState(threadId: string): Promise<WorkflowState | null> {
  if (!threadId) return null;

  try {
    const saver = await getPostgresCheckpointer();
    const config = { configurable: { thread_id: threadId } };
    const tuple = await saver.getTuple(config);

    if (tuple && tuple.checkpoint && tuple.checkpoint.channel_values) {
      const state = (tuple.checkpoint.channel_values as any).workflowState;
      if (state && typeof state === 'object') {
        return state;
      }
    }
  } catch (err: any) {
    console.warn(`[LangGraph Memory] Could not load workflow state for thread '${threadId}':`, err?.message);
  }

  return null;
}

export function inferCategoryFromContent(content?: string, sql?: string): string | undefined {
  const combined = ((content || '') + ' ' + (sql || '')).toLowerCase();
  if (combined.includes('appointment')) return 'appointments';
  if (combined.includes('claim')) return 'claims';
  if (combined.includes('patient')) return 'patients';
  if (combined.includes('payment') || combined.includes('remittance')) return 'payments';
  if (combined.includes('insurance') || combined.includes('payer')) return 'insurance';
  if (combined.includes('doctor')) return 'doctors';
  if (combined.includes('department')) return 'departments';
  return undefined;
}

/**
 * Saves a new turn (user message + assistant response) and workflow state to PostgreSQL checkpointer.
 */
export async function saveThreadTurn(
  threadId: string,
  userMessage: string,
  assistantResponse: AssistantResponse,
  category?: string,
  workflowState?: WorkflowState | null
): Promise<void> {
  if (!threadId) return;

  try {
    const saver = await getPostgresCheckpointer();
    const config = { configurable: { thread_id: threadId } };
    const existingTurns = await getThreadHistory(threadId);

    const effectiveCategory =
      category || inferCategoryFromContent(assistantResponse.message, assistantResponse.sqlExecuted);

    const now = new Date().toISOString();
    const newTurns: ChatTurn[] = [
      ...existingTurns,
      {
        role: 'user',
        content: userMessage,
        timestamp: now
      },
      {
        role: 'assistant',
        content: assistantResponse.message,
        timestamp: now,
        sqlExecuted: assistantResponse.sqlExecuted,
        category: effectiveCategory
      }
    ];

    // Keep history bounded to MAX_HISTORY_TURNS
    const trimmedTurns = newTurns.slice(-MAX_HISTORY_TURNS);
    const checkpointVersion = trimmedTurns.length;
    const checkpointId = String(Date.now()).padStart(20, '0');

    // If workflowState is not explicitly provided, preserve existing workflow state
    let stateToSave = workflowState;
    if (stateToSave === undefined) {
      stateToSave = await getThreadWorkflowState(threadId);
    }

    const checkpoint = {
      v: 1,
      id: checkpointId,
      ts: now,
      channel_values: {
        threadId,
        turns: trimmedTurns,
        lastSql: assistantResponse.sqlExecuted,
        lastTopic: effectiveCategory,
        workflowState: stateToSave !== undefined ? stateToSave : null,
        updatedAt: now
      },
      channel_versions: {
        turns: checkpointVersion,
        lastSql: checkpointVersion,
        lastTopic: checkpointVersion,
        workflowState: checkpointVersion,
        updatedAt: checkpointVersion
      },
      versions_seen: {}
    };

    const newVersions = {
      turns: checkpointVersion,
      lastSql: checkpointVersion,
      lastTopic: checkpointVersion,
      workflowState: checkpointVersion,
      updatedAt: checkpointVersion
    };

    const metadata = {
      source: 'update' as const,
      step: checkpointVersion,
      writes: { turns: checkpointVersion },
      parents: {}
    };

    await saver.put(config, checkpoint as any, metadata as any, newVersions);
  } catch (err: any) {
    console.warn(`[LangGraph Memory] Error saving checkpoint for thread '${threadId}':`, err?.message);
  }
}

// ============================================================================
// FOLLOW-UP CONTEXTUALIZATION (PRONOUN / ANAPHORA RESOLUTION)
// ============================================================================

const FOLLOW_UP_INDICATORS = /\b(them|those|these|it|their|they|of them|which of|same|also|show them|list them|how many of them|first \d+ of them)\b/i;

/**
 * Rewrites a follow-up query containing references like "them", "those", "it"
 * into a standalone, explicit RCM query using recent thread turns.
 */
export async function resolveFollowUpQuery(
  rawMessage: string,
  history: ChatTurn[]
): Promise<{ resolvedMessage: string; wasContextualized: boolean }> {
  const trimmed = rawMessage.trim();

  // If no history exists or no follow-up indicators, return raw query
  if (history.length === 0 || !FOLLOW_UP_INDICATORS.test(trimmed)) {
    return { resolvedMessage: trimmed, wasContextualized: false };
  }

  // Take the last 4 turns for context
  const recentTurns = history.slice(-4);
  const formattedHistory = recentTurns
    .map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`)
    .join('\n');

  try {
    const model = await getLangChainChatModel();
    if (!model) {
      return { resolvedMessage: trimmed, wasContextualized: false };
    }

    const contextualizePrompt = `You are an RCM conversational query disambiguator.
Given the recent chat history and the user's follow-up question, rewrite the follow-up question into a standalone, explicit RCM question.
Replace all pronouns ("them", "those", "it", "their", "they") with the exact entity/filter being referenced (e.g. "registered patients", "pending claims", "appointments").

Recent Conversation:
${formattedHistory}

Follow-Up Question: "${trimmed}"

RULES:
1. If the question refers to "them" after discussing registered patients, replace "them" with "registered patients" (e.g. "Show me the first 5 registered patients").
2. If the question refers to "those claims" or "them" after discussing pending claims, replace it with "pending claims" (e.g. "Show pending claims" or "Which pending claims have payments?").
3. If the question refers to appointments, keep the appointment context.
4. If already clear or unrelated, return the question unchanged.
5. Return ONLY the rewritten question text. Do not add quotes, markdown, or explanations.`;

    const response = await model.invoke(contextualizePrompt, {
      signal: AbortSignal.timeout(8000)
    });

    const rewritten = typeof response.content === 'string'
      ? response.content.replace(/^["']|["']$/g, '').trim()
      : trimmed;

    if (rewritten && rewritten.length > 3 && rewritten.toLowerCase() !== trimmed.toLowerCase()) {
      console.log(`[LangGraph Memory] Contextualized query: "${trimmed}" -> "${rewritten}"`);
      return { resolvedMessage: rewritten, wasContextualized: true };
    }
  } catch (err: any) {
    console.warn('[LangGraph Memory] Contextualization skipped:', err?.message);
  }

  return { resolvedMessage: trimmed, wasContextualized: false };
}
