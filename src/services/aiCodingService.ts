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

export const aiCodingService = {
  /**
   * Calls the secure backend endpoint POST /api/medical-coding.
   * No API key is passed from the client.
   */
  async generateAiCodingSuggestions(clinicalDescription: string): Promise<AiCodingResponse> {
    const trimmed = (clinicalDescription || '').trim();
    if (!trimmed) {
      throw new Error("Please enter the doctor's clinical description before generating AI coding suggestions.");
    }

    let response: Response;
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      response = await fetch('/api/medical-coding', {
        method: 'POST',
        headers,
        body: JSON.stringify({ clinicalDescription: trimmed })
      });
    } catch (networkErr: any) {
      throw new Error(
        `Network error: Failed to connect to the medical coding server (${networkErr?.message || 'Check network connection'}).`
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error('Received an invalid response format from the server. Please try again.');
    }

    if (!response.ok || !data.success) {
      const errorMsg = data?.error || `Server returned error status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data.data as AiCodingResponse;
  }
};
