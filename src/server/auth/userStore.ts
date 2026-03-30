import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';
import { loadConfig } from '../config/loadConfig.js';
import type { UserRecord } from '../../shared/types.js';

const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
);
const selectUserByUsername = db.prepare(
  'SELECT id, username, password_hash as passwordHash, created_at as createdAt FROM users WHERE username = ?',
);
const selectUserById = db.prepare(
  'SELECT id, username, created_at as createdAt FROM users WHERE id = ?',
);
const countUsers = db.prepare('SELECT COUNT(*) as count FROM users');

export async function createUser(username: string, password: string): Promise<UserRecord> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) {
    throw new Error('Username is required');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const maxUsers = loadConfig().max_users;
  const userCount = (countUsers.get() as { count: number }).count;
  if (userCount >= maxUsers) {
    throw new Error(`POC user limit reached (${maxUsers})`);
  }

  const existing = selectUserByUsername.get(trimmed) as { id: number } | undefined;
  if (existing) {
    throw new Error('Username already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();
  const result = insertUser.run(trimmed, passwordHash, createdAt);
  return {
    id: Number(result.lastInsertRowid),
    username: trimmed,
    createdAt,
  };
}

export async function verifyUser(username: string, password: string): Promise<UserRecord | null> {
  const trimmed = username.trim().toLowerCase();
  const row = selectUserByUsername.get(trimmed) as
    | { id: number; username: string; passwordHash: string; createdAt: string }
    | undefined;

  if (!row) {
    return null;
  }

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    createdAt: row.createdAt,
  };
}

export function getUserById(id: number): UserRecord | null {
  return (selectUserById.get(id) as UserRecord | undefined) ?? null;
}

export function getUserCount(): number {
  return (countUsers.get() as { count: number }).count;
}
