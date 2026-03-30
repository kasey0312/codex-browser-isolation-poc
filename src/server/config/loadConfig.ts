import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'toml';
import { z } from 'zod';

const configSchema = z.object({
  title: z.string().default('LangGraph Gemini Browser Isolation POC'),
  max_users: z.number().int().min(1).max(4).default(4),
  auth: z.object({
    jwt_issuer: z.string(),
    jwt_audience: z.string(),
    access_token_ttl_seconds: z.number().int().positive().default(28_800),
  }),
  agent: z.object({
    model: z.string().default('gemini-2.5-flash'),
    instruction_prefix: z.string(),
  }),
  browser: z.object({
    default_url: z.string().url(),
    headless: z.boolean().default(true),
    viewport_width: z.number().int().positive().default(1440),
    viewport_height: z.number().int().positive().default(900),
    preview_poll_ms: z.number().int().positive().default(1500),
    remote_debugging_port_base: z.number().int().positive().default(9333),
  }),
  live_view: z.object({
    mode: z.string().default('screenshot'),
    notes: z.string().default(''),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(process.cwd(), 'agents.toml');
  const raw = fs.readFileSync(configPath, 'utf8');
  cachedConfig = configSchema.parse(parse(raw));
  return cachedConfig;
}
