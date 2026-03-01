import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'leads.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    name TEXT,
    job_title TEXT,
    company TEXT,
    location TEXT,
    emails TEXT,
    bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cost_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cost_usd REAL,
    model TEXT DEFAULT 'gpt-4o-mini',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: drop UNIQUE index on queries.query_text if it exists (from legacy schema)
try {
  db.exec(`DROP INDEX IF EXISTS idx_queries_query_text_unique;`);
} catch (_) { }

// Also try removing unique constraint by recreating table if needed
try {
  const tableInfo = db.prepare("PRAGMA table_info(queries)").all() as any[];
  // Check the index list
  const indexes = db.prepare("PRAGMA index_list(queries)").all() as any[];
  const hasUniqueIndex = indexes.some((idx: any) => idx.unique === 1);
  if (hasUniqueIndex) {
    // Recreate queries table without unique constraint
    db.exec(`
      CREATE TABLE IF NOT EXISTS queries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO queries_new (id, query_text, created_at) SELECT id, query_text, created_at FROM queries;
      DROP TABLE queries;
      ALTER TABLE queries_new RENAME TO queries;
    `);
  }
} catch (_) { }

export default db;
