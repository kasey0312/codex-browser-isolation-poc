import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { loadConfig } from '../config/loadConfig.js';
import { isPortAvailable } from '../util/ports.js';
import type { BrowserAutomationCapable, BrowserPageState, BrowserSessionManager, ManagedBrowserSession } from './types.js';

type BrowserSession = ManagedBrowserSession & {
  remoteDebuggingPort: number;
  context: BrowserContext;
};

export class BrowserManager implements BrowserSessionManager, BrowserAutomationCapable {
  private sessions = new Map<number, BrowserSession>();

  async start(userId: number, username: string) {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const config = loadConfig();
    const remoteDebuggingPort = await this.allocatePort(userId);
    const slug = username.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const sandboxDir = path.resolve(process.cwd(), '.runtime', 'sandboxes', `${userId}-${slug}`);
    const userDataDir = path.join(sandboxDir, 'chrome-profile');
    fs.mkdirSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: config.browser.headless,
      viewport: {
        width: config.browser.viewport_width,
        height: config.browser.viewport_height,
      },
      args: [
        `--remote-debugging-port=${remoteDebuggingPort}`,
        `--window-size=${config.browser.viewport_width},${config.browser.viewport_height}`,
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const page = await this.ensurePage(context);
    await page.goto(config.browser.default_url, { waitUntil: 'domcontentloaded' });

    const now = new Date().toISOString();
    const session: BrowserSession = {
      id: `session-${userId}`,
      userId,
      username,
      sandboxDir,
      userDataDir,
      remoteDebuggingPort,
      cdpWsEndpoint: null,
      liveViewUrl: null,
      context,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(userId, session);
    return session;
  }

  async stop(userId: number) {
    const session = this.sessions.get(userId);
    if (!session) return;
    await session.context.close();
    this.sessions.delete(userId);
  }

  async getActivePage(userId: number): Promise<Page | null> {
    const session = this.sessions.get(userId);
    if (!session) return null;
    session.updatedAt = new Date().toISOString();
    return this.ensurePage(session.context);
  }

  async capturePreview(userId: number): Promise<Buffer | null> {
    const page = await this.getActivePage(userId);
    if (!page) return null;
    return page.screenshot({ type: 'png' });
  }

  async currentUrl(userId: number): Promise<string | null> {
    const page = await this.getActivePage(userId);
    return page?.url() ?? null;
  }

  async navigate(userId: number, url: string): Promise<string | null> {
    const page = await this.getActivePage(userId);
    if (!page) throw new Error('No active browser page');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page.url();
  }

  async getPageState(userId: number): Promise<BrowserPageState> {
    const page = await this.getActivePage(userId);
    if (!page) throw new Error('No active browser page');
    return {
      url: page.url(),
      title: await page.title().catch(() => null),
      textSnippet: await page.locator('body').innerText().then((text) => text.slice(0, 4000)).catch(() => ''),
    };
  }

  async typeInto(userId: number, selector: string, text: string): Promise<string> {
    const page = await this.getActivePage(userId);
    if (!page) throw new Error('No active browser page');
    await page.locator(selector).first().fill(text);
    return `Filled ${selector} with ${JSON.stringify(text)}`;
  }

  async click(userId: number, selector: string): Promise<string> {
    const page = await this.getActivePage(userId);
    if (!page) throw new Error('No active browser page');
    await page.locator(selector).first().click();
    return `Clicked ${selector}`;
  }

  async waitForText(userId: number, text: string, timeoutMs = 10_000): Promise<boolean> {
    const page = await this.getActivePage(userId);
    if (!page) throw new Error('No active browser page');
    await page.getByText(text, { exact: false }).first().waitFor({ timeout: timeoutMs });
    return true;
  }

  previewContentType() {
    return 'image/png';
  }

  chromeAvailable(): boolean {
    try {
      const executable = chromium.executablePath();
      return Boolean(executable && fs.existsSync(executable));
    } catch {
      return false;
    }
  }

  private async allocatePort(userId: number) {
    const base = loadConfig().browser.remote_debugging_port_base;
    const preferred = base + userId - 1;
    if (await isPortAvailable(preferred)) return preferred;
    for (let offset = 0; offset < 20; offset += 1) {
      const candidate = preferred + offset + 1;
      if (await isPortAvailable(candidate)) return candidate;
    }
    throw new Error('Unable to allocate a remote debugging port');
  }

  private async ensurePage(context: BrowserContext): Promise<Page> {
    const [firstPage] = context.pages();
    if (firstPage) return firstPage;
    return context.newPage();
  }
}
