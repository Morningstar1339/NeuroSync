import * as SQLite from 'expo-sqlite';
import { logDatabaseAccess } from '../utils/database-tracker';

const DATABASE_NAME = 'neurosync.db';

// Global state tracking with extra protection
let _databaseInstance: SQLite.SQLiteDatabase | null = null;
let isDatabaseReady = false;
let isInitializing = false;
let fallbackMode = false;
let fallbackData: { [key: string]: any[] } = {};

// Backup reference to prevent accidental loss
let _databaseInstanceBackup: SQLite.SQLiteDatabase | null = null;

// Tracked getter for database instance
function getDatabaseInstance(): SQLite.SQLiteDatabase | null {
  logDatabaseAccess('GET_DATABASE_INSTANCE', _databaseInstance, _databaseInstance);
  return _databaseInstance;
}

// Tracked setter for database instance
function setDatabaseInstance(db: SQLite.SQLiteDatabase | null, reason: string): void {
  const previousState = _databaseInstance;
  logDatabaseAccess(`SET_DATABASE_INSTANCE: ${reason}`, _databaseInstance, db);
  logInfo('setDatabaseInstance', `Setting database instance from ${previousState ? 'existing' : 'null'} to ${db ? 'new instance' : 'null'} - reason: ${reason}`);
  
  // If setting to null but we have a backup and no good reason, prevent it
  if (!db && _databaseInstanceBackup && reason !== 'explicit_reset' && reason !== 'initialization_failed') {
    logError('setDatabaseInstance', `Attempted to set database instance to null for reason: ${reason}. Keeping backup instance instead.`);
    _databaseInstance = _databaseInstanceBackup;
    logDatabaseAccess('RESTORE_FROM_BACKUP', null, _databaseInstance);
    return;
  }
  
  _databaseInstance = db;
  
  // Store backup when setting a valid instance
  if (db) {
    _databaseInstanceBackup = db;
    logInfo('setDatabaseInstance', 'Database instance backup created');
  }
}

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
export const isDatabaseInitialized = () => {
  // Double-check: if we say we're ready but have no instance, we're not really ready
  if (isDatabaseReady && !getDatabaseInstance()) {
    logError('isDatabaseInitialized', 'Database marked as ready but instance is null - correcting status');
    isDatabaseReady = false;
    return false;
  }
  return isDatabaseReady;
};
export const isFallbackMode = () => fallbackMode;

// Additional diagnostic function
export const getDatabaseInstanceStatus = () => {
  return {
    hasInstance: !!getDatabaseInstance(),
    hasBackup: !!_databaseInstanceBackup,
    isReady: isDatabaseReady,
    isFallback: fallbackMode,
    canRecover: !getDatabaseInstance() && !!_databaseInstanceBackup
  };
};

// Comprehensive null checks before any database operation
const validateDatabaseState = (): boolean => {
  if (!SQLite) {
    logError('validateDatabaseState', 'SQLite module not loaded');
    return false;
  }
  
  if (!getDatabaseInstance()) {
    logError('validateDatabaseState', `Database instance is null - ready flag: ${isDatabaseReady}, fallback: ${fallbackMode}`);
    
    // If we're supposed to be ready but instance is null, this is a critical bug
    if (isDatabaseReady && !fallbackMode) {
      logError('validateDatabaseState', 'CRITICAL BUG: Database marked as ready but instance is null!');
    }
    
    return false;
  }
  
  // Additional validation: check if the instance is still a valid SQLite object
  try {
    const testResult = getDatabaseInstance()!.getFirstSync('SELECT 1 as test');
    if ((testResult as any)?.test !== 1) {
      logError('validateDatabaseState', 'Database instance exists but connection test failed');
      return false;
    }
  } catch (error) {
    logError('validateDatabaseState', `Database instance exists but is not functional: ${error}`);
    return false;
  }
  
  return true;
};

// Health check function to verify database state
export const checkDatabaseHealth = (): {
  healthy: boolean;
  issues: string[];
  details: {
    hasInstance: boolean;
    isReady: boolean;
    isFallback: boolean;
    connectionTest: boolean;
    tablesExist: boolean;
  };
} => {
  const issues: string[] = [];
  const details = {
    hasInstance: !!getDatabaseInstance(),
    isReady: isDatabaseReady,
    isFallback: fallbackMode,
    connectionTest: false,
    tablesExist: false
  };
  
  logInfo('checkDatabaseHealth', `Starting health check - hasInstance: ${details.hasInstance}, isReady: ${details.isReady}, isFallback: ${details.isFallback}`);
  
  // Check if we're in fallback mode
  if (fallbackMode) {
    issues.push('Database running in fallback memory-only mode');
    return { healthy: false, issues, details };
  }
  
  // Check if database instance exists
  if (!getDatabaseInstance()) {
    issues.push('Database instance is null');
  }
  
  // Check ready flag consistency
  if (isDatabaseReady && !getDatabaseInstance()) {
    issues.push('Database marked as ready but instance is null (critical bug)');
  }
  
  // Test database connection if instance exists
  if (getDatabaseInstance()) {
    try {
      const testResult = getDatabaseInstance()!.getFirstSync('SELECT 1 as test');
      if ((testResult as any)?.test === 1) {
        details.connectionTest = true;
        logInfo('checkDatabaseHealth', 'Database connection test passed');
      } else {
        issues.push('Database connection test failed - unexpected result');
        logError('checkDatabaseHealth', `Connection test returned: ${JSON.stringify(testResult)}`);
      }
    } catch (error) {
      issues.push(`Database connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      logError('checkDatabaseHealth', `Connection test error: ${error}`);
    }
  }
  
  // Check if required tables exist
  if (getDatabaseInstance() && details.connectionTest) {
    try {
      const requiredTables = [
        'supplements', 'supplement_logs', 'symptoms', 'symptom_logs',
        'cognitive_test_results', 'sleep_logs', 'schedules', 'exclusions',
        'study_protocols', 'scheduled_tests', 'notification_records', 'notification_settings'
      ];
      
      const tables = getDatabaseInstance()!.getAllSync(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      const tableNames = tables.map((table: any) => table.name);
      const missingTables = requiredTables.filter(table => !tableNames.includes(table));
      
      if (missingTables.length === 0) {
        details.tablesExist = true;
        logInfo('checkDatabaseHealth', 'All required tables exist');
      } else {
        issues.push(`Missing required tables: ${missingTables.join(', ')}`);
        logError('checkDatabaseHealth', `Missing tables: ${missingTables.join(', ')}`);
      }
    } catch (error) {
      issues.push(`Failed to check table existence: ${error instanceof Error ? error.message : String(error)}`);
      logError('checkDatabaseHealth', `Table check error: ${error}`);
    }
  }
  
  const healthy = issues.length === 0;
  logInfo('checkDatabaseHealth', `Health check complete - healthy: ${healthy}, issues: ${issues.length}`);
  
  return { healthy, issues, details };
};

// Get database instance with validation and enhanced logging
export const getDatabase = (): SQLite.SQLiteDatabase | null => {
  const timestamp = new Date().toISOString();
  const currentInstance = getDatabaseInstance();
  const currentReady = isDatabaseReady;
  const currentFallback = fallbackMode;
  
  logInfo('getDatabase', `[${timestamp}] Getting database instance - ready: ${currentReady}, fallback: ${currentFallback}, instance: ${currentInstance ? 'exists' : 'null'}`);
  
  if (fallbackMode) {
    logInfo('getDatabase', 'Running in fallback mode - returning null');
    return null;
  }
  
  // Emergency reinitialization if database marked ready but instance is null
  if (isDatabaseReady && !getDatabaseInstance()) {
    logError('getDatabase', 'CRITICAL: Database marked as ready but instance is null! Attempting emergency recovery...');
    
    try {
      logInfo('getDatabase', 'Step 1: Attempting emergency database reinitialization...');
      const emergencyDb = openDatabase();
      
      logInfo('getDatabase', 'Step 2: Testing emergency database connection...');
      const testResult = emergencyDb.getFirstSync('SELECT 1 as test');
      if ((testResult as any)?.test !== 1) {
        throw new Error('Emergency database connection test failed');
      }
      
      logInfo('getDatabase', 'Step 3: Setting emergency database instance...');
      setDatabaseInstance(emergencyDb, 'emergency_recovery');
      
      logInfo('getDatabase', '✅ Emergency reinitialization successful');
      return emergencyDb;
    } catch (error) {
      logError('getDatabase', `❌ Emergency reinitialization failed: ${error}`);
      isDatabaseReady = false;
      
      // Try to recover from backup if available
      if (_databaseInstanceBackup) {
        logInfo('getDatabase', 'Attempting recovery from backup instance...');
        try {
          const backupTest = _databaseInstanceBackup.getFirstSync('SELECT 1 as test');
          if ((backupTest as any)?.test === 1) {
            setDatabaseInstance(_databaseInstanceBackup, 'backup_recovery');
            isDatabaseReady = true;
            logInfo('getDatabase', '✅ Successfully recovered from backup instance');
            return _databaseInstanceBackup;
          }
        } catch (backupError) {
          logError('getDatabase', `Backup recovery failed: ${backupError}`);
        }
      }
      
      return null;
    }
  }
  
  // Comprehensive validation with automatic recovery
  if (!validateDatabaseState()) {
    logError('getDatabase', 'Database state validation failed - attempting auto-recovery...');
    
    // Try to reopen database if validation fails
    try {
      logInfo('getDatabase', 'Attempting database auto-recovery...');
      const recoveredDb = openDatabase();
      
      // Test the recovered database
      const testResult = recoveredDb.getFirstSync('SELECT 1 as test');
      if ((testResult as any)?.test !== 1) {
        throw new Error('Recovered database connection test failed');
      }
      
      setDatabaseInstance(recoveredDb, 'auto_recovery');
      isDatabaseReady = true;
      
      logInfo('getDatabase', '✅ Database auto-recovery successful');
      return recoveredDb;
    } catch (error) {
      logError('getDatabase', `❌ Database auto-recovery failed: ${error}`);
      isDatabaseReady = false;
      return null;
    }
  }
  
  logInfo('getDatabase', `✅ [${timestamp}] Returning valid database instance`);
  return getDatabaseInstance();
};

// Safe database operations wrapper with fallback support
export const withDatabase = async <T>(
  operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
  operationName: string = 'database operation',
  fallbackOperation?: () => Promise<T>
): Promise<T> => {
  const operationId = `${operationName}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  logInfo('withDatabase', `[${timestamp}] [${operationId}] Starting database operation: ${operationName}`);
  
  try {
    if (fallbackMode && fallbackOperation) {
      logInfo('withDatabase', `[${operationId}] Using fallback mode for ${operationName}`);
      const result = await fallbackOperation();
      logInfo('withDatabase', `[${operationId}] ✅ Fallback operation completed successfully`);
      return result;
    }
    
    logInfo('withDatabase', `[${operationId}] Getting database instance...`);
    const db = getDatabase();
    if (!db) {
      logError('withDatabase', `[${operationId}] Database instance not available`);
      
      if (fallbackOperation) {
        logInfo('withDatabase', `[${operationId}] Database unavailable, using fallback for ${operationName}`);
        const result = await fallbackOperation();
        logInfo('withDatabase', `[${operationId}] ✅ Fallback operation completed successfully`);
        return result;
      }
      throw new Error(`Database not available and no fallback provided for ${operationName}`);
    }
    
    logInfo('withDatabase', `[${operationId}] ✅ Database instance obtained, executing operation...`);
    const result = await operation(db);
    logInfo('withDatabase', `[${operationId}] ✅ Database operation completed successfully: ${operationName}`);
    return result;
    
  } catch (error) {
    logError('withDatabase', `[${operationId}] ❌ Operation failed: ${operationName}`);
    logError('withDatabase', `[${operationId}] Error details:`);
    logError('withDatabase', `[${operationId}]   - Error name: ${error instanceof Error ? error.name : 'Unknown'}`);
    logError('withDatabase', `[${operationId}]   - Error message: ${error instanceof Error ? error.message : String(error)}`);
    logError('withDatabase', `[${operationId}]   - Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
    
    if (fallbackOperation) {
      logInfo('withDatabase', `[${operationId}] Database operation failed, attempting fallback for ${operationName}`);
      try {
        const result = await fallbackOperation();
        logInfo('withDatabase', `[${operationId}] ✅ Fallback operation completed successfully`);
        return result;
      } catch (fallbackError) {
        logError('withDatabase', `[${operationId}] ❌ Fallback operation also failed:`);
        logError('withDatabase', `[${operationId}]   - Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        throw new Error(`Both database and fallback operations failed for ${operationName}. Database error: ${error instanceof Error ? error.message : 'Unknown error'}. Fallback error: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`Database operation failed: ${operationName}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Reset database by deleting the database using SQLite operations
export const resetDatabase = async (): Promise<boolean> => {
  try {
    logInfo('resetDatabase', 'Starting database reset');
    
    // Close existing connection if any
    if (getDatabaseInstance()) {
      try {
        await getDatabaseInstance()!.closeAsync();
        logInfo('resetDatabase', 'Closed existing database connection');
      } catch (error) {
        logError('resetDatabase', `Failed to close database: ${error}`);
      }
    }
    
    // Reset state
    setDatabaseInstance(null, 'database_reset');
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
    console.log('🔄 OPEN DB: STEP 2.1 - Loading SQLite module...');
    logInfo('openDatabase', 'Opening database connection synchronously');
    
    if (!SQLite) {
      console.log('❌ OPEN DB: STEP 2.1 FAILED - SQLite module not available');
      throw new Error('SQLite module not available');
    }
    console.log('✅ OPEN DB: STEP 2.1 COMPLETE - SQLite module loaded');
    
    console.log(`🔄 OPEN DB: STEP 2.2 - Opening database with name: ${DATABASE_NAME}`);
    console.log('🔄 OPEN DB: Using platform default storage location (works in both Expo Go and production)');
    const db = SQLite.openDatabaseSync(DATABASE_NAME);
    
    if (!db) {
      console.log('❌ OPEN DB: STEP 2.2 FAILED - Failed to create database instance');
      throw new Error('Failed to create database instance');
    }
    console.log('✅ OPEN DB: STEP 2.2 COMPLETE - Database instance created');
    
    console.log('🔄 OPEN DB: STEP 2.3 - Testing database connection...');
    // Test the connection immediately
    const testResult = db.getFirstSync('SELECT 1 as test');
    if (!testResult || (testResult as any).test !== 1) {
      console.log('❌ OPEN DB: STEP 2.3 FAILED - Database connection test failed');
      throw new Error('Database connection test failed');
    }
    console.log('✅ OPEN DB: STEP 2.3 COMPLETE - Database connection test passed');
    
    console.log('✅ OPEN DB: SUCCESS - Database connection opened and tested successfully');
    logInfo('openDatabase', 'Database connection opened and tested successfully');
    return db;
  } catch (error) {
    console.log('❌ OPEN DB: FAILED - Database connection failed:', error);
    logError('openDatabase', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const initializeDatabase = (): SQLite.SQLiteDatabase => {
  // Return existing instance if already initialized
  if (isDatabaseReady && getDatabaseInstance() && validateDatabaseState()) {
    logInfo('initializeDatabase', 'Database already initialized, returning existing instance');
    return getDatabaseInstance()!;
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
  console.log('🔄 DATABASE INIT: STEP 1 - Starting synchronous database initialization...');
  logInfo('performDatabaseInitialization', 'Starting synchronous database initialization');
  
  try {
    console.log('🔄 DATABASE INIT: STEP 2 - Opening database connection...');
    // Open database connection synchronously
    const db = openDatabase();
    console.log('✅ DATABASE INIT: STEP 2 COMPLETE - Database connection established');
    logInfo('performDatabaseInitialization', 'Database connection established');
    
    console.log('🔄 DATABASE INIT: STEP 3 - Creating core tables...');
    // Create core tables synchronously
    createCoreTables(db);
    console.log('✅ DATABASE INIT: STEP 3 COMPLETE - Core tables created');
    logInfo('performDatabaseInitialization', 'Core tables created');
    
    console.log('🔄 DATABASE INIT: STEP 4 - Initializing notifications table...');
    // Initialize notifications table synchronously
    initializeNotificationsTableSync(db);
    console.log('✅ DATABASE INIT: STEP 4 COMPLETE - Notifications table initialized');
    logInfo('performDatabaseInitialization', 'Notifications table initialized');
    
    console.log('🔄 DATABASE INIT: STEP 5 - Initializing default symptoms...');
    // Initialize default symptoms synchronously
    initializeDefaultSymptomsSync(db);
    console.log('✅ DATABASE INIT: STEP 5 COMPLETE - Default symptoms initialized');
    logInfo('performDatabaseInitialization', 'Default symptoms initialized');
    
    console.log('🔄 DATABASE INIT: STEP 6 - Performing schema migrations...');
    // Perform schema migrations synchronously
    performSchemaMigrationsSync(db);
    console.log('✅ DATABASE INIT: STEP 6 COMPLETE - Schema migrations completed');
    logInfo('performDatabaseInitialization', 'Schema migrations completed');
    
    console.log('🔄 DATABASE INIT: STEP 7 - Verifying database integrity...');
    // Verify all tables exist and are accessible synchronously
    verifyDatabaseIntegritySync(db);
    console.log('✅ DATABASE INIT: STEP 7 COMPLETE - Database integrity verified');
    logInfo('performDatabaseInitialization', 'Database integrity verified');
    
    console.log('🔄 DATABASE INIT: STEP 8 - Setting global state...');
    // Set global state with extra validation using protected setter
    setDatabaseInstance(db, 'successful_initialization');
    isDatabaseReady = true;
    fallbackMode = false;
    
    // Verify the instance was actually stored
    if (getDatabaseInstance() !== db) {
      throw new Error('Critical error: Failed to store database instance in global variable');
    }
    
    console.log('✅ DATABASE INIT: STEP 8 COMPLETE - Global state set and verified');
    logInfo('performDatabaseInitialization', `Database instance stored successfully - reference: ${getDatabaseInstance() ? 'valid' : 'null'}`);
    
    console.log('🎉 DATABASE INIT: SUCCESS - Database initialization completed successfully!');
    logInfo('performDatabaseInitialization', 'Database initialization completed successfully');
    return db;
    
  } catch (error) {
    console.log('❌ DATABASE INIT: FAILED - Database initialization failed:', error);
    logError('performDatabaseInitialization', `Database initialization failed: ${error}`);
    
    console.log('🔄 DATABASE INIT: CLEANUP - Resetting state on failure...');
    // Reset state on failure
    isDatabaseReady = false;
    setDatabaseInstance(null, 'initialization_failed');
    
    console.log('🔄 DATABASE INIT: FALLBACK - Enabling fallback mode...');
    // Enable fallback mode
    enableFallbackMode();
    console.log('✅ DATABASE INIT: FALLBACK ENABLED - Fallback mode is now active');
    
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
  console.log('🔄 CREATE TABLES: STEP 3.1 - Starting core table creation...');
  logInfo('createCoreTables', 'Creating core database tables synchronously');
  
  try {
    console.log('🔄 CREATE TABLES: STEP 3.2 - Setting database pragmas...');
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
    console.log('✅ CREATE TABLES: STEP 3.2 COMPLETE - Database tables and indexes created');
    
    console.log('✅ CREATE TABLES: SUCCESS - Core database tables created successfully');
    logInfo('createCoreTables', 'Core database tables created successfully');
  } catch (error) {
    console.log('❌ CREATE TABLES: FAILED - Core table creation failed:', error);
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
  setDatabaseInstance(null, 'explicit_reset');
  _databaseInstanceBackup = null; // Clear backup too on explicit reset
  isInitializing = false;
  fallbackMode = false;
  fallbackData = {};
};

// Initialize database with retry logic and exponential backoff
export const initializeDatabaseWithRetry = async (maxRetries: number = 3): Promise<{ success: boolean; error?: string; attempts: number }> => {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 DATABASE RETRY: Attempt ${attempt}/${maxRetries} - Starting database initialization...`);
      
      // Check permissions first
      const permissions = await checkStoragePermissions();
      if (!permissions.hasPermissions || !permissions.canWrite) {
        throw new Error(`Storage permissions failed: ${permissions.error || 'Cannot write to storage'}`);
      }
      
      // Check database path
      const pathCheck = await checkDatabasePath();
      if (!pathCheck.isWritable) {
        throw new Error(`Database path not writable: ${pathCheck.error || 'Cannot write to database directory'}`);
      }
      
      // Try to initialize database
      initializeDatabase();
      
      console.log(`✅ DATABASE RETRY: SUCCESS on attempt ${attempt}/${maxRetries}`);
      return { success: true, attempts: attempt };
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`❌ DATABASE RETRY: Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms...
        const delayMs = Math.pow(2, attempt - 1) * 100;
        console.log(`🔄 DATABASE RETRY: Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Reset state before retry
        resetDatabaseState();
      }
    }
  }
  
  console.log(`❌ DATABASE RETRY: All ${maxRetries} attempts failed. Enabling fallback mode.`);
  enableFallbackMode();
  
  return { 
    success: false, 
    error: lastError?.message || 'Database initialization failed after retries',
    attempts: maxRetries
  };
};

// Initialize database and handle errors gracefully (kept for backward compatibility)
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
  diagnostic?: any;
} => {
  const diagnostic = getDatabaseInstanceStatus();
  
  if (fallbackMode) {
    return {
      ready: false,
      fallback: true,
      error: 'Database failed to initialize - running in memory-only mode. Data will not persist.',
      diagnostic
    };
  }
  
  // Check if we can recover from a lost instance
  if (diagnostic.canRecover) {
    logInfo('getDatabaseStatus', 'Database instance lost but backup available - attempting recovery');
    try {
      setDatabaseInstance(_databaseInstanceBackup, 'backup_recovery');
      logInfo('getDatabaseStatus', 'Successfully recovered database instance from backup');
    } catch (error) {
      logError('getDatabaseStatus', `Failed to recover from backup: ${error}`);
    }
  }
  
  if (isDatabaseInitialized() && validateDatabaseState()) {
    return {
      ready: true,
      fallback: false,
      diagnostic
    };
  }
  
  return {
    ready: false,
    fallback: false,
    error: diagnostic.hasInstance ? 'Database instance invalid' : 'Database not initialized',
    diagnostic
  };
};

// Check SQLite availability (simplified for Expo Go compatibility)
export const checkStoragePermissions = async (): Promise<{
  hasPermissions: boolean;
  canWrite: boolean;
  canCreateDirectory: boolean;
  error?: string;
}> => {
  try {
    console.log('🔄 PERMISSIONS: Checking SQLite availability...');
    
    // Test SQLite module availability
    if (!SQLite) {
      return {
        hasPermissions: false,
        canWrite: false,
        canCreateDirectory: false,
        error: 'SQLite module not available'
      };
    }
    
    console.log('✅ PERMISSIONS: SQLite module is available');
    
    // Test basic database creation and operations
    try {
      const testDb = SQLite.openDatabaseSync('permission_test.db');
      testDb.execSync('CREATE TABLE IF NOT EXISTS test (id INTEGER, value TEXT)');
      testDb.runSync('INSERT INTO test (id, value) VALUES (1, ?)', ['test']);
      const result = testDb.getFirstSync('SELECT value FROM test WHERE id = 1');
      const canWrite = (result as any)?.value === 'test';
      testDb.execSync('DROP TABLE test');
      await testDb.closeAsync();
      
      console.log(`✅ PERMISSIONS: SQLite write test ${canWrite ? 'PASSED' : 'FAILED'}`);
      
      return {
        hasPermissions: true,
        canWrite,
        canCreateDirectory: true, // SQLite handles this automatically
      };
    } catch (dbError) {
      console.log(`❌ PERMISSIONS: SQLite test failed: ${dbError}`);
      return {
        hasPermissions: true, // SQLite module exists
        canWrite: false,
        canCreateDirectory: false,
        error: `SQLite test failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`
      };
    }
  } catch (error) {
    console.log(`❌ PERMISSIONS: Permission check failed: ${error}`);
    return {
      hasPermissions: false,
      canWrite: false,
      canCreateDirectory: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Get database name (platform handles storage location automatically)
export const getDatabasePath = (): string => {
  return `${DATABASE_NAME} (platform default storage)`;
};

// Check database status without file system access (Expo Go compatible)
export const checkDatabasePath = async (): Promise<{
  pathExists: boolean;
  fileExists: boolean;
  fileSize: number;
  isWritable: boolean;
  directoryExists: boolean;
  fullPath: string;
  error?: string;
}> => {
  try {
    console.log('🔄 PATH CHECK: Checking database status (Expo Go compatible)...');
    
    const displayPath = getDatabasePath();
    console.log(`🔄 PATH CHECK: Database: ${displayPath}`);
    
    // Test database accessibility through SQLite directly
    let fileExists = false;
    let isWritable = false;
    
    try {
      const testDb = SQLite.openDatabaseSync(DATABASE_NAME);
      
      // Check if database has any tables (indicates it exists and has data)
      const tables = testDb.getAllSync("SELECT name FROM sqlite_master WHERE type='table'");
      fileExists = Array.isArray(tables) && tables.length > 0;
      
      // Test write capability
      testDb.runSync('CREATE TABLE IF NOT EXISTS path_test (id INTEGER)');
      testDb.runSync('INSERT OR REPLACE INTO path_test (id) VALUES (1)');
      const result = testDb.getFirstSync('SELECT id FROM path_test WHERE id = 1');
      isWritable = (result as any)?.id === 1;
      testDb.runSync('DROP TABLE path_test');
      
      console.log(`✅ PATH CHECK: Database accessible: ${fileExists}, writable: ${isWritable}`);
      
      return {
        pathExists: true,
        fileExists,
        fileSize: -1, // Cannot determine file size without FileSystem API
        isWritable,
        directoryExists: true, // SQLite handles this
        fullPath: displayPath,
      };
    } catch (dbError) {
      console.log(`❌ PATH CHECK: Database test failed: ${dbError}`);
      return {
        pathExists: true,
        fileExists: false,
        fileSize: 0,
        isWritable: false,
        directoryExists: true,
        fullPath: displayPath,
        error: `Database test failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`
      };
    }
  } catch (error) {
    console.log(`❌ PATH CHECK: Path check failed: ${error}`);
    return {
      pathExists: false,
      fileExists: false,
      fileSize: 0,
      isWritable: false,
      directoryExists: false,
      fullPath: getDatabasePath(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
};