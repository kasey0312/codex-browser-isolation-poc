export type AuthMode = 'signup' | 'login';

export type UserRecord = {
  id: number;
  username: string;
  createdAt: string;
};

export type SessionMessageRole = 'user' | 'assistant' | 'system';

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  content: string;
  createdAt: string;
};

export type SessionStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped';

export type BrowserSessionSummary = {
  id: string;
  userId: number;
  username: string;
  status: SessionStatus;
  browserUrl: string | null;
  previewUrl: string | null;
  liveViewUrl: string | null;
  remoteDebuggingPort: number | null;
  cdpWsEndpoint: string | null;
  liveMode: string;
  codexThreadId: string | null;
  sandboxDir: string;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  lastAssistantResponse: string | null;
  messages: SessionMessage[];
};

export type AuthResponse = {
  token: string;
  user: UserRecord;
  maxUsers: number;
};

export type SessionListResponse = {
  sessions: BrowserSessionSummary[];
  maxUsers: number;
};

export type SessionOperationResponse = {
  session: BrowserSessionSummary;
};

export type ChatRequest = {
  message: string;
};

export type AuthRequest = {
  username: string;
  password: string;
};

export type HealthResponse = {
  ok: true;
  mode: 'mock' | 'real';
  liveMode: string;
  chromeAvailable: boolean;
  ready?: boolean;
  browserMode?: 'mock' | 'docker' | 'host';
  checks?: string[];
};
