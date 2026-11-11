import fs from 'node:fs';
import path from 'node:path';

export interface AiDiagnosisSuggestion {
  code: string;
  description: string;
  confidence: number;
  reason: string;
}

export interface AiProcedureSuggestion {
  code: string;
  description: string;
  confidence: number;
  reason: string;
}

export interface AiPossibleDiagnosis {
  name: string;
  confidence: number;
}

export interface AiCodingResponse {
  keywords: string[];
  possibleDiagnoses: AiPossibleDiagnosis[];
  diagnosisCodeSuggestions: AiDiagnosisSuggestion[];
  procedureCodeSuggestions: AiProcedureSuggestion[];
  disclaimer: string;
  modelUsed?: string;
}

// Helper to read .env file manually if process.env hasn't loaded it
export function getEnvVariable(key: string): string {
  if (process.env[key] && process.env[key]?.trim()) {
    return process.env[key]!.trim();
  }

  try {
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '.env.local')
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const [varKey, ...rest] = trimmed.split('=');
          if (varKey.trim() === key) {
            let val = rest.join('=').trim();
            // remove surrounding quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            return val;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[MedicalCodingApi] Warning reading .env for ${key}:`, err);
  }

  return '';
}

export async function analyzeClinicalDescription(
  clinicalDescription: string
): Promise<{ success: boolean; data?: AiCodingResponse; error?: string }> {
  // 1. Validate empty clinical description
  const trimmedInput = (clinicalDescription || '').trim();
  if (!trimmedInput) {
    return {
      success: false,
      error: "Please enter the doctor's clinical description before generating AI coding suggestions."
    };
  }

  // 2. Validate Groq API key
  const apiKey = getEnvVariable('GROQ_API_KEY');
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return {
      success: false,
      error:
        'Groq API key not configured. Please add your GROQ_API_KEY in the .env file (get one at https://console.groq.com/keys) and try again.'
    };
  }

  const model = getEnvVariable('GROQ_MODEL') || 'openai/gpt-oss-120b';

  const systemPrompt = `You are a certified professional medical coder (AAPC CPC / AHIMA CCS) specializing in outpatient medical coding, ICD-10-CM diagnosis codes, and CPT/HCPCS procedure codes.
Analyze the provided doctor's clinical description / admission note and return structured medical coding suggestions.

CRITICAL CLINICAL RULES:
1. Extract symptoms, clinical keywords, possible diagnoses, suggested ICD-10 diagnosis codes, and suggested CPT procedure codes.
2. Procedure codes must ONLY be suggested when clearly supported by the clinical description or documented encounter services. If no specific procedures or exams are documented, return an empty array [] for procedureCodeSuggestions.
3. For each diagnosis code suggestion:
   - Provide a valid ICD-10-CM code (e.g. 'I10', 'R07.9', 'J06.9', 'R05.1', 'R51.0').
   - Provide an official clinical description.
   - Provide an integer confidence level (0 to 100).
   - Provide a concise explanation / reason linking the code directly to symptoms or diagnoses in the note.
4. For each procedure code suggestion:
   - Provide a valid CPT/HCPCS code (e.g. '99213', '80053', '71046', '93000').
   - Provide the official clinical description.
   - Provide an integer confidence level (0 to 100).
   - Provide a concise explanation / reason based on services ordered or performed.
5. Provide a "keywords" array containing 4 to 12 clinically significant terms, symptoms, or findings.
6. Provide a "possibleDiagnoses" array containing 1 to 4 primary potential diagnoses with a confidence score (0-100).
7. Include the disclaimer: "AI-generated coding suggestions require human review before final use."

STRICT OUTPUT FORMAT:
You MUST respond with valid JSON ONLY. Do not include markdown formatting or backticks outside the JSON object.
Follow this exact schema:
{
  "keywords": ["Fever", "Cough", "Sore Throat", "Headache"],
  "possibleDiagnoses": [
    {
      "name": "Upper respiratory infection",
      "confidence": 85
    }
  ],
  "diagnosisCodeSuggestions": [
    {
      "code": "J06.9",
      "description": "Acute upper respiratory infection, unspecified",
      "confidence": 88,
      "reason": "The clinical description indicates acute respiratory symptoms."
    }
  ],
  "procedureCodeSuggestions": [
    {
      "code": "99213",
      "description": "Office or other outpatient visit for established patient, low complexity",
      "confidence": 90,
      "reason": "Evaluation and management consultation documented in encounter."
    }
  ],
  "disclaimer": "AI-generated coding suggestions require human review before final use."
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedInput }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      let errorBody = '';
      try {
        const errorJson: any = await response.json();
        errorBody = errorJson?.error?.message || JSON.stringify(errorJson);
      } catch {
        errorBody = await response.text();
      }

      if (status === 401) {
        return {
          success: false,
          error: 'Invalid Groq API key (401 Unauthorized). Please check the GROQ_API_KEY in your .env file.'
        };
      }
      if (status === 429) {
        return {
          success: false,
          error: 'Groq API rate limit exceeded (429). Please wait a few moments before trying again.'
        };
      }
      if (status === 404) {
        return {
          success: false,
          error: `Groq model '${model}' was not found (404). Please verify GROQ_MODEL in your .env file.`
        };
      }

      return {
        success: false,
        error: `Groq API error (${status}): ${errorBody || response.statusText}`
      };
    }

    const payload: any = await response.json();
    const rawContent = payload.choices?.[0]?.message?.content;

    if (!rawContent) {
      return {
        success: false,
        error: 'The Groq API returned an empty response. Please try again.'
      };
    }

    // Parse JSON safely
    let parsed: any;
    try {
      // Strip any accidental markdown formatting
      const sanitized = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      parsed = JSON.parse(sanitized);
    } catch (parseErr) {
      console.error('[MedicalCodingApi] Failed to parse JSON from Groq:', rawContent, parseErr);
      return {
        success: false,
        error: 'Invalid AI JSON response format received from Groq. Please retry the analysis.'
      };
    }

    // Validate structure
    const keywords: string[] = Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : [];

    const possibleDiagnoses: AiPossibleDiagnosis[] = Array.isArray(parsed.possibleDiagnoses)
      ? parsed.possibleDiagnoses.map((d: any) => ({
          name: String(d.name || d.diagnosis || '').trim(),
          confidence: Math.min(100, Math.max(0, parseInt(d.confidence, 10) || 75))
        }))
      : [];

    const diagnosisCodeSuggestions: AiDiagnosisSuggestion[] = Array.isArray(parsed.diagnosisCodeSuggestions)
      ? parsed.diagnosisCodeSuggestions.map((dx: any) => ({
          code: String(dx.code || '').trim().toUpperCase(),
          description: String(dx.description || dx.name || 'Diagnosis Code').trim(),
          confidence: Math.min(100, Math.max(0, parseInt(dx.confidence, 10) || 80)),
          reason: String(dx.reason || dx.explanation || '').trim()
        })).filter((dx: AiDiagnosisSuggestion) => dx.code.length > 0)
      : [];

    const procedureCodeSuggestions: AiProcedureSuggestion[] = Array.isArray(parsed.procedureCodeSuggestions)
      ? parsed.procedureCodeSuggestions.map((px: any) => ({
          code: String(px.code || '').trim().toUpperCase(),
          description: String(px.description || px.name || 'Procedure Code').trim(),
          confidence: Math.min(100, Math.max(0, parseInt(px.confidence, 10) || 80)),
          reason: String(px.reason || px.explanation || '').trim()
        })).filter((px: AiProcedureSuggestion) => px.code.length > 0)
      : [];

    const disclaimer =
      typeof parsed.disclaimer === 'string' && parsed.disclaimer.trim().length > 0
        ? parsed.disclaimer.trim()
        : 'AI-generated coding suggestions require human review before final use.';

    return {
      success: true,
      data: {
        keywords,
        possibleDiagnoses,
        diagnosisCodeSuggestions,
        procedureCodeSuggestions,
        disclaimer,
        modelUsed: model
      }
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return {
        success: false,
        error: 'The request to Groq API timed out after 35 seconds. Please check your network connection and try again.'
      };
    }
    console.error('[MedicalCodingApi] Network/Unknown error:', error);
    return {
      success: false,
      error: `Network error communicating with Groq API: ${error?.message || 'Unable to connect'}`
    };
  }
}
