import { Buffer } from 'node:buffer';
import path from 'node:path';
import { loadConfig } from '../config/loadConfig.js';
import type { BrowserAutomationCapable, BrowserPageState, BrowserSessionManager, ManagedBrowserSession } from './types.js';

type MockSession = ManagedBrowserSession & {
  remoteDebuggingPort: number;
  currentUrl: string;
  note: string;
  result: string;
};

export class MockBrowserManager implements BrowserSessionManager, BrowserAutomationCapable {
  private sessions = new Map<number, MockSession>();

  async start(userId: number, username: string) {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const config = loadConfig();
    const slug = username.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const sandboxDir = path.resolve(process.cwd(), '.runtime', 'sandboxes', `${userId}-${slug}`);
    const now = new Date().toISOString();
    const session: MockSession = {
      id: `session-${userId}`,
      userId,
      username,
      sandboxDir,
      userDataDir: path.join(sandboxDir, 'mock-profile'),
      remoteDebuggingPort: config.browser.remote_debugging_port_base + userId - 1,
      cdpWsEndpoint: null,
      liveViewUrl: null,
      createdAt: now,
      updatedAt: now,
      currentUrl: config.browser.default_url,
      note: '',
      result: '',
    };

    this.sessions.set(userId, session);
    return session;
  }

  async stop(userId: number) {
    this.sessions.delete(userId);
  }

  async currentUrl(userId: number) {
    return this.sessions.get(userId)?.currentUrl ?? null;
  }

  async navigate(userId: number, url: string) {
    const session = this.getSession(userId);
    session.currentUrl = url;
    session.updatedAt = new Date().toISOString();
    return session.currentUrl;
  }

  async getPageState(userId: number): Promise<BrowserPageState> {
    const session = this.getSession(userId);
    return {
      url: session.currentUrl,
      title: session.currentUrl.includes('automation-playground') ? 'Automation Playground' : 'Example Domain',
      textSnippet: [session.result, session.note, session.currentUrl].filter(Boolean).join('\n'),
    };
  }

  async typeInto(userId: number, selector: string, text: string) {
    const session = this.getSession(userId);
    session.note = text;
    session.updatedAt = new Date().toISOString();
    return `Filled ${selector} with ${JSON.stringify(text)}`;
  }

  async click(userId: number, selector: string) {
    const session = this.getSession(userId);
    session.result = `Saved note: ${session.note || 'Hello from mock Gemini'}`;
    session.updatedAt = new Date().toISOString();
    return `Clicked ${selector}`;
  }

  async waitForText(userId: number, text: string) {
    const session = this.getSession(userId);
    return session.result.includes(text) || session.note.includes(text) || session.currentUrl.includes(text);
  }

  async capturePreview(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) {
      return null;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
        <rect width="100%" height="100%" fill="#020617" />
        <rect x="40" y="40" width="1200" height="720" rx="24" fill="#0f172a" stroke="#1e293b" />
        <rect x="80" y="90" width="1120" height="48" rx="14" fill="#111827" stroke="#334155" />
        <text x="110" y="122" fill="#e2e8f0" font-size="24" font-family="Arial">${escapeXml(session.currentUrl)}</text>
        <text x="100" y="210" fill="#22c55e" font-size="40" font-family="Arial">Mock isolated browser sandbox</text>
        <text x="100" y="270" fill="#cbd5e1" font-size="28" font-family="Arial">User: ${escapeXml(session.username)}</text>
        <text x="100" y="320" fill="#cbd5e1" font-size="28" font-family="Arial">Remote debug port: ${session.remoteDebuggingPort}</text>
        <text x="100" y="410" fill="#e2e8f0" font-size="30" font-family="Arial">Last note:</text>
        <text x="100" y="460" fill="#93c5fd" font-size="34" font-family="Arial">${escapeXml(session.note || '—')}</text>
        <text x="100" y="560" fill="#e2e8f0" font-size="30" font-family="Arial">Page result:</text>
        <text x="100" y="610" fill="#86efac" font-size="34" font-family="Arial">${escapeXml(session.result || 'Waiting for automation...')}</text>
      </svg>`;

    return Buffer.from(svg);
  }

  previewContentType() {
    return 'image/svg+xml';
  }

  chromeAvailable() {
    return true;
  }

  async applyMockInstruction(userId: number, instruction: string) {
    const session = this.getSession(userId);

    const lower = instruction.toLowerCase();
    if (lower.includes('automation playground') || lower.includes('playground')) {
      session.currentUrl = 'http://127.0.0.1:3000/automation-playground';
    }

    const urlMatch = instruction.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      session.currentUrl = urlMatch[0];
    }

    const quotedText = instruction.match(/"([^"]+)"/);
    const text = quotedText?.[1] ?? 'Hello from mock Gemini';
    if (lower.includes('type') || lower.includes('fill')) {
      session.note = text;
    }

    if (lower.includes('submit') || lower.includes('save') || lower.includes('click')) {
      session.result = `Saved note: ${session.note || text}`;
    }

    session.updatedAt = new Date().toISOString();
  }

  private getSession(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) {
      throw new Error('No active mock browser session');
    }
    return session;
  }
}

function escapeXml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
