import type { UserRecord } from '../../shared/types.js';
import { loadConfig } from '../config/loadConfig.js';
import type { BrowserSessionManager } from '../browser/types.js';
import { createId } from '../util/ids.js';
import type { AutomationRuntime, ManagedSession } from './types.js';
import { toSummary } from './types.js';

export class SessionService {
  private sessions = new Map<number, ManagedSession>();

  constructor(
    private readonly browserManager: BrowserSessionManager,
    private readonly runtime: AutomationRuntime,
  ) {}

  async startSession(user: UserRecord) {
    const existing = this.sessions.get(user.id);
    if (existing && existing.status !== 'stopped') {
      existing.browserUrl = await this.browserManager.currentUrl(user.id);
      existing.updatedAt = new Date().toISOString();
      return toSummary(existing);
    }

    const browser = await this.browserManager.start(user.id, user.username);
    const browserUrl = await this.browserManager.currentUrl(user.id);
    const now = new Date().toISOString();
    const session: ManagedSession = {
      id: browser.id,
      user,
      status: 'idle',
      sandboxDir: browser.sandboxDir,
      remoteDebuggingPort: browser.remoteDebuggingPort,
      cdpWsEndpoint: browser.cdpWsEndpoint,
      browserUrl,
      liveViewUrl: browser.liveViewUrl,
      liveMode: loadConfig().live_view.mode,
      codexThreadId: null,
      createdAt: now,
      updatedAt: now,
      lastError: null,
      lastAssistantResponse: null,
      messages: [{ id: createId('msg'), role: 'system', content: `Sandbox ready. Live view mode: ${loadConfig().live_view.mode}.`, createdAt: now }],
    };
    this.sessions.set(user.id, session);
    return toSummary(session);
  }

  async stopSession(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return null;
    await this.browserManager.stop(userId);
    session.status = 'stopped';
    session.updatedAt = new Date().toISOString();
    return toSummary(session);
  }

  async preview(userId: number) {
    return this.browserManager.capturePreview(userId);
  }

  async getSessionForUser(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return null;
    session.browserUrl = await this.browserManager.currentUrl(userId);
    session.updatedAt = new Date().toISOString();
    return toSummary(session);
  }

  async sendMessage(user: UserRecord, instruction: string) {
    let session = this.sessions.get(user.id);
    if (!session || session.status === 'stopped') {
      await this.startSession(user);
      session = this.sessions.get(user.id)!;
    }

    if (session.status === 'running') {
      throw new Error('This sandbox is already executing a command');
    }

    const now = new Date().toISOString();
    session.messages.push({ id: createId('msg'), role: 'user', content: instruction, createdAt: now });
    session.status = 'running';
    session.lastError = null;
    session.updatedAt = now;
    session.browserUrl = await this.browserManager.currentUrl(user.id);

    try {
      const result = await this.runtime.runInstruction(session, instruction);
      const completedAt = new Date().toISOString();
      session.status = 'idle';
      session.codexThreadId = result.threadId;
      session.lastAssistantResponse = result.assistantMessage;
      session.updatedAt = completedAt;
      session.browserUrl = await this.browserManager.currentUrl(user.id);
      session.messages.push({ id: createId('msg'), role: 'assistant', content: result.assistantMessage, createdAt: completedAt });
      return toSummary(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown runtime failure';
      const failedAt = new Date().toISOString();
      session.status = 'error';
      session.lastError = message;
      session.updatedAt = failedAt;
      session.messages.push({ id: createId('msg'), role: 'system', content: `Runtime error: ${message}`, createdAt: failedAt });
      return toSummary(session);
    }
  }
}
