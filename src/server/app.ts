import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { BrowserManager } from './browser/browserManager.js';
import { DockerBrowserManager } from './browser/dockerBrowserManager.js';
import { MockBrowserManager } from './browser/mockBrowserManager.js';
import { loadConfig } from './config/loadConfig.js';
import { getEnv } from './config/env.js';
import { createUser, verifyUser } from './auth/userStore.js';
import { requireAuth, signAccessToken, type AuthedRequest } from './auth/jwt.js';
import { SessionService } from './runtime/sessionService.js';
import { createAutomationRuntime } from './runtime/createRuntime.js';
import type { AuthRequest, ChatRequest, HealthResponse } from '../shared/types.js';

const authSchema = z.object({ username: z.string().min(1), password: z.string().min(8) });
const chatSchema = z.object({ message: z.string().min(1) });

export function createApp() {
  const app = express();
  const browserManager = process.env.MOCK_BROWSER === '1' ? new MockBrowserManager() : process.env.DOCKER_BROWSER === '1' ? new DockerBrowserManager() : new BrowserManager();
  const runtime = createAutomationRuntime(browserManager as never);
  const sessionService = new SessionService(browserManager, runtime);
  const config = loadConfig();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (getEnv().trustProxy) app.set('trust proxy', true);

  app.get('/api/health', (_req, res) => {
    const payload: HealthResponse = {
      ok: true,
      mode: getEnv().mockRuntime ? 'mock' : 'real',
      liveMode: config.live_view.mode,
      chromeAvailable: browserManager.chromeAvailable(),
      browserMode: process.env.MOCK_BROWSER === '1' ? 'mock' : process.env.DOCKER_BROWSER === '1' ? 'docker' : 'host',
    };
    res.json(payload);
  });

  app.get('/api/ready', (_req, res) => {
    const checks: string[] = [];
    if (!browserManager.chromeAvailable()) checks.push('Browser runtime is not available');
    if (!getEnv().mockRuntime && !getEnv().geminiApiKey) checks.push('Set GEMINI_API_KEY or GOOGLE_API_KEY');
    const ready = checks.length === 0;
    res.status(ready ? 200 : 503).json({ ready, checks });
  });

  app.post('/api/auth/signup', async (req, res) => {
    try {
      const body = authSchema.parse(req.body as AuthRequest);
      const user = await createUser(body.username, body.password);
      const token = await signAccessToken(user);
      res.json({ token, user, maxUsers: config.max_users });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const body = authSchema.parse(req.body as AuthRequest);
      const user = await verifyUser(body.username, body.password);
      if (!user) return void res.status(401).json({ error: 'Invalid username or password' });
      const token = await signAccessToken(user);
      res.json({ token, user, maxUsers: config.max_users });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    res.json({ user: (req as AuthedRequest).user, maxUsers: config.max_users });
  });

  app.get('/api/sessions', requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user;
    const session = await sessionService.getSessionForUser(user.id);
    res.json({ sessions: session ? [session] : [], maxUsers: config.max_users });
  });

  app.post('/api/sessions/start', requireAuth, async (req, res) => {
    try {
      const user = (req as AuthedRequest).user;
      const session = await sessionService.startSession(user);
      res.json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start sandbox';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/sessions/stop', requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user;
    const session = await sessionService.stopSession(user.id);
    if (!session) return void res.status(404).json({ error: 'No active session' });
    res.json({ session });
  });

  app.get('/api/sessions/:id', requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (req.params.id !== `session-${user.id}`) return void res.status(404).json({ error: 'Session not found' });
    const session = await sessionService.getSessionForUser(user.id);
    if (!session) return void res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  });

  app.post('/api/sessions/:id/chat', requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (req.params.id !== `session-${user.id}`) return void res.status(404).json({ error: 'Session not found' });
    try {
      const body = chatSchema.parse(req.body as ChatRequest);
      const session = await sessionService.sendMessage(user, body.message);
      res.json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat execution failed';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/sessions/:id/preview', requireAuth, async (req, res) => {
    const user = (req as AuthedRequest).user;
    if (req.params.id !== `session-${user.id}`) return void res.status(404).end();
    const frame = await sessionService.preview(user.id);
    if (!frame) return void res.status(404).end();
    res.setHeader('Content-Type', browserManager.previewContentType());
    res.setHeader('Cache-Control', 'no-store');
    res.end(frame);
  });

  app.get('/automation-playground', (_req, res) => {
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8" /><title>Automation Playground</title><style>body { font-family: Inter, Arial, sans-serif; padding: 32px; background: #0f172a; color: #e2e8f0; } input, button { font-size: 16px; padding: 12px 14px; border-radius: 10px; border: 1px solid #334155; } input { width: 100%; max-width: 420px; background: #111827; color: white; } button { background: #22c55e; color: #052e16; font-weight: 700; cursor: pointer; } .card { background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 24px; max-width: 720px; } .result { margin-top: 20px; min-height: 24px; color: #86efac; font-weight: 600; }</style></head><body><div class="card"><h1>Automation Playground</h1><p>This deterministic page exists so the runtime can prove isolation and control.</p><input data-testid="playground-note" id="note" placeholder="Type a message" /><button data-testid="playground-submit" id="submit">Save note</button><div data-testid="playground-result" id="result" class="result"></div></div><script>const note = document.getElementById('note'); const result = document.getElementById('result'); document.getElementById('submit').addEventListener('click', () => { result.textContent = 'Saved note: ' + note.value; });</script></body></html>`);
  });

  const clientDist = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => { res.sendFile(path.join(clientDist, 'index.html')); });
  }

  return { app, sessionService, browserManager };
}
