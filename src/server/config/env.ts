import dotenv from 'dotenv';

dotenv.config();

function parseCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getEnv() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret',
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    corsAllowedOrigins: parseCsv(process.env.CORS_ALLOWED_ORIGINS),
    trustProxy: process.env.TRUST_PROXY === '1',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    mockRuntime: process.env.MOCK_RUNTIME === '1' || process.env.MOCK_GEMINI === '1' || process.env.MOCK_CODEX === '1',
    geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null,
    model: process.env.GEMINI_MODEL ?? process.env.GOOGLE_MODEL ?? null,
  };
}
