export interface AssistantStat {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface AssistantTableData {
  headers: string[];
  rows: Array<Record<string, any>>;
}

export interface AssistantAction {
  type: string;
  target?: string;
  payload?: any;
}

export interface AssistantResponse {
  success: boolean;
  message: string;
  thread_id?: string;
  data?: any;
  action?: AssistantAction | null;
  requiresConfirmation?: boolean;
  sqlExecuted?: string;
  steps?: string[];
  stats?: AssistantStat[];
  tableData?: AssistantTableData;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  stats?: AssistantStat[];
  tableData?: AssistantTableData;
  action?: AssistantAction | null;
  requiresConfirmation?: boolean;
  confirmed?: boolean;
  sqlExecuted?: string;
  steps?: string[];
  isError?: boolean;
}

export const aiService = {
  async sendChatMessage(
    message: string,
    threadId: string = 'rcm-chat-session',
    confirmedAction?: AssistantAction
  ): Promise<AssistantResponse> {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          thread_id: threadId,
          threadId,
          conversationId: threadId,
          confirmedAction,
        }),
      });

      if (!res.ok) {
        let errMessage = 'Unable to connect to AI Assistant';
        try {
          const errData = await res.json();
          errMessage = errData.message || errMessage;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: errMessage,
        };
      }

      const data: AssistantResponse = await res.json();
      return data;
    } catch (err: any) {
      console.error('[aiService] Request error:', err);
      return {
        success: false,
        message: 'Sorry, I couldn\'t retrieve that information from the RCM database.',
      };
    }
  },

  async executeAction(
    action: AssistantAction,
    threadId: string = 'rcm-chat-session'
  ): Promise<AssistantResponse> {
    try {
      const res = await fetch('/api/ai/execute-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          thread_id: threadId,
          threadId,
          conversationId: threadId,
        }),
      });

      if (!res.ok) {
        let errMessage = 'Failed to execute requested action';
        try {
          const errData = await res.json();
          errMessage = errData.message || errMessage;
        } catch {
          // ignore
        }
        return {
          success: false,
          message: errMessage,
        };
      }

      return await res.json();
    } catch (err: any) {
      console.error('[aiService] Execute action error:', err);
      return {
        success: false,
        message: 'Failed to execute action due to a network or server issue.',
      };
    }
  },
};
