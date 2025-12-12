import Database from 'better-sqlite3';

let db: Database.Database | null = null;

const getDb = (): Database.Database => {
  if (!db) {
    db = new Database(':memory:');
    initializeTables(db);
  }
  return db;
};

const initializeTables = (database: Database.Database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS supplements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      default_dosage REAL NOT NULL,
      dosage_unit TEXT NOT NULL,
      icon_id TEXT,
      color TEXT DEFAULT '#007AFF',
      schedule_enabled INTEGER DEFAULT 0,
      study_enabled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS supplement_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      dosage REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (supplement_id) REFERENCES supplements (id)
    );

    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body_region TEXT NOT NULL,
      description TEXT NOT NULL,
      last_used INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS symptom_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symptom_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      severity INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (symptom_id) REFERENCES symptoms (id)
    );

    CREATE TABLE IF NOT EXISTS cognitive_test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      score REAL NOT NULL,
      accuracy REAL DEFAULT 0,
      speed REAL DEFAULT 0,
      raw_data TEXT,
      completion_time REAL,
      study_id INTEGER,
      supplement_log_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS sleep_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sleep_start INTEGER NOT NULL,
      sleep_end INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      manually_edited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER NOT NULL,
      exclusion_type TEXT NOT NULL,
      parameters TEXT NOT NULL,
      FOREIGN KEY (supplement_id) REFERENCES supplements (id)
    );

    CREATE TABLE IF NOT EXISTS study_protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER,
      test_type TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      schedule_type TEXT NOT NULL,
      parameters TEXT
    );

    CREATE TABLE IF NOT EXISTS scheduled_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_protocol_id INTEGER NOT NULL,
      supplement_log_id INTEGER,
      test_type TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_id TEXT NOT NULL,
      type TEXT NOT NULL,
      related_id INTEGER NOT NULL,
      scheduled_time INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      created_at INTEGER NOT NULL,
      cancelled INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      notifications_enabled INTEGER DEFAULT 1,
      supplement_reminders_enabled INTEGER DEFAULT 1,
      study_notifications_enabled INTEGER DEFAULT 1,
      sleep_reminders_enabled INTEGER DEFAULT 1,
      sleep_reminder_type TEXT DEFAULT 'duration_based',
      sleep_reminder_time TEXT,
      sleep_reminder_hours INTEGER DEFAULT 16
    );
  `);
};

class MockSQLiteDatabase {
  private database: Database.Database;

  constructor() {
    this.database = getDb();
  }

  async getAllAsync(query: string, params: any[] = []): Promise<any[]> {
    const stmt = this.database.prepare(query);
    return stmt.all(...params);
  }

  async getFirstAsync(query: string, params: any[] = []): Promise<any | null> {
    const stmt = this.database.prepare(query);
    return stmt.get(...params) ?? null;
  }

  async runAsync(query: string, params: any[] = []): Promise<{ lastInsertRowId: number; changes: number }> {
    const stmt = this.database.prepare(query);
    const result = stmt.run(...params);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }

  async execAsync(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  execSync(sql: string): void {
    this.database.exec(sql);
  }

  runSync(query: string, params: any[] = []): { lastInsertRowId: number; changes: number } {
    const stmt = this.database.prepare(query);
    const result = stmt.run(...params);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }
}

let mockDbInstance: MockSQLiteDatabase | null = null;

export const openDatabaseAsync = jest.fn(async (_name: string): Promise<MockSQLiteDatabase> => {
  if (!mockDbInstance) {
    mockDbInstance = new MockSQLiteDatabase();
  }
  return mockDbInstance;
});

export const openDatabaseSync = jest.fn((_name: string): MockSQLiteDatabase => {
  if (!mockDbInstance) {
    mockDbInstance = new MockSQLiteDatabase();
  }
  return mockDbInstance;
});

export const resetMockDatabase = () => {
  if (db) {
    db.close();
    db = null;
  }
  mockDbInstance = null;
};

export const getMockDatabase = (): MockSQLiteDatabase => {
  if (!mockDbInstance) {
    mockDbInstance = new MockSQLiteDatabase();
  }
  return mockDbInstance;
};

export type SQLiteDatabase = MockSQLiteDatabase;
