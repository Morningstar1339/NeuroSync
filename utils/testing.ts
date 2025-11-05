import { openDatabase } from '@/database/database';
import { generateTestData, clearTestData, getDatabaseStats } from '@/database/performance';

export interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

export interface TestSuite {
  suiteName: string;
  results: TestResult[];
  passed: boolean;
  totalTime: number;
}

// Test database operations
export const testDatabaseOperations = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  // Test database connection
  try {
    const db = await openDatabase();
    results.push({ testName: 'Database Connection', passed: true });
  } catch (error) {
    results.push({ 
      testName: 'Database Connection', 
      passed: false, 
      error: error.message 
    });
  }

  // Test data insertion and retrieval
  try {
    const db = await openDatabase();
    
    // Test supplement creation
    const supplementResult = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      ['Test Supplement', 100, 'mg']
    );
    
    const supplementId = supplementResult.lastInsertRowId;
    
    // Test supplement retrieval
    const supplements = await db.getAllAsync('SELECT * FROM supplements WHERE id = ?', [supplementId]);
    
    if (supplements.length === 1) {
      results.push({ testName: 'Supplement CRUD Operations', passed: true });
    } else {
      results.push({ 
        testName: 'Supplement CRUD Operations', 
        passed: false, 
        error: 'Failed to retrieve inserted supplement' 
      });
    }
    
    // Clean up test data
    await db.runAsync('DELETE FROM supplements WHERE id = ?', [supplementId]);
    
  } catch (error) {
    results.push({ 
      testName: 'Supplement CRUD Operations', 
      passed: false, 
      error: error.message 
    });
  }

  // Test foreign key constraints
  try {
    const db = await openDatabase();
    
    try {
      // This should fail due to foreign key constraint
      await db.runAsync(
        'INSERT INTO supplement_logs (supplement_id, timestamp, dosage) VALUES (?, ?, ?)',
        [99999, Math.floor(Date.now() / 1000), 100]
      );
      
      results.push({ 
        testName: 'Foreign Key Constraints', 
        passed: false, 
        error: 'Foreign key constraint not enforced' 
      });
    } catch (error) {
      // This is expected to fail
      results.push({ testName: 'Foreign Key Constraints', passed: true });
    }
    
  } catch (error) {
    results.push({ 
      testName: 'Foreign Key Constraints', 
      passed: false, 
      error: error.message 
    });
  }

  const endTime = Date.now();
  const passed = results.every(r => r.passed);
  
  return {
    suiteName: 'Database Operations',
    results,
    passed,
    totalTime: endTime - startTime
  };
};

// Test data validation and edge cases
export const testDataValidation = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  // Test empty string handling
  try {
    const db = await openDatabase();
    
    try {
      await db.runAsync(
        'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
        ['', 100, 'mg']
      );
      results.push({ 
        testName: 'Empty String Validation', 
        passed: false, 
        error: 'Empty string allowed in name field' 
      });
    } catch (error) {
      // Expected to fail
      results.push({ testName: 'Empty String Validation', passed: true });
    }
  } catch (error) {
    results.push({ 
      testName: 'Empty String Validation', 
      passed: false, 
      error: error.message 
    });
  }

  // Test negative values
  try {
    const db = await openDatabase();
    
    const result = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      ['Test Negative', -100, 'mg']
    );
    
    // Clean up
    await db.runAsync('DELETE FROM supplements WHERE id = ?', [result.lastInsertRowId]);
    
    results.push({ testName: 'Negative Value Handling', passed: true });
  } catch (error) {
    results.push({ 
      testName: 'Negative Value Handling', 
      passed: false, 
      error: error.message 
    });
  }

  // Test very long strings
  try {
    const longString = 'A'.repeat(1000);
    const db = await openDatabase();
    
    const result = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      [longString, 100, 'mg']
    );
    
    // Clean up
    await db.runAsync('DELETE FROM supplements WHERE id = ?', [result.lastInsertRowId]);
    
    results.push({ testName: 'Long String Handling', passed: true });
  } catch (error) {
    results.push({ 
      testName: 'Long String Handling', 
      passed: false, 
      error: error.message 
    });
  }

  // Test special characters
  try {
    const specialString = "Test's \"Special\" Characters & <symbols>";
    const db = await openDatabase();
    
    const result = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      [specialString, 100, 'mg']
    );
    
    const retrieved = await db.getAllAsync('SELECT * FROM supplements WHERE id = ?', [result.lastInsertRowId]);
    
    if (retrieved.length === 1 && (retrieved[0] as any).name === specialString) {
      results.push({ testName: 'Special Character Handling', passed: true });
    } else {
      results.push({ 
        testName: 'Special Character Handling', 
        passed: false, 
        error: 'Special characters not preserved' 
      });
    }
    
    // Clean up
    await db.runAsync('DELETE FROM supplements WHERE id = ?', [result.lastInsertRowId]);
  } catch (error) {
    results.push({ 
      testName: 'Special Character Handling', 
      passed: false, 
      error: error.message 
    });
  }

  const endTime = Date.now();
  const passed = results.every(r => r.passed);
  
  return {
    suiteName: 'Data Validation',
    results,
    passed,
    totalTime: endTime - startTime
  };
};

// Test performance with large datasets
export const testPerformanceWithLargeData = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  try {
    // Generate test data
    console.log('Generating test data...');
    await generateTestData(50, 50); // 50 supplements with 50 logs each = 2500 records
    
    results.push({ testName: 'Test Data Generation', passed: true });
    
    // Test query performance
    const db = await openDatabase();
    
    // Test supplement list query
    const supplementQueryStart = Date.now();
    const supplements = await db.getAllAsync('SELECT * FROM supplements ORDER BY name');
    const supplementQueryTime = Date.now() - supplementQueryStart;
    
    results.push({ 
      testName: 'Supplement List Query', 
      passed: supplementQueryTime < 50,
      duration: supplementQueryTime
    });
    
    // Test recent logs query
    const logsQueryStart = Date.now();
    const recentLogs = await db.getAllAsync(`
      SELECT sl.*, s.name as supplement_name 
      FROM supplement_logs sl 
      JOIN supplements s ON sl.supplement_id = s.id 
      ORDER BY sl.timestamp DESC 
      LIMIT 100
    `);
    const logsQueryTime = Date.now() - logsQueryStart;
    
    results.push({ 
      testName: 'Recent Logs Query', 
      passed: logsQueryTime < 50,
      duration: logsQueryTime
    });
    
    // Test complex export query
    const exportQueryStart = Date.now();
    const exportData = await db.getAllAsync(`
      SELECT 
        ctr.id,
        ctr.test_type,
        ctr.timestamp,
        ctr.score,
        sp.supplement_id,
        s.name as supplement_name
      FROM cognitive_test_results ctr
      LEFT JOIN study_protocols sp ON ctr.study_id = sp.id
      LEFT JOIN supplements s ON sp.supplement_id = s.id
      ORDER BY ctr.timestamp DESC
      LIMIT 100
    `);
    const exportQueryTime = Date.now() - exportQueryStart;
    
    results.push({ 
      testName: 'Complex Export Query', 
      passed: exportQueryTime < 50,
      duration: exportQueryTime
    });
    
    // Get database stats
    const stats = await getDatabaseStats();
    console.log('Database Stats:', stats);
    
    results.push({ 
      testName: 'Database Statistics', 
      passed: true,
      error: `Size: ${stats.estimated_size_mb}MB, Records: ${stats.supplement_logs + stats.cognitive_test_results + stats.symptom_logs}`
    });
    
  } catch (error) {
    results.push({ 
      testName: 'Performance Test Setup', 
      passed: false, 
      error: error.message 
    });
  } finally {
    // Clean up test data
    try {
      await clearTestData();
      results.push({ testName: 'Test Data Cleanup', passed: true });
    } catch (error) {
      results.push({ 
        testName: 'Test Data Cleanup', 
        passed: false, 
        error: error.message 
      });
    }
  }

  const endTime = Date.now();
  const passed = results.every(r => r.passed);
  
  return {
    suiteName: 'Performance with Large Data',
    results,
    passed,
    totalTime: endTime - startTime
  };
};

// Test error handling and recovery
export const testErrorHandling = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  // Test handling of corrupted data
  try {
    const db = await openDatabase();
    
    // Insert invalid JSON in parameters field
    const result = await db.runAsync(
      'INSERT INTO exclusions (supplement_id, exclusion_type, parameters) VALUES (?, ?, ?)',
      [1, 'time_window', 'invalid json']
    );
    
    // Try to parse the invalid JSON (this should be handled gracefully)
    try {
      const exclusion = await db.getAllAsync('SELECT * FROM exclusions WHERE id = ?', [result.lastInsertRowId]);
      JSON.parse((exclusion[0] as any).parameters);
      
      results.push({ 
        testName: 'Invalid JSON Handling', 
        passed: false, 
        error: 'Invalid JSON was parsed successfully' 
      });
    } catch (parseError) {
      // Expected to fail
      results.push({ testName: 'Invalid JSON Handling', passed: true });
    }
    
    // Clean up
    await db.runAsync('DELETE FROM exclusions WHERE id = ?', [result.lastInsertRowId]);
    
  } catch (error) {
    results.push({ 
      testName: 'Invalid JSON Handling', 
      passed: false, 
      error: error.message 
    });
  }

  // Test timestamp edge cases
  try {
    const db = await openDatabase();
    
    // Test with very old timestamp
    const oldTimestamp = 0; // Unix epoch
    const result1 = await db.runAsync(
      'INSERT INTO supplement_logs (supplement_id, timestamp, dosage) VALUES (?, ?, ?)',
      [1, oldTimestamp, 100]
    );
    
    // Test with future timestamp
    const futureTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year in future
    const result2 = await db.runAsync(
      'INSERT INTO supplement_logs (supplement_id, timestamp, dosage) VALUES (?, ?, ?)',
      [1, futureTimestamp, 100]
    );
    
    results.push({ testName: 'Timestamp Edge Cases', passed: true });
    
    // Clean up
    await db.runAsync('DELETE FROM supplement_logs WHERE id IN (?, ?)', [result1.lastInsertRowId, result2.lastInsertRowId]);
    
  } catch (error) {
    results.push({ 
      testName: 'Timestamp Edge Cases', 
      passed: false, 
      error: error.message 
    });
  }

  const endTime = Date.now();
  const passed = results.every(r => r.passed);
  
  return {
    suiteName: 'Error Handling',
    results,
    passed,
    totalTime: endTime - startTime
  };
};

// Run all test suites
export const runAllTests = async (): Promise<TestSuite[]> => {
  console.log('Starting comprehensive test suite...');
  
  const testSuites: TestSuite[] = [];
  
  try {
    testSuites.push(await testDatabaseOperations());
    testSuites.push(await testDataValidation());
    testSuites.push(await testErrorHandling());
    testSuites.push(await testPerformanceWithLargeData());
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  const overallPassed = testSuites.every(suite => suite.passed);
  const totalTime = testSuites.reduce((sum, suite) => sum + suite.totalTime, 0);
  
  console.log(`\n=== Test Results ===`);
  console.log(`Overall: ${overallPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Test Suites: ${testSuites.length}`);
  
  testSuites.forEach(suite => {
    console.log(`\n${suite.suiteName}: ${suite.passed ? 'PASSED' : 'FAILED'} (${suite.totalTime}ms)`);
    suite.results.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      const error = result.error ? ` - ${result.error}` : '';
      console.log(`  ${status} ${result.testName}${duration}${error}`);
    });
  });
  
  return testSuites;
};

// Quick health check function
export const healthCheck = async (): Promise<{healthy: boolean, issues: string[]}> => {
  const issues: string[] = [];
  
  try {
    // Check database connection
    const db = await openDatabase();
    
    // Check if all tables exist
    const tables = ['supplements', 'supplement_logs', 'symptoms', 'symptom_logs', 
                   'cognitive_test_results', 'sleep_logs', 'schedules', 'exclusions', 
                   'study_protocols', 'scheduled_tests'];
    
    for (const table of tables) {
      try {
        await db.getAllAsync(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
      } catch (error) {
        issues.push(`Table ${table} is missing or inaccessible`);
      }
    }
    
    // Check if indexes exist
    const indexes = await db.getAllAsync(`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' AND sql IS NOT NULL
    `);
    
    if (indexes.length < 10) {
      issues.push(`Only ${indexes.length} indexes found, expected at least 10`);
    }
    
    // Check foreign keys are enabled
    const foreignKeys = await db.getAllAsync('PRAGMA foreign_keys');
    if (!(foreignKeys[0] as any).foreign_keys) {
      issues.push('Foreign keys are not enabled');
    }
    
  } catch (error) {
    issues.push(`Database connection failed: ${error.message}`);
  }
  
  return {
    healthy: issues.length === 0,
    issues
  };
};