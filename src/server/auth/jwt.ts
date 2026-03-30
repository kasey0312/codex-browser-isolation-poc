import { SignJWT, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env.js';
import { loadConfig } from '../config/loadConfig.js';
import { getUserById } from './userStore.js';
import type { UserRecord } from '../../shared/types.js';

const encoder = new TextEncoder();

export type AuthedRequest = Request & { user: UserRecord };

function getSecret() {
  return encoder.encode(getEnv().jwtSecret);
}

export async function signAccessToken(user: UserRecord): Promise<string> {
  const config = loadConfig();
  return new SignJWT({ sub: String(user.id), username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.auth.jwt_issuer)
    .setAudience(config.auth.jwt_audience)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.access_token_ttl_seconds}s`)
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<UserRecord | null> {
  try {
    const config = loadConfig();
    const verified = await jwtVerify(token, getSecret(), {
      issuer: config.auth.jwt_issuer,
      audience: config.auth.jwt_audience,
    });
    const userId = Number(verified.payload.sub);
    if (!Number.isFinite(userId)) {
      return null;
    }
    return getUserById(userId);
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = header.slice('Bearer '.length);
  const user = await verifyAccessToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  (req as AuthedRequest).user = user;
  next();
}
