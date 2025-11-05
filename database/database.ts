import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'neurosync.db';

// Global state tracking
let databaseInstance: SQLite.SQLiteDatabase | null = null;
let isDatabaseReady = false;
let isInitializing = false;
let fallbackMode = false;
let fallbackData: { [key: string]: any[] } = {};

// Detailed error logging
const logError = (operation: string, error: any) => {
  const timestamp = new Date().toISOString();
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[${timestamp}] DATABASE ERROR in ${operation}: ${errorMessage}`);
  console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
};

const logInfo = (operation: string, message: string) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] DATABASE INFO ${operation}: ${message}`);
};

// Database ready flag for external components to check
export const isDatabaseInitialized = () => isDatabaseReady;
export const isFallbackMode = () => fallbackMode;

// Comprehensive null checks before any database operation
const validateDatabaseState = (): boolean => {
  if (!SQLite) {
    logError('validateDatabaseState', 'SQLite module not loaded');
    return false;
  }
  
  if (!databaseInstance) {
    logError('validateDatabaseState', 'Database instance is null');
    return false;
  }
  
  if (!(databaseInstance as any)._db) {
    logError('validateDatabaseState', 'Database connection is not open');
    return false;
  }
  
  return true;
};

// Get database instance with validation
export const getDatabase = (): SQLite.SQLiteDatabase | null => {
  if (fallbackMode) {
    logInfo('getDatabase', 'Running in fallback mode - returning null');
    return null;
  }
  
  if (!validateDatabaseState()) {
    return null;
  }
  
  return databaseInstance;
};

// Safe database operations wrapper with fallback support
export const withDatabase = async <T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
  operationName: string = 'database operation',
  fallbackOperation?: () => Promise<T>
): Promise<T> => {
  try {
    if (fallbackMode && fallbackOperation) {
      logInfo('withDatabase', `Using fallback for ${operationName}`);
      return await fallbackOperation();
    }
    
    const db = getDatabase();
    if (!db) {
      if (fallbackOperation) {
        logInfo('withDatabase', `Database unavailable, using fallback for ${operationName}`);
        return await fallbackOperation();
      }
      throw new Error(`Database not available and no fallback provided for ${operationName}`);
    }
    
    return await operation(db);
  } catch (error) {
    logError('withDatabase', `${operationName}: ${error}`);
    
    if (fallbackOperation) {
      logInfo('withDatabase', `Database operation failed, using fallback for ${operationName}`);
      return await fallbackOperation();
    }
    
    throw new Error(`Database operation failed: ${operationName}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Reset database by deleting the database using SQLite operations
export const resetDatabase = async (): Promise<boolean> => {
  try {
    logInfo('resetDatabase', 'Starting database reset');
    
    // Close existing connection if any
    if (databaseInstance) {
      try {
        await databaseInstance.closeAsync();
        logInfo('resetDatabase', 'Closed existing database connection');
      } catch (error) {
        logError('resetDatabase', `Failed to close database: ${error}`);
      }
    }
    
    // Reset state
    databaseInstance = null;
    isDatabaseReady = false;
    isInitializing = false;
    fallbackMode = false;
    
    // We can't easily delete the database file in modern SQLite,
    // so we'll just reset the state and let re-initialization handle it
    logInfo('resetDatabase', 'Database state reset successfully');
    
    return true;
  } catch (error) {
    logError('resetDatabase', `Failed to reset database: ${error}`);
    return false;
  }
};

export const openDatabase = (): SQLite.SQLiteDatabase => {
  try {
    logInfo('openDatabase', 'Opening database connection synchronously');
    
    if (!SQLite) {
      throw new Error('SQLite module not available');
    }
    
    const db = SQLite.openDatabaseSync(DATABASE_NAME);
    
    if (!db) {
      throw new Error('Failed to create database instance');
    }
    
    // Test the connection immediately
    const testResult = db.getFirstSync('SELECT 1 as test');
    if (!testResult || (testResult as any).test !== 1) {
      throw new Error('Database connection test failed');
    }
    
    logInfo('openDatabase', 'Database connection opened and tested successfully');
    return db;
  } catch (error) {
    logError('openDatabase', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const initializeDatabase = (): SQLite.SQLiteDatabase => {
  // Return existing instance if already initialized
  if (isDatabaseReady && databaseInstance && validateDatabaseState()) {
    logInfo('initializeDatabase', 'Database already initialized, returning existing instance');
    return databaseInstance;
  }
  
  // Prevent concurrent initialization
  if (isInitializing) {
    throw new Error('Database initialization already in progress');
  }
  
  isInitializing = true;
  
  try {
    return performDatabaseInitialization();
  } finally {
    isInitializing = false;
  }
};

const performDatabaseInitialization = (): SQLite.SQLiteDatabase => {
  logInfo('performDatabaseInitialization', 'Starting synchronous database initialization');
  
  try {
    // Open database connection synchronously
    const db = openDatabase();
    logInfo('performDatabaseInitialization', 'Database connection established');
    
    // Create core tables synchronously
    createCoreTables(db);
    logInfo('performDatabaseInitialization', 'Core tables created');
    
    // Initialize notifications table synchronously
    initializeNotificationsTableSync(db);
    logInfo('performDatabaseInitialization', 'Notifications table initialized');
    
    // Initialize default symptoms synchronously
    initializeDefaultSymptomsSync(db);
    logInfo('performDatabaseInitialization', 'Default symptoms initialized');
    
    // Perform schema migrations synchronously
    performSchemaMigrationsSync(db);
    logInfo('performDatabaseInitialization', 'Schema migrations completed');
    
    // Verify all tables exist and are accessible synchronously
    verifyDatabaseIntegritySync(db);
    logInfo('performDatabaseInitialization', 'Database integrity verified');
    
    // Set global state
    databaseInstance = db;
    isDatabaseReady = true;
    fallbackMode = false;
    
    logInfo('performDatabaseInitialization', 'Database initialization completed successfully');
    return db;
    
  } catch (error) {
    logError('performDatabaseInitialization', `Database initialization failed: ${error}`);
    
    // Reset state on failure
    isDatabaseReady = false;
    databaseInstance = null;
    
    // Enable fallback mode
    enableFallbackMode();
    
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Enable fallback memory-only mode
const enableFallbackMode = (): void => {
  logInfo('enableFallbackMode', 'Enabling fallback memory-only mode');
  fallbackMode = true;
  fallbackData = {
    supplements: [],
    supplement_logs: [],
    symptoms: getDefaultSymptoms(),
    symptom_logs: [],
    cognitive_test_results: [],
    sleep_logs: [],
    schedules: [],
    exclusions: [],
    study_protocols: [],
    scheduled_tests: [],
    notification_records: [],
    notification_settings: [{
      id: 1,
      notifications_enabled: 1,
      supplement_reminders_enabled: 1,
      study_notifications_enabled: 1,
      sleep_reminders_enabled: 1,
      sleep_reminder_type: 'duration_based',
      sleep_reminder_time: null,
      sleep_reminder_hours: 16
    }]
  };
};

// Get default symptoms for fallback mode
const getDefaultSymptoms = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  const defaultSymptoms = [
    { region: 'head', symptoms: ['Headache', 'Dizziness', 'Eye strain', 'Jaw pain'] },
    { region: 'thorax', symptoms: ['Chest pain', 'Shortness of breath', 'Cough', 'Heart palpitations'] },
    { region: 'abdomen', symptoms: ['Stomach ache', 'Nausea', 'Bloating', 'Indigestion'] },
    { region: 'pelvis', symptoms: ['Lower back pain', 'Hip pain', 'Pelvic discomfort'] },
    { region: 'arms', symptoms: ['Arm pain', 'Shoulder pain', 'Muscle tension', 'Joint stiffness'] },
    { region: 'hands', symptoms: ['Wrist pain', 'Finger pain', 'Hand numbness', 'Joint stiffness'] },
    { region: 'legs', symptoms: ['Leg pain', 'Knee pain', 'Muscle cramps', 'Restless legs'] },
    { region: 'feet', symptoms: ['Foot pain', 'Ankle pain', 'Heel pain', 'Toe pain'] }
  ];
  
  const symptoms = [];
  let id = 1;
  for (const { region, symptoms: symptomList } of defaultSymptoms) {
    for (const symptom of symptomList) {
      symptoms.push({
        id: id++,
        body_region: region,
        description: symptom,
        last_used: timestamp
      });
    }
  }
  return symptoms;
};

// Fallback data access functions
export const getFallbackData = (table: string): any[] => {
  return fallbackData[table] || [];
};

export const addFallbackData = (table: string, data: any): number => {
  if (!fallbackData[table]) {
    fallbackData[table] = [];
  }
  const id = Math.max(0, ...fallbackData[table].map((item: any) => item.id || 0)) + 1;
  const newItem = { ...data, id };
  fallbackData[table].push(newItem);
  return id;
};

export const updateFallbackData = (table: string, id: number, data: any): boolean => {
  if (!fallbackData[table]) {
    return false;
  }
  const index = fallbackData[table].findIndex((item: any) => item.id === id);
  if (index === -1) {
    return false;
  }
  fallbackData[table][index] = { ...fallbackData[table][index], ...data };
  return true;
};

export const deleteFallbackData = (table: string, id: number): boolean => {
  if (!fallbackData[table]) {
    return false;
  }
  const index = fallbackData[table].findIndex((item: any) => item.id === id);
  if (index === -1) {
    return false;
  }
  fallbackData[table].splice(index, 1);
  return true;
};

const createCoreTables = (db: SQLite.SQLiteDatabase): void => {
  logInfo('createCoreTables', 'Creating core database tables synchronously');
  
  try {
    db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS supplements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
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
      severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
      notes TEXT,
      FOREIGN KEY (symptom_id) REFERENCES symptoms (id)
    );

    CREATE TABLE IF NOT EXISTS cognitive_test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_type TEXT NOT NULL CHECK (test_type IN ('reflexes', 'memory', 'judgment', 'rock_dodger', 'pattern_matcher', 'melody_repeater', 'tile_puzzle', 'trail_maker', 'n_back')),
      timestamp INTEGER NOT NULL,
      score INTEGER NOT NULL,
      raw_data TEXT,
      completion_time REAL,
      study_id INTEGER,
      supplement_log_id INTEGER,
      FOREIGN KEY (study_id) REFERENCES study_protocols (id),
      FOREIGN KEY (supplement_log_id) REFERENCES supplement_logs (id)
    );

    CREATE TABLE IF NOT EXISTS sleep_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sleep_start INTEGER NOT NULL,
      sleep_end INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      manually_edited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      repeat_interval TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      FOREIGN KEY (supplement_id) REFERENCES supplements (id)
    );

    CREATE TABLE IF NOT EXISTS exclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER NOT NULL,
      exclusion_type TEXT NOT NULL CHECK (exclusion_type IN ('time_window', 'dosage_limit')),
      parameters TEXT NOT NULL,
      FOREIGN KEY (supplement_id) REFERENCES supplements (id)
    );

    CREATE TABLE IF NOT EXISTS study_protocols (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplement_id INTEGER,
      test_type TEXT NOT NULL CHECK (test_type IN ('reflexes', 'memory', 'judgment', 'rock_dodger', 'pattern_matcher', 'melody_repeater', 'tile_puzzle', 'trail_maker', 'n_back')),
      interval_minutes INTEGER NOT NULL,
      duration_minutes INTEGER NOT NULL,
      schedule_type TEXT NOT NULL CHECK (schedule_type IN ('event_based', 'daily_schedule')),
      parameters TEXT,
      FOREIGN KEY (supplement_id) REFERENCES supplements (id)
    );

    CREATE TABLE IF NOT EXISTS scheduled_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      study_protocol_id INTEGER NOT NULL,
      supplement_log_id INTEGER,
      test_type TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (study_protocol_id) REFERENCES study_protocols (id),
      FOREIGN KEY (supplement_log_id) REFERENCES supplement_logs (id)
    );

    CREATE INDEX IF NOT EXISTS idx_supplement_logs_timestamp ON supplement_logs (timestamp);
    CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement_id ON supplement_logs (supplement_id);
    CREATE INDEX IF NOT EXISTS idx_symptom_logs_timestamp ON symptom_logs (timestamp);
    CREATE INDEX IF NOT EXISTS idx_symptom_logs_symptom_id ON symptom_logs (symptom_id);
    CREATE INDEX IF NOT EXISTS idx_cognitive_test_results_timestamp ON cognitive_test_results (timestamp);
    CREATE INDEX IF NOT EXISTS idx_cognitive_test_results_test_type ON cognitive_test_results (test_type);
    CREATE INDEX IF NOT EXISTS idx_cognitive_test_results_study_id ON cognitive_test_results (study_id);
    CREATE INDEX IF NOT EXISTS idx_sleep_logs_start ON sleep_logs (sleep_start);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tests_time ON scheduled_tests (scheduled_time);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tests_completed ON scheduled_tests (completed);
    CREATE INDEX IF NOT EXISTS idx_scheduled_tests_type_time ON scheduled_tests (test_type, scheduled_time);
    CREATE INDEX IF NOT EXISTS idx_exclusions_supplement_id ON exclusions (supplement_id);
    CREATE INDEX IF NOT EXISTS idx_study_protocols_supplement_id ON study_protocols (supplement_id);
    CREATE INDEX IF NOT EXISTS idx_study_protocols_schedule_type ON study_protocols (schedule_type);
    CREATE INDEX IF NOT EXISTS idx_schedules_supplement_id ON schedules (supplement_id);
    `);
    
    logInfo('createCoreTables', 'Core database tables created successfully');
  } catch (error) {
    logError('createCoreTables', error);
    throw error;
  }
};

const performSchemaMigrationsSync = (db: SQLite.SQLiteDatabase): void => {
  logInfo('performSchemaMigrationsSync', 'Performing schema migrations synchronously');
  
  try {
    // Check if color column exists and add it if it doesn't
    const supplementsTableInfo = db.getAllSync('PRAGMA table_info(supplements)');
    const hasColorColumn = supplementsTableInfo.some((col: any) => col.name === 'color');
    
    if (!hasColorColumn) {
      logInfo('performSchemaMigrationsSync', 'Adding color column to supplements table');
      db.execSync('ALTER TABLE supplements ADD COLUMN color TEXT DEFAULT \'#007AFF\'');
    }
    
    // Check if completion_time column exists in cognitive_test_results and add it if it doesn't
    const cognitiveTableInfo = db.getAllSync('PRAGMA table_info(cognitive_test_results)');
    const hasCompletionTimeColumn = cognitiveTableInfo.some((col: any) => col.name === 'completion_time');
    
    if (!hasCompletionTimeColumn) {
      logInfo('performSchemaMigrationsSync', 'Adding completion_time column to cognitive_test_results table');
      db.execSync('ALTER TABLE cognitive_test_results ADD COLUMN completion_time REAL');
    }
    
    logInfo('performSchemaMigrationsSync', 'Schema migrations completed successfully');
  } catch (error) {
    logError('performSchemaMigrationsSync', error);
    throw error;
  }
};

const verifyDatabaseIntegritySync = (db: SQLite.SQLiteDatabase): void => {
  logInfo('verifyDatabaseIntegritySync', 'Verifying database integrity synchronously');
  
  try {
    // Check that all critical tables exist
    const tables = db.getAllSync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    const tableNames = tables.map((table: any) => table.name);
    const requiredTables = [
      'supplements', 'supplement_logs', 'symptoms', 'symptom_logs',
      'cognitive_test_results', 'sleep_logs', 'schedules', 'exclusions',
      'study_protocols', 'scheduled_tests', 'notification_records', 'notification_settings'
    ];
    
    for (const requiredTable of requiredTables) {
      if (!tableNames.includes(requiredTable)) {
        throw new Error(`Required table '${requiredTable}' not found in database`);
      }
    }
    
    // Test basic operations on key tables
    db.getAllSync('SELECT COUNT(*) as count FROM supplements LIMIT 1');
    db.getAllSync('SELECT COUNT(*) as count FROM symptoms LIMIT 1');
    db.getAllSync('SELECT COUNT(*) as count FROM notification_records LIMIT 1');
    
    logInfo('verifyDatabaseIntegritySync', 'Database integrity verification passed');
  } catch (error) {
    logError('verifyDatabaseIntegritySync', error);
    throw error;
  }
};

// Synchronous notifications table initialization
const initializeNotificationsTableSync = (db: SQLite.SQLiteDatabase): void => {
  logInfo('initializeNotificationsTableSync', 'Initializing notifications table synchronously');
  
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS notification_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('supplement_reminder', 'study_protocol', 'sleep_reminder')),
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
      
      CREATE INDEX IF NOT EXISTS idx_notification_records_type ON notification_records (type);
      CREATE INDEX IF NOT EXISTS idx_notification_records_scheduled_time ON notification_records (scheduled_time);
      CREATE INDEX IF NOT EXISTS idx_notification_records_cancelled ON notification_records (cancelled);
    `);
    
    // Insert default settings if they don't exist
    db.execSync(`INSERT OR IGNORE INTO notification_settings (id) VALUES (1);`);
    
    logInfo('initializeNotificationsTableSync', 'Notifications table initialized successfully');
  } catch (error) {
    logError('initializeNotificationsTableSync', error);
    throw error;
  }
};

// Synchronous default symptoms initialization
const initializeDefaultSymptomsSync = (db: SQLite.SQLiteDatabase): void => {
  logInfo('initializeDefaultSymptomsSync', 'Initializing default symptoms synchronously');
  
  try {
    // Check if symptoms table has any data
    const count = db.getFirstSync('SELECT COUNT(*) as count FROM symptoms');
    if ((count as any)?.count > 0) {
      logInfo('initializeDefaultSymptomsSync', 'Symptoms table already has data, skipping initialization');
      return; // Already has symptoms
    }
    
    // Add default symptoms for each body region
    const defaultSymptoms = [
      { region: 'head', symptoms: ['Headache', 'Dizziness', 'Eye strain', 'Jaw pain'] },
      { region: 'thorax', symptoms: ['Chest pain', 'Shortness of breath', 'Cough', 'Heart palpitations'] },
      { region: 'abdomen', symptoms: ['Stomach ache', 'Nausea', 'Bloating', 'Indigestion'] },
      { region: 'pelvis', symptoms: ['Lower back pain', 'Hip pain', 'Pelvic discomfort'] },
      { region: 'arms', symptoms: ['Arm pain', 'Shoulder pain', 'Muscle tension', 'Joint stiffness'] },
      { region: 'hands', symptoms: ['Wrist pain', 'Finger pain', 'Hand numbness', 'Joint stiffness'] },
      { region: 'legs', symptoms: ['Leg pain', 'Knee pain', 'Muscle cramps', 'Restless legs'] },
      { region: 'feet', symptoms: ['Foot pain', 'Ankle pain', 'Heel pain', 'Toe pain'] }
    ];
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    for (const { region, symptoms } of defaultSymptoms) {
      for (const symptom of symptoms) {
        db.runSync(
          'INSERT INTO symptoms (body_region, description, last_used) VALUES (?, ?, ?)',
          [region, symptom, timestamp]
        );
      }
    }
    
    logInfo('initializeDefaultSymptomsSync', 'Default symptoms initialized successfully');
  } catch (error) {
    logError('initializeDefaultSymptomsSync', error);
    throw error;
  }
};

// Reset database state (for testing or error recovery)
export const resetDatabaseState = (): void => {
  logInfo('resetDatabaseState', 'Resetting database state');
  isDatabaseReady = false;
  databaseInstance = null;
  isInitializing = false;
  fallbackMode = false;
  fallbackData = {};
};

// Initialize database and handle errors gracefully
export const initializeDatabaseSafely = (): { success: boolean; error?: string } => {
  try {
    initializeDatabase();
    return { success: true };
  } catch (error) {
    logError('initializeDatabaseSafely', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
};

// Get database status for UI
export const getDatabaseStatus = (): {
  ready: boolean;
  fallback: boolean;
  error?: string;
} => {
  if (fallbackMode) {
    return {
      ready: false,
      fallback: true,
      error: 'Database failed to initialize - running in memory-only mode. Data will not persist.'
    };
  }
  
  if (isDatabaseReady && validateDatabaseState()) {
    return {
      ready: true,
      fallback: false
    };
  }
  
  return {
    ready: false,
    fallback: false,
    error: 'Database not initialized'
  };
};