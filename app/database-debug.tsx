import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar, Platform, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import { 
  getDatabase, 
  isDatabaseInitialized, 
  isFallbackMode, 
  getDatabaseStatus,
  initializeDatabaseSafely,
  initializeDatabaseWithRetry,
  resetDatabaseState,
  checkStoragePermissions,
  checkDatabasePath,
  getDatabasePath,
  checkDatabaseHealth
} from '@/database/database';
import { getDatabaseAccessLog, clearAccessLog, logReactLifecycleEvent, logNavigationEvent } from '@/utils/database-tracker';

interface DatabaseDebugInfo {
  sqliteModuleLoaded: boolean;
  databaseInstanceCreated: boolean;
  databaseConnectionOpen: boolean;
  databaseFilePath: string;
  canReadFromDatabase: boolean;
  canWriteToDatabase: boolean;
  initializationErrors: string[];
  lastOperationAttempted: string;
  fallbackMode: boolean;
  databaseReady: boolean;
  storagePermissions: boolean;
  writeAccess: boolean;
  testFileCreated: boolean;
  dbFileExists: boolean;
  dbFileSize: number;
}

export default function DatabaseDebugScreen() {
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<DatabaseDebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<{ [key: string]: { success: boolean; error?: string } }>({});
  const [accessLog, setAccessLog] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [criticalEvents, setCriticalEvents] = useState<any[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testSessionStartTime, setTestSessionStartTime] = useState<string | null>(null);
  const [reactLifecycleEvents, setReactLifecycleEvents] = useState<any[]>([]);
  const [navigationEvents, setNavigationEvents] = useState<any[]>([]);
  const logSessionRef = useRef<any[]>([]);

  // Track React lifecycle events
  useEffect(() => {
    logReactLifecycleEvent('Mounted', 'DatabaseDebugScreen', 'Debug screen component mounted');
    const lifecycleEvent = {
      timestamp: new Date().toISOString(),
      event: 'Component Mounted',
      details: 'DatabaseDebugScreen mounted'
    };
    setReactLifecycleEvents(prev => [...prev, lifecycleEvent]);
    
    performDatabaseDebug();
    
    return () => {
      logReactLifecycleEvent('Unmounting', 'DatabaseDebugScreen', 'Debug screen component unmounting');
      const unmountEvent = {
        timestamp: new Date().toISOString(),
        event: 'Component Unmounting',
        details: 'DatabaseDebugScreen unmounting'
      };
      setReactLifecycleEvents(prev => [...prev, unmountEvent]);
    };
  }, []);
  
  // Track state changes
  useEffect(() => {
    if (isTestMode) {
      logReactLifecycleEvent('State Change', 'DatabaseDebugScreen', 'Test mode activated');
    }
  }, [isTestMode]);
  
  useEffect(() => {
    if (autoRefresh) {
      logReactLifecycleEvent('State Change', 'DatabaseDebugScreen', 'Auto refresh enabled');
    } else {
      logReactLifecycleEvent('State Change', 'DatabaseDebugScreen', 'Auto refresh disabled');
    }
  }, [autoRefresh]);

  const updateAccessLogAndHealth = () => {
    const fullLog = getDatabaseAccessLog();
    setAccessLog(fullLog); // Show ALL entries, not just last 50
    setHealth(checkDatabaseHealth());
    
    // Track critical events (when database becomes null)
    const newCriticalEvents = fullLog.filter(entry => 
      !entry.dbWasNull && entry.dbIsNull
    );
    setCriticalEvents(newCriticalEvents);
    
    // Store current session log
    if (isTestMode) {
      logSessionRef.current = fullLog.filter(entry => 
        !testSessionStartTime || entry.timestamp >= testSessionStartTime
      );
    }
  };

  useEffect(() => {
    updateAccessLogAndHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      updateAccessLogAndHealth();
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearAccessLog = () => {
    clearAccessLog();
    setCriticalEvents([]);
    setReactLifecycleEvents([]);
    setNavigationEvents([]);
    logSessionRef.current = [];
    updateAccessLogAndHealth();
  };
  
  const startTestMode = () => {
    logNavigationEvent('Test Mode Started', 'User initiated test logging session');
    setIsTestMode(true);
    setTestSessionStartTime(new Date().toISOString());
    clearAccessLog();
    setCriticalEvents([]);
    setReactLifecycleEvents([]);
    setNavigationEvents([]);
    logSessionRef.current = [];
    
    const testStartEvent = {
      timestamp: new Date().toISOString(),
      event: 'Test Session Started',
      details: 'Clean logging session initiated'
    };
    setReactLifecycleEvents([testStartEvent]);
    
    Alert.alert('Test Mode Started', 'Logs cleared. Ready to capture clean test run.');
  };
  
  const stopTestMode = () => {
    logNavigationEvent('Test Mode Stopped', 'User ended test logging session');
    setIsTestMode(false);
    setTestSessionStartTime(null);
    
    const testEndEvent = {
      timestamp: new Date().toISOString(),
      event: 'Test Session Ended',
      details: 'Test logging session completed'
    };
    setReactLifecycleEvents(prev => [...prev, testEndEvent]);
  };
  
  const copyAllLogsToClipboard = () => {
    logNavigationEvent('Logs Exported', 'User exported all forensic logs to clipboard');
    const allLogs = {
      timestamp: new Date().toISOString(),
      testMode: isTestMode,
      testSessionStartTime,
      criticalEvents: criticalEvents.length,
      accessLog: isTestMode ? logSessionRef.current : accessLog,
      reactLifecycleEvents,
      navigationEvents,
      databaseHealth: health,
      debugInfo
    };
    
    const formattedLogs = formatLogsForExport(allLogs);
    Clipboard.setString(formattedLogs);
    Alert.alert('Logs Copied', 'All forensic logs have been copied to clipboard');
  };
  
  const formatLogsForExport = (logs: any) => {
    let output = `=== NEUROSYNC FORENSIC LOGS ===\n`;
    output += `Export Time: ${logs.timestamp}\n`;
    output += `Test Mode: ${logs.testMode ? 'YES' : 'NO'}\n`;
    if (logs.testSessionStartTime) {
      output += `Test Session Started: ${logs.testSessionStartTime}\n`;
    }
    output += `Critical Events: ${logs.criticalEvents}\n\n`;
    
    // Critical Events Section
    if (criticalEvents.length > 0) {
      output += `🔴 CRITICAL EVENTS (${criticalEvents.length}):\n`;
      criticalEvents.forEach((event, index) => {
        output += `${index + 1}. ${event.timestamp} - ${event.action}\n`;
        output += `   Stack: ${event.stackTrace.split('\n')[1] || 'N/A'}\n`;
      });
      output += `\n`;
    }
    
    // React Lifecycle Events
    output += `📱 REACT LIFECYCLE EVENTS (${logs.reactLifecycleEvents.length}):\n`;
    logs.reactLifecycleEvents.forEach((event: any, index: number) => {
      output += `${index + 1}. ${event.timestamp} - ${event.event}: ${event.details}\n`;
    });
    output += `\n`;
    
    // Navigation Events
    output += `🧭 NAVIGATION EVENTS (${logs.navigationEvents.length}):\n`;
    logs.navigationEvents.forEach((event: any, index: number) => {
      output += `${index + 1}. ${event.timestamp} - ${event.event}: ${event.details}\n`;
    });
    output += `\n`;
    
    // Database Access Log
    output += `💾 DATABASE ACCESS LOG (${logs.accessLog.length}):\n`;
    logs.accessLog.forEach((entry: any, index: number) => {
      const status = entry.dbIsNull ? '❌ NULL' : '✅ OK';
      const change = `${entry.dbWasNull ? 'null' : 'exists'} → ${entry.dbIsNull ? 'null' : 'exists'}`;
      output += `${index + 1}. ${entry.timestamp} ${status} - ${entry.action}\n`;
      output += `   Change: ${change}\n`;
      if (!entry.dbWasNull && entry.dbIsNull) {
        output += `   🔴 CRITICAL: Database became null!\n`;
      }
      if (entry.stackTrace) {
        const stackLine = entry.stackTrace.split('\n')[1] || 'N/A';
        output += `   Stack: ${stackLine}\n`;
      }
    });
    output += `\n`;
    
    // Current Database Health
    output += `🏥 CURRENT DATABASE HEALTH:\n`;
    output += `Status: ${logs.databaseHealth?.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}\n`;
    if (logs.databaseHealth?.issues) {
      logs.databaseHealth.issues.forEach((issue: string) => {
        output += `Issue: ${issue}\n`;
      });
    }
    
    return output;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0');
    } catch {
      return timestamp;
    }
  };

  const performDatabaseDebug = async () => {
    setLoading(true);
    console.log('DATABASE DEBUG: Starting comprehensive database debug check');
    
    const info: DatabaseDebugInfo = {
      sqliteModuleLoaded: false,
      databaseInstanceCreated: false,
      databaseConnectionOpen: false,
      databaseFilePath: '',
      canReadFromDatabase: false,
      canWriteToDatabase: false,
      initializationErrors: [],
      lastOperationAttempted: 'Starting debug check',
      fallbackMode: false,
      databaseReady: false,
      storagePermissions: false,
      writeAccess: false,
      testFileCreated: false,
      dbFileExists: false,
      dbFileSize: 0
    };

    try {
      // Check 1: Is SQLite module loaded?
      console.log('DATABASE DEBUG: STEP 1 - Checking SQLite module...');
      info.lastOperationAttempted = 'Checking SQLite module availability';
      if (SQLite && typeof SQLite.openDatabaseSync === 'function') {
        info.sqliteModuleLoaded = true;
        console.log('DATABASE DEBUG: ✓ SQLite module is loaded and available');
      } else {
        info.initializationErrors.push('SQLite module not loaded or missing openDatabaseSync function');
        console.log('DATABASE DEBUG: ✗ SQLite module not loaded properly');
      }

      // Check 2: Database file path
      console.log('DATABASE DEBUG: STEP 2 - Checking database file path...');
      info.lastOperationAttempted = 'Getting database file path';
      info.databaseFilePath = getDatabasePath();
      console.log(`DATABASE DEBUG: Database path: ${info.databaseFilePath}`);

      // Check 3: Database path and file verification
      console.log('DATABASE DEBUG: STEP 3 - Checking database path and file status...');
      info.lastOperationAttempted = 'Checking database path and file status';
      try {
        const pathCheck = await checkDatabasePath();
        info.dbFileExists = pathCheck.fileExists;
        info.dbFileSize = pathCheck.fileSize;
        info.writeAccess = pathCheck.isWritable;
        
        if (pathCheck.error) {
          info.initializationErrors.push(`Database path check: ${pathCheck.error}`);
        }
        
        console.log(`DATABASE DEBUG: Database file exists: ${info.dbFileExists}, size: ${info.dbFileSize} bytes, writable: ${info.writeAccess}`);
      } catch (error) {
        info.initializationErrors.push(`Database path check failed: ${error}`);
        console.log(`DATABASE DEBUG: ✗ Database path check failed: ${error}`);
      }

      // Check 4: Storage permissions
      console.log('DATABASE DEBUG: STEP 4 - Checking storage permissions...');
      info.lastOperationAttempted = 'Checking storage permissions';
      try {
        const permissions = await checkStoragePermissions();
        info.storagePermissions = permissions.hasPermissions;
        info.testFileCreated = permissions.canWrite;
        
        if (permissions.error) {
          info.initializationErrors.push(`Storage permissions: ${permissions.error}`);
        }
        
        console.log(`DATABASE DEBUG: Storage permissions: ${info.storagePermissions}, can write: ${info.testFileCreated}`);
      } catch (error) {
        info.initializationErrors.push(`Storage permission check failed: ${error}`);
        console.log(`DATABASE DEBUG: ✗ Storage permission check failed: ${error}`);
      }

      // Check 5: Database instance and connection
      console.log('DATABASE DEBUG: STEP 5 - Checking database instance...');
      info.lastOperationAttempted = 'Checking database instance';
      const db = getDatabase();
      info.databaseInstanceCreated = db !== null;
      
      if (db) {
        console.log('DATABASE DEBUG: ✓ Database instance exists');
        
        // Check if connection is open
        try {
          const testResult = db.getFirstSync('SELECT 1 as test');
          info.databaseConnectionOpen = (testResult as any)?.test === 1;
          console.log(`DATABASE DEBUG: Database connection test: ${info.databaseConnectionOpen ? 'PASSED' : 'FAILED'}`);
        } catch (error) {
          info.initializationErrors.push(`Database connection test failed: ${error}`);
          console.log(`DATABASE DEBUG: ✗ Database connection test failed: ${error}`);
        }
      } else {
        console.log('DATABASE DEBUG: ✗ No database instance available');
      }

      // Check 6: Read/Write capabilities
      console.log('DATABASE DEBUG: STEP 6 - Testing read/write capabilities...');
      info.lastOperationAttempted = 'Testing database read/write';
      if (db && info.databaseConnectionOpen) {
        try {
          // Test read
          const tables = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table'");
          info.canReadFromDatabase = Array.isArray(tables);
          console.log(`DATABASE DEBUG: Read test: ${info.canReadFromDatabase ? 'PASSED' : 'FAILED'}`);
          
          // Test write
          db.runSync("CREATE TABLE IF NOT EXISTS debug_test (id INTEGER, value TEXT)");
          db.runSync("INSERT OR REPLACE INTO debug_test (id, value) VALUES (1, 'test')");
          const result = db.getFirstSync("SELECT value FROM debug_test WHERE id = 1");
          info.canWriteToDatabase = (result as any)?.value === 'test';
          db.runSync("DROP TABLE debug_test");
          console.log(`DATABASE DEBUG: Write test: ${info.canWriteToDatabase ? 'PASSED' : 'FAILED'}`);
        } catch (error) {
          info.initializationErrors.push(`Database read/write test failed: ${error}`);
          console.log(`DATABASE DEBUG: ✗ Database read/write test failed: ${error}`);
        }
      }

      // Check 7: Current database status
      console.log('DATABASE DEBUG: STEP 7 - Getting current database status...');
      info.databaseReady = isDatabaseInitialized();
      info.fallbackMode = isFallbackMode();
      const status = getDatabaseStatus();
      
      if (status.error) {
        info.initializationErrors.push(status.error);
      }
      
      console.log(`DATABASE DEBUG: Database ready: ${info.databaseReady}`);
      console.log(`DATABASE DEBUG: Fallback mode: ${info.fallbackMode}`);
      
      info.lastOperationAttempted = 'Database debug check completed';
      console.log('DATABASE DEBUG: Comprehensive debug check completed');

    } catch (error) {
      info.initializationErrors.push(`Debug check failed: ${error}`);
      console.log(`DATABASE DEBUG: ✗ Debug check failed: ${error}`);
    }

    setDebugInfo(info);
    setLoading(false);
  };

  const runDatabaseTest = async (testName: string, testFunction: () => Promise<void>) => {
    console.log(`DATABASE TEST: Starting ${testName}...`);
    try {
      await testFunction();
      setTestResults(prev => ({ ...prev, [testName]: { success: true } }));
      console.log(`DATABASE TEST: ${testName} PASSED`);
      Alert.alert('Test Passed', `${testName} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setTestResults(prev => ({ ...prev, [testName]: { success: false, error: errorMessage } }));
      console.log(`DATABASE TEST: ${testName} FAILED - ${errorMessage}`);
      Alert.alert('Test Failed', `${testName} failed: ${errorMessage}`);
    }
  };

  const testDatabaseOpen = async () => {
    const db = SQLite.openDatabaseSync('test_db.db');
    const result = db.getFirstSync('SELECT 1 as test');
    if ((result as any)?.test !== 1) {
      throw new Error('Database open test failed');
    }
    await db.closeAsync();
  };

  const testCreateTable = async () => {
    const db = getDatabase();
    if (!db) throw new Error('No database instance available');
    db.runSync('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)');
    db.runSync('DROP TABLE test_table');
  };

  const testInsertRow = async () => {
    const db = getDatabase();
    if (!db) throw new Error('No database instance available');
    db.runSync('CREATE TABLE IF NOT EXISTS test_insert (id INTEGER PRIMARY KEY, value TEXT)');
    db.runSync('INSERT INTO test_insert (value) VALUES (?)', ['test_value']);
    db.runSync('DROP TABLE test_insert');
  };

  const testSelectRow = async () => {
    const db = getDatabase();
    if (!db) throw new Error('No database instance available');
    db.runSync('CREATE TABLE IF NOT EXISTS test_select (id INTEGER PRIMARY KEY, value TEXT)');
    db.runSync('INSERT INTO test_select (value) VALUES (?)', ['test_value']);
    const result = db.getFirstSync('SELECT value FROM test_select WHERE id = 1');
    if ((result as any)?.value !== 'test_value') {
      throw new Error('Select test failed - value mismatch');
    }
    db.runSync('DROP TABLE test_select');
  };

  const testUpdateRow = async () => {
    const db = getDatabase();
    if (!db) throw new Error('No database instance available');
    db.runSync('CREATE TABLE IF NOT EXISTS test_update (id INTEGER PRIMARY KEY, value TEXT)');
    db.runSync('INSERT INTO test_update (value) VALUES (?)', ['old_value']);
    db.runSync('UPDATE test_update SET value = ? WHERE id = 1', ['new_value']);
    const result = db.getFirstSync('SELECT value FROM test_update WHERE id = 1');
    if ((result as any)?.value !== 'new_value') {
      throw new Error('Update test failed - value not updated');
    }
    db.runSync('DROP TABLE test_update');
  };

  const testDeleteRow = async () => {
    const db = getDatabase();
    if (!db) throw new Error('No database instance available');
    db.runSync('CREATE TABLE IF NOT EXISTS test_delete (id INTEGER PRIMARY KEY, value TEXT)');
    db.runSync('INSERT INTO test_delete (value) VALUES (?)', ['test_value']);
    db.runSync('DELETE FROM test_delete WHERE id = 1');
    const result = db.getFirstSync('SELECT COUNT(*) as count FROM test_delete');
    if ((result as any)?.count !== 0) {
      throw new Error('Delete test failed - row not deleted');
    }
    db.runSync('DROP TABLE test_delete');
  };

  const reinitializeDatabase = async () => {
    Alert.alert(
      'Reinitialize Database',
      'This will reset the database state and attempt re-initialization with retry logic. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reinitialize',
          style: 'destructive',
          onPress: async () => {
            console.log('DATABASE DEBUG: Starting database reinitialization with retry logic...');
            setLoading(true);
            
            try {
              resetDatabaseState();
              const result = await initializeDatabaseWithRetry(3);
              
              if (result.success) {
                Alert.alert('Success', `Database reinitialized successfully on attempt ${result.attempts}`);
              } else {
                Alert.alert('Failed', `Reinitialization failed after ${result.attempts} attempts: ${result.error}`);
              }
            } catch (error) {
              Alert.alert('Error', `Reinitialization error: ${error}`);
            } finally {
              setLoading(false);
              // Refresh debug info
              await performDatabaseDebug();
            }
          }
        }
      ]
    );
  };

  const getStatusIcon = (status: boolean) => status ? '✓' : '✗';
  const getStatusColor = (status: boolean) => status ? '#00C851' : '#FF4444';

  if (loading || !debugInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading database debug info...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>Forensic Database Debug</ThemedText>
        <ThemedText style={styles.subtitle}>Complete diagnostic logging for remote testing</ThemedText>
        
        <ThemedView style={styles.headerControls}>
          <TouchableOpacity 
            onPress={() => setAutoRefresh(!autoRefresh)} 
            style={[styles.controlButton, { backgroundColor: autoRefresh ? '#34C759' : '#FF3B30' }]}
          >
            <ThemedText style={styles.controlButtonText}>
              {autoRefresh ? 'AUTO REFRESH' : 'MANUAL'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={isTestMode ? stopTestMode : startTestMode}
            style={[styles.controlButton, { backgroundColor: isTestMode ? '#FF9500' : '#007AFF' }]}
          >
            <ThemedText style={styles.controlButtonText}>
              {isTestMode ? 'STOP TEST' : 'START TEST'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={copyAllLogsToClipboard}
            style={[styles.controlButton, { backgroundColor: '#5AC8FA' }]}
          >
            <ThemedText style={styles.controlButtonText}>COPY ALL</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        
        {isTestMode && (
          <ThemedView style={styles.testModeIndicator}>
            <ThemedText style={styles.testModeText}>
              🔍 TEST MODE ACTIVE - Capturing clean logs since {testSessionStartTime ? new Date(testSessionStartTime).toLocaleTimeString() : 'now'}
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Status Overview */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Database Status</ThemedText>
          
          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>SQLite Module Loaded:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.sqliteModuleLoaded) }]}>
              {getStatusIcon(debugInfo.sqliteModuleLoaded)} {debugInfo.sqliteModuleLoaded ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Database Instance Created:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.databaseInstanceCreated) }]}>
              {getStatusIcon(debugInfo.databaseInstanceCreated)} {debugInfo.databaseInstanceCreated ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Database Connection Open:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.databaseConnectionOpen) }]}>
              {getStatusIcon(debugInfo.databaseConnectionOpen)} {debugInfo.databaseConnectionOpen ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Can Read from Database:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.canReadFromDatabase) }]}>
              {getStatusIcon(debugInfo.canReadFromDatabase)} {debugInfo.canReadFromDatabase ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Can Write to Database:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.canWriteToDatabase) }]}>
              {getStatusIcon(debugInfo.canWriteToDatabase)} {debugInfo.canWriteToDatabase ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Database Ready:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.databaseReady) }]}>
              {getStatusIcon(debugInfo.databaseReady)} {debugInfo.databaseReady ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Fallback Mode:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(!debugInfo.fallbackMode) }]}>
              {getStatusIcon(!debugInfo.fallbackMode)} {debugInfo.fallbackMode ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Database Storage Info */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Database Storage</ThemedText>
          
          <ThemedView style={styles.infoBox}>
            <ThemedText style={styles.infoBoxText}>
              ℹ️ Using platform default storage location for maximum compatibility with both Expo Go and production builds.
            </ThemedText>
          </ThemedView>
          
          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Storage Location:</ThemedText>
            <ThemedText style={styles.pathValue} numberOfLines={2}>
              {debugInfo.databaseFilePath}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Database Has Data:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.dbFileExists) }]}>
              {getStatusIcon(debugInfo.dbFileExists)} {debugInfo.dbFileExists ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          {debugInfo.dbFileSize >= 0 && (
            <ThemedView style={styles.statusItem}>
              <ThemedText style={styles.statusLabel}>Database File Size:</ThemedText>
              <ThemedText style={styles.statusValue}>
                {debugInfo.dbFileSize} bytes
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>SQLite Available:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.storagePermissions) }]}>
              {getStatusIcon(debugInfo.storagePermissions)} {debugInfo.storagePermissions ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statusItem}>
            <ThemedText style={styles.statusLabel}>Can Write to Database:</ThemedText>
            <ThemedText style={[styles.statusValue, { color: getStatusColor(debugInfo.writeAccess) }]}>
              {getStatusIcon(debugInfo.writeAccess)} {debugInfo.writeAccess ? 'Yes' : 'No'}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Errors Section */}
        {debugInfo.initializationErrors.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Initialization Errors</ThemedText>
            {debugInfo.initializationErrors.map((error, index) => (
              <ThemedView key={index} style={styles.errorItem}>
                <ThemedText style={styles.errorText}>• {error}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        )}

        {/* Last Operation */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Last Operation</ThemedText>
          <ThemedText style={styles.lastOperation}>{debugInfo.lastOperationAttempted}</ThemedText>
        </ThemedView>

        {/* Critical Events Section - Always at top if any exist */}
        {criticalEvents.length > 0 && (
          <ThemedView style={styles.criticalSection}>
            <ThemedText style={styles.criticalSectionTitle}>🔴 CRITICAL EVENTS ({criticalEvents.length})</ThemedText>
            <ThemedText style={styles.criticalSectionSubtitle}>Database became null - these events must be investigated!</ThemedText>
            
            {criticalEvents.map((event, index) => (
              <ThemedView key={index} style={styles.criticalEvent}>
                <ThemedText style={styles.criticalEventTime}>{formatTimestamp(event.timestamp)}</ThemedText>
                <ThemedText style={styles.criticalEventAction}>{event.action}</ThemedText>
                <ThemedText style={styles.criticalEventStack}>
                  Stack: {event.stackTrace.split('\n')[1] || 'N/A'}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        )}
        
        {/* Live Status Display */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>🔴 Live Status</ThemedText>
          
          <ThemedView style={styles.liveStatusGrid}>
            <ThemedView style={[styles.liveStatusCard, { backgroundColor: health?.healthy ? '#E8F5E8' : '#FFF0F0' }]}>
              <ThemedText style={[styles.liveStatusTitle, { color: health?.healthy ? '#34C759' : '#FF3B30' }]}>
                DATABASE STATE
              </ThemedText>
              <ThemedText style={[styles.liveStatusValue, { color: health?.healthy ? '#34C759' : '#FF3B30' }]}>
                {health?.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}
              </ThemedText>
            </ThemedView>
            
            <ThemedView style={styles.liveStatusCard}>
              <ThemedText style={styles.liveStatusTitle}>LAST 10 OPS</ThemedText>
              <ThemedText style={styles.liveStatusValue}>{accessLog.slice(-10).length}/10</ThemedText>
            </ThemedView>
            
            <ThemedView style={styles.liveStatusCard}>
              <ThemedText style={styles.liveStatusTitle}>CRITICAL EVENTS</ThemedText>
              <ThemedText style={[styles.liveStatusValue, { color: criticalEvents.length > 0 ? '#FF3B30' : '#34C759' }]}>
                {criticalEvents.length}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          
          {health?.issues?.map((issue: string, index: number) => (
            <ThemedText key={index} style={styles.liveStatusIssue}>🔴 {issue}</ThemedText>
          ))}
          
          {health?.details && (
            <ThemedView style={styles.healthDetails}>
              <ThemedText style={styles.healthDetailItem}>
                Has Instance: {health.details.hasInstance ? '✅' : '❌'}
              </ThemedText>
              <ThemedText style={styles.healthDetailItem}>
                Connection Test: {health.details.connectionTest ? '✅' : '❌'}
              </ThemedText>
              <ThemedText style={styles.healthDetailItem}>
                Tables Exist: {health.details.tablesExist ? '✅' : '❌'}
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>

        {/* React Lifecycle Events */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>📱 React Lifecycle Events ({reactLifecycleEvents.length})</ThemedText>
          <ScrollView style={styles.eventLogContainer} nestedScrollEnabled>
            {reactLifecycleEvents.length === 0 ? (
              <ThemedText style={styles.noLogText}>No lifecycle events</ThemedText>
            ) : (
              reactLifecycleEvents.slice().reverse().map((event, index) => (
                <ThemedView key={index} style={styles.eventEntry}>
                  <ThemedText style={styles.eventTime}>{formatTimestamp(event.timestamp)}</ThemedText>
                  <ThemedText style={styles.eventTitle}>{event.event}</ThemedText>
                  <ThemedText style={styles.eventDetails}>{event.details}</ThemedText>
                </ThemedView>
              ))
            )}
          </ScrollView>
        </ThemedView>
        
        {/* Navigation Events */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>🧭 Navigation Events ({navigationEvents.length})</ThemedText>
          <ScrollView style={styles.eventLogContainer} nestedScrollEnabled>
            {navigationEvents.length === 0 ? (
              <ThemedText style={styles.noLogText}>No navigation events</ThemedText>
            ) : (
              navigationEvents.slice().reverse().map((event, index) => (
                <ThemedView key={index} style={styles.eventEntry}>
                  <ThemedText style={styles.eventTime}>{formatTimestamp(event.timestamp)}</ThemedText>
                  <ThemedText style={styles.eventTitle}>{event.event}</ThemedText>
                  <ThemedText style={styles.eventDetails}>{event.details}</ThemedText>
                </ThemedView>
              ))
            )}
          </ScrollView>
        </ThemedView>
        
        {/* Full Database Access Log */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>💾 Database Access Log (ALL {accessLog.length} entries)</ThemedText>
            <TouchableOpacity onPress={handleClearAccessLog} style={styles.clearButton}>
              <ThemedText style={styles.clearButtonText}>Clear All</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ScrollView style={styles.fullLogContainer} nestedScrollEnabled>
            {accessLog.length === 0 ? (
              <ThemedText style={styles.noLogText}>No access log entries</ThemedText>
            ) : (
              accessLog.slice().reverse().map((entry, index) => (
                <ThemedView 
                  key={index} 
                  style={[
                    styles.logEntry,
                    entry.dbWasNull !== entry.dbIsNull ? styles.logEntryImportant : {},
                    !entry.dbWasNull && entry.dbIsNull ? styles.logEntryCritical : {}
                  ]}
                >
                  <ThemedView style={styles.logEntryHeader}>
                    <ThemedText style={styles.logTime}>
                      {formatTimestamp(entry.timestamp)}
                    </ThemedText>
                    <ThemedText style={[
                      styles.logStatus,
                      { color: entry.dbIsNull ? '#FF3B30' : '#34C759' }
                    ]}>
                      {entry.dbIsNull ? 'NULL' : 'OK'}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={styles.logAction}>{entry.action}</ThemedText>
                  <ThemedText style={styles.logChange}>
                    {entry.dbWasNull ? 'null' : 'exists'} → {entry.dbIsNull ? 'null' : 'exists'}
                  </ThemedText>
                  <ThemedText style={styles.logStack}>
                    Stack: {entry.stackTrace.split('\n')[1] || 'N/A'}
                  </ThemedText>
                  {(!entry.dbWasNull && entry.dbIsNull) && (
                    <ThemedView style={styles.criticalAlert}>
                      <ThemedText style={styles.criticalAlertText}>🔴 DATABASE BECAME NULL!</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              ))
            )}
          </ScrollView>
        </ThemedView>

        {/* Test Functions */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Database Tests</ThemedText>
          
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => runDatabaseTest('Database Open', testDatabaseOpen)}
          >
            <ThemedText style={styles.testButtonText}>Test Database Open</ThemedText>
            {testResults['Database Open'] && (
              <ThemedText style={[styles.testResult, { color: getStatusColor(testResults['Database Open'].success) }]}>
                {getStatusIcon(testResults['Database Open'].success)}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => runDatabaseTest('Create Table', testCreateTable)}
          >
            <ThemedText style={styles.testButtonText}>Test Create Table</ThemedText>
            {testResults['Create Table'] && (
              <ThemedText style={[styles.testResult, { color: getStatusColor(testResults['Create Table'].success) }]}>
                {getStatusIcon(testResults['Create Table'].success)}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => runDatabaseTest('Insert Row', testInsertRow)}
          >
            <ThemedText style={styles.testButtonText}>Test Insert Row</ThemedText>
            {testResults['Insert Row'] && (
              <ThemedText style={[styles.testResult, { color: getStatusColor(testResults['Insert Row'].success) }]}>
                {getStatusIcon(testResults['Insert Row'].success)}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => runDatabaseTest('Select Row', testSelectRow)}
          >
            <ThemedText style={styles.testButtonText}>Test Select Row</ThemedText>
            {testResults['Select Row'] && (
              <ThemedText style={[styles.testResult, { color: getStatusColor(testResults['Select Row'].success) }]}>
                {getStatusIcon(testResults['Select Row'].success)}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => runDatabaseTest('Update Row', testUpdateRow)}
          >
            <ThemedText style={styles.testButtonText}>Test Update Row</ThemedText>
            {testResults['Update Row'] && (
              <ThemedText style={[styles.testResult, { color: getStatusColor(testResults['Update Row'].success) }]}>
                {getStatusIcon(testResults['Update Row'].success)}
              </ThemedText>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testButton}
            onPress={() => runDatabaseTest('Delete Row', testDeleteRow)}
          >
            <ThemedText style={styles.testButtonText}>Test Delete Row</ThemedText>
            {testResults['Delete Row'] && (
              <ThemedText style={[styles.testResult, { color: getStatusColor(testResults['Delete Row'].success) }]}>
                {getStatusIcon(testResults['Delete Row'].success)}
              </ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>

        {/* Action Buttons */}
        <ThemedView style={styles.section}>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={copyAllLogsToClipboard}
          >
            <ThemedText style={styles.exportButtonText}>📋 Export Logs as Text</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={performDatabaseDebug}
          >
            <ThemedText style={styles.refreshButtonText}>Refresh Debug Info</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reinitButton}
            onPress={reinitializeDatabase}
          >
            <ThemedText style={styles.reinitButtonText}>Reinitialize Database</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={styles.bottomSpacer} />
      </ScrollView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Back to Settings</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  section: {
    marginTop: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  statusLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  pathValue: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  infoBoxText: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  errorItem: {
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4444',
    lineHeight: 20,
  },
  lastOperation: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
  },
  testButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  testResult: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  reinitButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  reinitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 20,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  backButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  headerControls: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  controlButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  testModeIndicator: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFEAA7',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  testModeText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  criticalSection: {
    marginTop: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  criticalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF3B30',
    marginBottom: 4,
  },
  criticalSectionSubtitle: {
    fontSize: 14,
    color: '#D32F2F',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  criticalEvent: {
    backgroundColor: '#FFCDD2',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  criticalEventTime: {
    fontSize: 10,
    color: '#B71C1C',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  criticalEventAction: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '600',
    marginVertical: 2,
  },
  criticalEventStack: {
    fontSize: 10,
    color: '#757575',
    fontFamily: 'monospace',
  },
  liveStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  liveStatusCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  liveStatusTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  liveStatusValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  liveStatusIssue: {
    fontSize: 12,
    color: '#FF3B30',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  eventLogContainer: {
    maxHeight: 200,
  },
  eventEntry: {
    backgroundColor: '#F9F9F9',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  eventTime: {
    fontSize: 9,
    color: '#666',
    fontFamily: 'monospace',
  },
  eventTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginVertical: 2,
  },
  eventDetails: {
    fontSize: 10,
    color: '#666',
  },
  fullLogContainer: {
    maxHeight: 500,
  },
  logStack: {
    fontSize: 9,
    color: '#999',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  exportButton: {
    backgroundColor: '#5AC8FA',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  healthCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    marginBottom: 12,
  },
  healthStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  issue: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 4,
  },
  healthDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthDetailItem: {
    fontSize: 12,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: '30%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  logContainer: {
    maxHeight: 300,
  },
  noLogText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    padding: 20,
  },
  logEntry: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  logEntryImportant: {
    borderColor: '#FF9500',
    borderWidth: 2,
  },
  logEntryCritical: {
    borderColor: '#FF3B30',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  logEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 10,
    color: '#8E8E93',
    fontFamily: 'monospace',
  },
  logStatus: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  logAction: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  logChange: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  criticalAlert: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
  },
  criticalAlertText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});