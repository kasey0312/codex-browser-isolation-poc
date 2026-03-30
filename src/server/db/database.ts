import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const runtimeDir = path.resolve(process.cwd(), '.runtime');
fs.mkdirSync(runtimeDir, { recursive: true });

const dbPath = path.join(runtimeDir, 'app.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export { db, dbPath };
