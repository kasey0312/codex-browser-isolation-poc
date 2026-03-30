import type { BrowserSessionSummary, SessionMessage, SessionStatus, UserRecord } from '../../shared/types.js';

export type ManagedSession = {
  id: string;
  user: UserRecord;
  status: SessionStatus;
  sandboxDir: string;
  remoteDebuggingPort: number | null;
  cdpWsEndpoint: string | null;
  browserUrl: string | null;
  liveViewUrl: string | null;
  liveMode: string;
  codexThreadId: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  lastAssistantResponse: string | null;
  messages: SessionMessage[];
};

export type RuntimeResult = {
  assistantMessage: string;
  threadId: string | null;
};

export interface AutomationRuntime {
  runInstruction(session: ManagedSession, instruction: string): Promise<RuntimeResult>;
}

export function toSummary(session: ManagedSession): BrowserSessionSummary {
  return {
    id: session.id,
    userId: session.user.id,
    username: session.user.username,
    status: session.status,
    browserUrl: session.browserUrl,
    previewUrl: `/api/sessions/${session.id}/preview`,
    liveViewUrl: session.liveViewUrl,
    remoteDebuggingPort: session.remoteDebuggingPort,
    cdpWsEndpoint: session.cdpWsEndpoint,
    liveMode: session.liveMode,
    codexThreadId: session.codexThreadId,
    sandboxDir: session.sandboxDir,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastError: session.lastError,
    lastAssistantResponse: session.lastAssistantResponse,
    messages: session.messages,
  };
}
