import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from '../config/config.js';

// Ensure database directory exists
const dbDir = config.paths.database;
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, config.database.filename);
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  // Packages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      version TEXT,
      scorm_version TEXT NOT NULL,
      identifier TEXT,
      launch_path TEXT NOT NULL,
      metadata TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // SCORM sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS scorm_sessions (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      user_id TEXT,
      started_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_accessed INTEGER DEFAULT (strftime('%s', 'now')),
      completed INTEGER DEFAULT 0,
      success_status TEXT,
      score_raw REAL,
      score_min REAL,
      score_max REAL,
      session_time TEXT,
      total_time TEXT,
      suspend_data TEXT,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    )
  `);

  // CMI data table (for storing all SCORM data model elements)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cmi_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      element TEXT NOT NULL,
      value TEXT,
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (session_id) REFERENCES scorm_sessions(id) ON DELETE CASCADE
    )
  `);

  // Sync queue table (for offline data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      synced INTEGER DEFAULT 0,
      synced_at INTEGER,
      retry_count INTEGER DEFAULT 0
    )
  `);

  // Interactions table (for detailed tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      interaction_id TEXT NOT NULL,
      type TEXT,
      timestamp INTEGER,
      correct_responses TEXT,
      learner_response TEXT,
      result TEXT,
      latency TEXT,
      description TEXT,
      FOREIGN KEY (session_id) REFERENCES scorm_sessions(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_package ON scorm_sessions(package_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON scorm_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_cmi_session ON cmi_data(session_id);
    CREATE INDEX IF NOT EXISTS idx_cmi_element ON cmi_data(element);
    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(synced);
    CREATE INDEX IF NOT EXISTS idx_interactions_session ON interactions(session_id);
  `);

  console.log('Database initialized successfully');
}

// Initialize on startup
initializeDatabase();

// Prepared statements for common operations
const statements = {
  // Packages
  insertPackage: db.prepare(`
    INSERT INTO packages (id, title, version, scorm_version, identifier, launch_path, metadata, file_path, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getPackage: db.prepare('SELECT * FROM packages WHERE id = ?'),
  
  getAllPackages: db.prepare('SELECT * FROM packages ORDER BY uploaded_at DESC'),
  
  deletePackage: db.prepare('DELETE FROM packages WHERE id = ?'),
  
  updatePackage: db.prepare(`
    UPDATE packages 
    SET title = ?, version = ?, metadata = ?, updated_at = strftime('%s', 'now')
    WHERE id = ?
  `),

  // Sessions
  insertSession: db.prepare(`
    INSERT INTO scorm_sessions (id, package_id, user_id)
    VALUES (?, ?, ?)
  `),
  
  getSession: db.prepare('SELECT * FROM scorm_sessions WHERE id = ?'),
  
  updateSession: db.prepare(`
    UPDATE scorm_sessions 
    SET last_accessed = strftime('%s', 'now'),
        completed = ?,
        success_status = ?,
        score_raw = ?,
        session_time = ?,
        total_time = ?,
        suspend_data = ?
    WHERE id = ?
  `),
  
  getSessionsByPackage: db.prepare('SELECT * FROM scorm_sessions WHERE package_id = ?'),
  
  getSessionsByUser: db.prepare('SELECT * FROM scorm_sessions WHERE user_id = ?'),

  // CMI Data
  insertCmiData: db.prepare(`
    INSERT INTO cmi_data (session_id, element, value)
    VALUES (?, ?, ?)
  `),
  
  getCmiData: db.prepare(`
    SELECT * FROM cmi_data 
    WHERE session_id = ? AND element = ?
    ORDER BY timestamp DESC LIMIT 1
  `),
  
  getAllCmiData: db.prepare(`
    SELECT * FROM cmi_data 
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `),

  // Sync Queue
  insertSyncItem: db.prepare(`
    INSERT INTO sync_queue (session_id, package_id, action, data)
    VALUES (?, ?, ?, ?)
  `),
  
  getPendingSync: db.prepare(`
    SELECT * FROM sync_queue 
    WHERE synced = 0 
    ORDER BY created_at ASC 
    LIMIT ?
  `),
  
  markSynced: db.prepare(`
    UPDATE sync_queue 
    SET synced = 1, synced_at = strftime('%s', 'now')
    WHERE id = ?
  `),
  
  incrementRetry: db.prepare(`
    UPDATE sync_queue 
    SET retry_count = retry_count + 1
    WHERE id = ?
  `),

  // Interactions
  insertInteraction: db.prepare(`
    INSERT INTO interactions (session_id, interaction_id, type, timestamp, correct_responses, learner_response, result, latency, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getInteractions: db.prepare('SELECT * FROM interactions WHERE session_id = ? ORDER BY timestamp ASC'),
};

export { db, statements };
export default db;
