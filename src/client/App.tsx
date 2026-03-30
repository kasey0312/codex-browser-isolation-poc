import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  AuthMode,
  AuthResponse,
  BrowserSessionSummary,
  HealthResponse,
  SessionListResponse,
  SessionOperationResponse,
} from '../shared/types';

const TOKEN_KEY = 'codex-browser-isolation-token';
const USER_KEY = 'codex-browser-isolation-user';
const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(payload.error ?? 'Request failed');
  }
  return response.json() as Promise<T>;
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [storedUser, setStoredUser] = useState(() => localStorage.getItem(USER_KEY) ?? '');
  const [mode, setMode] = useState<AuthMode>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Open the automation playground, type "hello from Gemini" into the note field, and click save.');
  const [session, setSession] = useState<BrowserSessionSummary | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const user = useMemo(() => {
    try { return storedUser ? JSON.parse(storedUser) : null; } catch { return null; }
  }, [storedUser]);

  useEffect(() => {
    fetch(`${apiBase}/api/health`).then((response) => response.json()).then((payload: HealthResponse) => setHealth(payload)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!token) return;
    const sync = async () => {
      try {
        const payload = await api<SessionListResponse>('/api/sessions', {}, token);
        setSession(payload.sessions[0] ?? null);
      } catch (syncError) {
        setError(syncError instanceof Error ? syncError.message : 'Failed to load sessions');
      }
    };
    void sync();
    const interval = window.setInterval(sync, 2500);
    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token || !session || session.liveMode === 'novnc') {
      setPreviewUrl((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
        return null;
      });
      return;
    }

    let cancelled = false;
    const refreshPreview = async () => {
      try {
        const response = await fetch(`${apiBase}/api/sessions/${session.id}/preview`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (!response.ok || cancelled) return;
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl((current) => {
          if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
          return objectUrl;
        });
      } catch {}
    };
    void refreshPreview();
    const interval = window.setInterval(refreshPreview, 1500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [token, session]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = await api<AuthResponse>(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ username, password }) });
      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
      setToken(payload.token); setStoredUser(JSON.stringify(payload.user)); setUsername(''); setPassword('');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    } finally { setBusy(false); }
  };

  const withSessionMutation = async (task: () => Promise<SessionOperationResponse>) => {
    setBusy(true); setError(null);
    try {
      const payload = await task();
      setSession(payload.session);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Request failed');
    } finally { setBusy(false); }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
    setToken(''); setStoredUser(''); setSession(null); setPreviewUrl(null); setError(null);
  };

  if (!token || !user) {
    return (
      <div className="layout"><div className="panel auth-shell"><h1>LangGraph Gemini Browser Isolation POC</h1><p className="hint">TypeScript proof-of-concept for authenticated users, isolated browser sandboxes, and Gemini-driven automation.</p><form className="form" onSubmit={handleAuth}><div><label htmlFor="username">Username</label><input id="username" className="input" value={username} onChange={(event) => setUsername(event.target.value)} /></div><div><label htmlFor="password">Password</label><input id="password" className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div><button className="button" disabled={busy} type="submit">{busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}</button><button className="button secondary" type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>Switch to {mode === 'signup' ? 'login' : 'signup'}</button>{error ? <div className="error">{error}</div> : null}</form></div></div>
    );
  }

  return (
    <div className="layout"><div className="toolbar"><div><h1 style={{ margin: '0 0 8px' }}>LangGraph Gemini Browser Isolation POC</h1><div className="hint">Signed in as <strong>{user.username}</strong>. Runtime: <strong>{health?.mode ?? '...'}</strong>. Live view: <strong>{health?.liveMode ?? '...'}</strong>.</div></div><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><div className="status-pill">Status: {session?.status ?? 'no session'}</div><button className="button secondary" onClick={logout}>Log out</button></div></div><div className="grid"><div className="panel card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}><h2 style={{ margin: 0 }}>Live browser</h2><div style={{ display: 'flex', gap: 12 }}><button className="button" disabled={busy} onClick={() => withSessionMutation(() => api<SessionOperationResponse>('/api/sessions/start', { method: 'POST' }, token))}>Start sandbox</button><button className="button danger" disabled={busy || !session} onClick={() => withSessionMutation(() => api<SessionOperationResponse>('/api/sessions/stop', { method: 'POST' }, token))}>Stop sandbox</button></div></div><div className="meta" style={{ marginBottom: 16 }}><div className="meta-item"><div className="meta-label">Sandbox directory</div><div className="meta-value">{session?.sandboxDir ?? 'Not started yet'}</div></div><div className="meta-item"><div className="meta-label">Remote debug / CDP</div><div className="meta-value">{session?.remoteDebuggingPort ?? session?.cdpWsEndpoint ?? '—'}</div></div><div className="meta-item"><div className="meta-label">Current browser URL</div><div className="meta-value">{session?.browserUrl ?? '—'}</div></div><div className="meta-item"><div className="meta-label">Live view</div><div className="meta-value">{session?.liveViewUrl ?? session?.previewUrl ?? 'Available after start'}</div></div></div><div className="browser-preview">{session?.liveMode === 'novnc' && session.liveViewUrl ? <iframe title="Isolated browser live view" src={session.liveViewUrl} className="browser-frame" /> : previewUrl ? <img alt="Isolated browser preview" src={previewUrl} /> : <div className="browser-empty">Start a sandbox to get a live preview.</div>}</div></div><div className="panel card"><h2 style={{ marginTop: 0 }}>Chat → browser control</h2><div className="chat-log">{session?.messages.length ? session.messages.map((entry) => (<div key={entry.id} className={`message ${entry.role}`}><strong>{entry.role}</strong><div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{entry.content}</div><small>{new Date(entry.createdAt).toLocaleString()}</small></div>)) : <div className="hint">No messages yet. Start a sandbox, then send an instruction.</div>}</div><form className="form" onSubmit={async (event) => { event.preventDefault(); if (!session) { setError('Start a sandbox first'); return; } await withSessionMutation(() => api<SessionOperationResponse>(`/api/sessions/${session.id}/chat`, { method: 'POST', body: JSON.stringify({ message }) }, token)); }}><textarea className="textarea" rows={8} value={message} onChange={(event) => setMessage(event.target.value)} /><button className="button" disabled={busy || !session} type="submit">{busy ? 'Running…' : 'Run instruction'}</button>{session?.lastError ? <div className="error">{session.lastError}</div> : null}{error ? <div className="error">{error}</div> : null}</form></div></div></div>
  );
}
