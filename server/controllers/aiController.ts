import type { Request, Response } from 'express';
import { processAssistantMessage } from '../ai/rcmAssistant.ts';

export async function handleAiChat(req: Request, res: Response): Promise<void> {
  try {
    const { message, conversationId, threadId, thread_id, confirmedAction } = req.body;
    const activeThreadId = thread_id || threadId || conversationId || `thread-${Date.now()}`;

    if (!message && !confirmedAction) {
      res.status(400).json({
        success: false,
        message: 'A message or confirmedAction payload is required.'
      });
      return;
    }

    const response = await processAssistantMessage({
      message: message || '',
      conversationId: activeThreadId,
      threadId: activeThreadId,
      thread_id: activeThreadId,
      confirmedAction
    });

    res.status(200).json({
      ...response,
      thread_id: activeThreadId
    });
  } catch (err: any) {
    console.error('[AiController] Error handling chat message:', err);
    res.status(500).json({
      success: false,
      message: 'Sorry, I couldn\'t retrieve that information from the RCM database.'
    });
  }
}

export async function handleExecuteAction(req: Request, res: Response): Promise<void> {
  try {
    const { action, conversationId, threadId, thread_id } = req.body;
    const activeThreadId = thread_id || threadId || conversationId || `thread-${Date.now()}`;

    if (!action || !action.type) {
      res.status(400).json({
        success: false,
        message: 'An action with a valid type and payload is required.'
      });
      return;
    }

    const response = await processAssistantMessage({
      message: `Execute action: ${action.type}`,
      conversationId: activeThreadId,
      threadId: activeThreadId,
      thread_id: activeThreadId,
      confirmedAction: action
    });

    res.status(200).json({
      ...response,
      thread_id: activeThreadId
    });
  } catch (err: any) {
    console.error('[AiController] Error executing action:', err);
    res.status(500).json({
      success: false,
      message: `Failed to execute action: ${err?.message || 'Database error occurred.'}`
    });
  }
}
