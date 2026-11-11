import { query } from '../db.ts';
import { config } from '../config.ts';

// ============================================================================
// SQL DATABASE SAFETY & VALIDATION
// ============================================================================

const PROHIBITED_SQL_KEYWORDS = [
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\b/i,
  /\bCREATE\s+DATABASE\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bDELETE\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\b/i,
  /\bEXEC\b/i,
  /\bEXECUTE\b/i
];

export function validateSafeReadOnlySql(sql: string): { isSafe: boolean; reason?: string } {
  const trimmed = sql.trim();

  // Must begin with SELECT or WITH (for CTE queries) or EXPLAIN
  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    return {
      isSafe: false,
      reason: 'Safety policy violation: Only read-only SELECT and WITH queries are permitted through the SQL Agent.'
    };
  }

  // Check for any forbidden dangerous keywords
  for (const pattern of PROHIBITED_SQL_KEYWORDS) {
    if (pattern.test(trimmed)) {
      return {
        isSafe: false,
        reason: `Safety policy violation: Detected prohibited SQL operation matching '${pattern.source}'. Write operations must use controlled RCM action tools.`
      };
    }
  }

  // Ensure no multiple statements with semicolon injection
  const statements = trimmed.split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    return {
      isSafe: false,
      reason: 'Safety policy violation: Multiple semicolon-separated SQL statements are disallowed.'
    };
  }

  return { isSafe: true };
}

export async function executeSafeReadOnlyQuery(sql: string, params: any[] = []): Promise<{
  success: boolean;
  rows?: any[];
  rowCount?: number;
  error?: string;
}> {
  const validation = validateSafeReadOnlySql(sql);
  if (!validation.isSafe) {
    return {
      success: false,
      error: validation.reason || 'Query blocked by RCM Database Safety Guardrails.'
    };
  }

  try {
    const res = await query(sql, params);
    return {
      success: true,
      rows: res.rows,
      rowCount: res.rowCount ?? res.rows.length
    };
  } catch (err: any) {
    console.error('[SQL Agent] Error executing query:', err?.message);
    return {
      success: false,
      error: 'Sorry, I couldn\'t retrieve that information from the RCM database.'
    };
  }
}

// ============================================================================
// RCM DATABASE SCHEMA DESCRIPTION (FOR LLM & INTENT ENGINE)
// ============================================================================

export const RCM_SCHEMA_CONTEXT = `
PostgreSQL Database: rcm_database

Core Tables & Schema:
1. patients (
   id VARCHAR(64) PRIMARY KEY,
   patient_id VARCHAR(64) UNIQUE, -- e.g. PAT-1001
   first_name VARCHAR(100),
   last_name VARCHAR(100),
   dob VARCHAR(50),
   gender VARCHAR(20),
   phone VARCHAR(50),
   email VARCHAR(255),
   address TEXT,
   blood_group VARCHAR(20),
   emergency_contact VARCHAR(255)
)

2. doctors (
   id VARCHAR(64) PRIMARY KEY,
   name VARCHAR(255),
   department_id VARCHAR(64),
   department_name VARCHAR(255),
   specialization VARCHAR(255),
   room_number VARCHAR(50),
   experience VARCHAR(100)
)

3. departments (
   id VARCHAR(64) PRIMARY KEY,
   name VARCHAR(255),
   icon VARCHAR(64),
   color VARCHAR(64),
   status VARCHAR(50)
)

4. appointments (
   id VARCHAR(64) PRIMARY KEY,
   appointment_code VARCHAR(64) UNIQUE, -- e.g. APT10001
   patient_id VARCHAR(64) REFERENCES patients(id),
   doctor_id VARCHAR(64) REFERENCES doctors(id),
   department_id VARCHAR(64),
   department_name VARCHAR(255),
   appointment_date VARCHAR(50), -- YYYY-MM-DD
   appointment_time VARCHAR(50), -- e.g. 10:00 AM
   duration_minutes INT,
   appointment_type VARCHAR(100),
   status VARCHAR(50), -- Confirmed, Completed, Cancelled, Rescheduled
   reason_for_visit TEXT,
   notes TEXT
)

RELATIONSHIPS & APPOINTMENT JOINS:
- appointments.patient_id joins to patients.id
- appointments.doctor_id joins to doctors.id
- appointments.department_id joins to departments.id
- To find which doctor a patient consults, or patient appointments:
  SELECT p.first_name, p.last_name, p.patient_id, d.name AS doctor_name, d.specialization,
         COALESCE(dept.name, d.department_name, a.department_name) AS department_name,
         a.appointment_code, a.appointment_date, a.appointment_time, a.status
  FROM appointments a
  JOIN patients p ON a.patient_id = p.id
  LEFT JOIN doctors d ON a.doctor_id = d.id
  LEFT JOIN departments dept ON a.department_id = dept.id
  WHERE LOWER(p.first_name) LIKE '%name%' OR LOWER(p.last_name) LIKE '%name%' OR LOWER(p.patient_id) LIKE '%name%'
  ORDER BY a.appointment_date DESC;

5. claims (
   claim_id VARCHAR(64) PRIMARY KEY, -- e.g. CLM-100001
   patient_id VARCHAR(64),
   patient_name VARCHAR(255),
   doctor VARCHAR(255),
   department VARCHAR(255),
   insurance_provider VARCHAR(255),
   claim_amount NUMERIC(12, 2),
   procedure_code VARCHAR(100),
   procedure_description TEXT,
   diagnosis_code VARCHAR(100),
   diagnosis_description TEXT,
   days_since_claim_submission INT,
   claim_status VARCHAR(50), -- Submitted, Pending, In Review, Paid, Denied, Draft
   final_payment_status VARCHAR(50), -- Paid, Unpaid
   outstanding_amount NUMERIC(12, 2),
   predicted_status VARCHAR(50),
   payment_probability NUMERIC(5, 4),
   risk_level VARCHAR(50) -- High, Medium, Low
)

6. insurance (
   id VARCHAR(64) PRIMARY KEY,
   patient_id VARCHAR(64) REFERENCES patients(id),
   insurance_provider VARCHAR(255),
   member_id VARCHAR(100),
   policy_number VARCHAR(100),
   policy_holder_name VARCHAR(255),
   insurance_status VARCHAR(50), -- Active, Inactive
   eligibility_status VARCHAR(50), -- Eligible, Ineligible
   copay_amount NUMERIC(10, 2),
   deductible NUMERIC(10, 2),
   coinsurance NUMERIC(5, 2)
)

7. charges (
   id VARCHAR(64) PRIMARY KEY,
   patient_id VARCHAR(64) REFERENCES patients(id),
   encounter_date VARCHAR(50),
   visit_type VARCHAR(100),
   insurance_provider VARCHAR(255),
   claim_status VARCHAR(50),
   total_charges NUMERIC(12, 2),
   expected_insurance_coverage NUMERIC(12, 2),
   insurance_received NUMERIC(12, 2),
   insurance_pending NUMERIC(12, 2),
   patient_responsibility NUMERIC(12, 2),
   patient_paid NUMERIC(12, 2),
   patient_pending NUMERIC(12, 2),
   total_outstanding_ar NUMERIC(12, 2)
)

8. payments (
   id VARCHAR(64) PRIMARY KEY,
   claim_id VARCHAR(64),
   patient_id VARCHAR(64),
   payment_type VARCHAR(100),
   payer VARCHAR(255),
   amount NUMERIC(12, 2),
   payment_date VARCHAR(50),
   status VARCHAR(50), -- Completed
   reference_number VARCHAR(100)
)

9. denials (
   id VARCHAR(64) PRIMARY KEY,
   claim_id VARCHAR(64),
   patient_id VARCHAR(64),
   denial_code VARCHAR(50),
   denial_reason TEXT,
   denial_amount NUMERIC(12, 2),
   denial_status VARCHAR(50),
   appeal_status VARCHAR(50) -- Under Review, Appealed, Upheld
)

10. prior_authorizations (
   id VARCHAR(64) PRIMARY KEY,
   authorization_request_id VARCHAR(64),
   patient_id VARCHAR(64) REFERENCES patients(id),
   service_name VARCHAR(255),
   procedure_code VARCHAR(50),
   diagnosis_code VARCHAR(50),
   status VARCHAR(50) -- Pending, Approved, Denied
)

11. payment_predictions (
   id VARCHAR(64) PRIMARY KEY,
   claim_id VARCHAR(64),
   prediction VARCHAR(50), -- Paid, Unpaid
   probability NUMERIC(5, 4),
   risk_level VARCHAR(50) -- High, Medium, Low
)
`;

// ============================================================================
// LANGCHAIN MODEL INITIALIZATION
// ============================================================================

export async function getLangChainChatModel(modelNameOverride?: string) {
  const groqKey = config.groqApiKey || process.env.GROQ_API_KEY;
  if (groqKey && groqKey !== 'your_groq_api_key_here') {
    try {
      const { ChatGroq } = await import('@langchain/groq');
      const modelName = modelNameOverride || config.groqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
      return new ChatGroq({
        apiKey: groqKey,
        model: modelName,
        temperature: 0.1,
        maxRetries: 2
      });
    } catch (err) {
      console.warn('[SQL Agent] Could not initialize ChatGroq:', err);
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      return new ChatOpenAI({
        apiKey: openAiKey,
        model: 'gpt-4o-mini',
        temperature: 0.1
      });
    } catch (err) {
      console.warn('[SQL Agent] Could not initialize ChatOpenAI:', err);
    }
  }

  return null;
}

export async function generateAndExecuteSqlWithLangChain(
  userQuery: string,
  conversationHistory?: Array<{ role: string; content: string }> | string
): Promise<{
  success: boolean;
  sql?: string;
  rows?: any[];
  summary?: string;
  error?: string;
} | null> {
  let model = await getLangChainChatModel();
  if (!model) return null;

  let historyContext = '';
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-4);
    historyContext = `\nRECENT CONVERSATION CONTEXT:\n` + recent.map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`).join('\n') + '\n';
  } else if (typeof conversationHistory === 'string' && conversationHistory.trim()) {
    historyContext = `\nRECENT CONVERSATION CONTEXT:\n${conversationHistory}\n`;
  }

  try {
    const prompt = `You are a certified PostgreSQL DBA and Healthcare Revenue Cycle Management (RCM) Analytics expert.
Given the schema below for 'rcm_database', generate a single, read-only SELECT SQL query to answer the user request.

DATABASE SCHEMA:
${RCM_SCHEMA_CONTEXT}
${historyContext}
CRITICAL RULES:
1. Return ONLY the raw SQL query. No explanations, no markdown formatting outside \`\`\`sql ... \`\`\`.
2. ONLY SELECT or WITH ... SELECT queries are allowed. NEVER use DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE.
3. Use exact table and column names from the schema.
4. When filtering text columns (e.g. names, statuses, departments), use LOWER(column) LIKE LOWER('%value%') or LOWER(column) = LOWER('value').
5. Limit results to 20 rows if not aggregated (e.g. LIMIT 20).
6. For questions asking which doctor a patient consults or asking about a patient's appointments, ALWAYS query the appointments table and JOIN with patients (ON a.patient_id = p.id) and doctors (ON a.doctor_id = d.id). NEVER query only the patients table.

User Question: "${userQuery}"`;

    let response;
    try {
      response = await model.invoke(prompt, {
        signal: AbortSignal.timeout(25000)
      });
    } catch (invErr: any) {
      const msg = String(invErr?.message || '');
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('TPM')) {
        console.warn('[SQL Agent] 429 limit encountered, retrying with fallback model openai/gpt-oss-20b...');
        await new Promise(r => setTimeout(r, 1000));
        const fallback = await getLangChainChatModel('openai/gpt-oss-20b');
        if (fallback) {
          response = await fallback.invoke(prompt, {
            signal: AbortSignal.timeout(25000)
          });
        } else {
          throw invErr;
        }
      } else {
        throw invErr;
      }
    }

    const rawContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    const sqlMatch = rawContent.match(/```(?:sql)?\s*([\s\S]*?)\s*```/i);
    let extractedSql = sqlMatch ? sqlMatch[1].trim() : rawContent.trim();
    extractedSql = extractedSql.replace(/^```sql/i, '').replace(/```$/, '').trim();

    // If query has multiple statements or semicolons, take the first statement
    if (extractedSql.includes(';')) {
      const statements = extractedSql.split(';').map(s => s.trim()).filter(Boolean);
      if (statements.length > 0) {
        extractedSql = statements[0] + ';';
      }
    }

    if (!extractedSql) return null;

    const validation = validateSafeReadOnlySql(extractedSql);
    if (!validation.isSafe) {
      console.warn('[SQL Agent] LLM generated query failed safety check:', validation.reason);
      return null;
    }

    const execResult = await executeSafeReadOnlyQuery(extractedSql);
    if (!execResult.success || !execResult.rows) return null;

    let summaryText: string | undefined;
    if (execResult.rows.length > 0) {
      try {
        summaryText = await summarizeResultsWithLangChain(userQuery, extractedSql, execResult.rows);
      } catch (sumErr) {
        console.warn('[SQL Agent] Could not generate summary:', sumErr);
      }
    }

    return {
      success: true,
      sql: extractedSql,
      rows: execResult.rows,
      summary: summaryText
    };
  } catch (err: any) {
    console.warn('[SQL Agent] LangChain query generation error:', err?.message);
    return null;
  }
}

export async function summarizeResultsWithLangChain(
  userQuery: string,
  sql: string,
  rows: any[]
): Promise<string | undefined> {
  if (rows.length === 0) return undefined;

  let model = await getLangChainChatModel();
  if (!model) return undefined;

  try {
    const summaryPrompt = `You are a certified Healthcare Revenue Cycle Management (RCM) AI assistant.
The user asked: "${userQuery}"
SQL executed: "${sql}"
Actual database result from PostgreSQL:
${JSON.stringify(rows.slice(0, 10), null, 2)}

Provide a concise, direct, helpful 1-2 sentence response summarizing these actual findings for the user.
CRITICAL: Do NOT invent numbers, names, or values. Base your answer strictly on the provided database result.`;

    let res;
    try {
      res = await model.invoke(summaryPrompt, {
        signal: AbortSignal.timeout(15000)
      });
    } catch (invErr: any) {
      const msg = String(invErr?.message || '');
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('TPM')) {
        await new Promise(r => setTimeout(r, 1000));
        const fallback = await getLangChainChatModel('openai/gpt-oss-20b');
        if (fallback) {
          res = await fallback.invoke(summaryPrompt, { signal: AbortSignal.timeout(15000) });
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }
    return typeof res.content === 'string' ? res.content.trim() : undefined;
  } catch {
    return undefined;
  }
}
