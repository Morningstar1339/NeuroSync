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

// Convenience helper for error messages
const getErrorMessage = (error: any): string =>
  error && typeof error.message === 'string' ? error.message : String(error);

// 1. Basic DB operations
export const testDatabaseOperations = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();

  // 1.1 Connection
  try {
    const db = await openDatabase();
    await db.getAllAsync('SELECT 1');
    results.push({ testName: 'Database Connection', passed: true });
  } catch (error: any) {
    results.push({
      testName: 'Database Connection',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  // 1.2 Simple CRUD on supplements
  try {
    const db = await openDatabase();

    const insertResult = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      ['Test Supplement', 100, 'mg']
    );

    const supplementId = insertResult.lastInsertRowId;

    const rows = await db.getAllAsync(
      'SELECT * FROM supplements WHERE id = ?',
      [supplementId]
    );

    if (rows.length === 1) {
      results.push({
        testName: 'Supplement CRUD Operations',
        passed: true,
      });
    } else {
      results.push({
        testName: 'Supplement CRUD Operations',
        passed: false,
        error: 'Failed to retrieve inserted supplement',
      });
    }

    await db.runAsync('DELETE FROM supplements WHERE id = ?', [supplementId]);
  } catch (error: any) {
    results.push({
      testName: 'Supplement CRUD Operations',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  const endTime = Date.now();
  const passed = results.every((r) => r.passed);

  return {
    suiteName: 'Database Operations',
    results,
    passed,
    totalTime: endTime - startTime,
  };
};

// 2. Data validation / edge cases
export const testDataValidation = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();

  // 2.1 Empty string handling
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
        error: 'Empty string allowed in name field',
      });
    } catch (_inner: any) {
      // Expected to fail
      results.push({
        testName: 'Empty String Validation',
        passed: true,
      });
    }
  } catch (error: any) {
    results.push({
      testName: 'Empty String Validation',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  // 2.2 Negative values (we just check that DB can handle it at all)
  try {
    const db = await openDatabase();

    const insertResult = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      ['Test Negative', -100, 'mg']
    );

    await db.runAsync('DELETE FROM supplements WHERE id = ?', [
      insertResult.lastInsertRowId,
    ]);

    results.push({
      testName: 'Negative Value Handling',
      passed: true,
    });
  } catch (error: any) {
    results.push({
      testName: 'Negative Value Handling',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  // 2.3 Long strings
  try {
    const db = await openDatabase();
    const longString = 'A'.repeat(1000);

    const insertResult = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      [longString, 100, 'mg']
    );

    await db.runAsync('DELETE FROM supplements WHERE id = ?', [
      insertResult.lastInsertRowId,
    ]);

    results.push({
      testName: 'Long String Handling',
      passed: true,
    });
  } catch (error: any) {
    results.push({
      testName: 'Long String Handling',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  // 2.4 Special characters
  try {
    const db = await openDatabase();
    const specialString = `Test's "Special" Characters & <symbols>`;

    const insertResult = await db.runAsync(
      'INSERT INTO supplements (name, default_dosage, dosage_unit) VALUES (?, ?, ?)',
      [specialString, 100, 'mg']
    );

    const retrieved = await db.getAllAsync(
      'SELECT * FROM supplements WHERE id = ?',
      [insertResult.lastInsertRowId]
    );

    if (
      retrieved.length === 1 &&
      (retrieved[0] as any).name === specialString
    ) {
      results.push({
        testName: 'Special Character Handling',
        passed: true,
      });
    } else {
      results.push({
        testName: 'Special Character Handling',
        passed: false,
        error: 'Special characters not preserved',
      });
    }

    await db.runAsync('DELETE FROM supplements WHERE id = ?', [
      insertResult.lastInsertRowId,
    ]);
  } catch (error: any) {
    results.push({
      testName: 'Special Character Handling',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  const endTime = Date.now();
  const passed = results.every((r) => r.passed);

  return {
    suiteName: 'Data Validation',
    results,
    passed,
    totalTime: endTime - startTime,
  };
};

// 3. Performance with larger datasets
export const testPerformanceWithLargeData = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    // 3.1 Generate data
    await generateTestData(50, 50);
    results.push({
      testName: 'Test Data Generation',
      passed: true,
    });

    const db = await openDatabase();

    // 3.2 Supplement list query
    const supplementQueryStart = Date.now();
    await db.getAllAsync('SELECT * FROM supplements ORDER BY name');
    const supplementQueryTime = Date.now() - supplementQueryStart;

    results.push({
      testName: 'Supplement List Query',
      passed: supplementQueryTime < 200,
      duration: supplementQueryTime,
    });

    // 3.3 Recent logs query
    const logsQueryStart = Date.now();
    await db.getAllAsync(`
      SELECT sl.*, s.name as supplement_name
      FROM supplement_logs sl
      JOIN supplements s ON sl.supplement_id = s.id
      ORDER BY sl.timestamp DESC
      LIMIT 100
    `);
    const logsQueryTime = Date.now() - logsQueryStart;

    results.push({
      testName: 'Recent Logs Query',
      passed: logsQueryTime < 200,
      duration: logsQueryTime,
    });

    // 3.4 Complex export query
    const exportQueryStart = Date.now();
    await db.getAllAsync(`
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
      passed: exportQueryTime < 200,
      duration: exportQueryTime,
    });

    // 3.5 Stats
    const stats = await getDatabaseStats();
    results.push({
      testName: 'Database Statistics',
      passed: true,
      error: `Size: ${stats.estimated_size_mb}MB, Records: ${
        stats.supplement_logs +
        stats.cognitive_test_results +
        stats.symptom_logs
      }`,
    });
  } catch (error: any) {
    results.push({
      testName: 'Performance Test Setup',
      passed: false,
      error: getErrorMessage(error),
    });
  } finally {
    try {
      await clearTestData();
      results.push({
        testName: 'Test Data Cleanup',
        passed: true,
      });
    } catch (error: any) {
      results.push({
        testName: 'Test Data Cleanup',
        passed: false,
        error: getErrorMessage(error),
      });
    }
  }

  const endTime = Date.now();
  const passed = results.every((r) => r.passed);

  return {
    suiteName: 'Performance with Large Data',
    results,
    passed,
    totalTime: endTime - startTime,
  };
};

// 4. Error handling / recovery
export const testErrorHandling = async (): Promise<TestSuite> => {
  const results: TestResult[] = [];
  const startTime = Date.now();

  // 4.1 Invalid JSON in exclusions.parameters
  try {
    const db = await openDatabase();

    const insertResult = await db.runAsync(
      'INSERT INTO exclusions (supplement_id, exclusion_type, parameters) VALUES (?, ?, ?)',
      [1, 'time_window', 'invalid json']
    );

    try {
      const exclusion = await db.getAllAsync(
        'SELECT * FROM exclusions WHERE id = ?',
        [insertResult.lastInsertRowId]
      );
      JSON.parse((exclusion[0] as any).parameters);

      results.push({
        testName: 'Invalid JSON Handling',
        passed: false,
        error: 'Invalid JSON was parsed successfully',
      });
    } catch (_parseError: any) {
      // Expected failure
      results.push({
        testName: 'Invalid JSON Handling',
        passed: true,
      });
    }

    await db.runAsync('DELETE FROM exclusions WHERE id = ?', [
      insertResult.lastInsertRowId,
    ]);
  } catch (error: any) {
    results.push({
      testName: 'Invalid JSON Handling',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  // 4.2 Timestamp edge cases
  try {
    const db = await openDatabase();

    const oldTimestamp = 0;
    const result1 = await db.runAsync(
      'INSERT INTO supplement_logs (supplement_id, timestamp, dosage) VALUES (?, ?, ?)',
      [1, oldTimestamp, 100]
    );

    const futureTimestamp =
      Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    const result2 = await db.runAsync(
      'INSERT INTO supplement_logs (supplement_id, timestamp, dosage) VALUES (?, ?, ?)',
      [1, futureTimestamp, 100]
    );

    results.push({
      testName: 'Timestamp Edge Cases',
      passed: true,
    });

    await db.runAsync(
      'DELETE FROM supplement_logs WHERE id IN (?, ?)',
      [result1.lastInsertRowId, result2.lastInsertRowId]
    );
  } catch (error: any) {
    results.push({
      testName: 'Timestamp Edge Cases',
      passed: false,
      error: getErrorMessage(error),
    });
  }

  const endTime = Date.now();
  const passed = results.every((r) => r.passed);

  return {
    suiteName: 'Error Handling',
    results,
    passed,
    totalTime: endTime - startTime,
  };
};

// 5. Run all suites
export const runAllTests = async (): Promise<TestSuite[]> => {
  const suites: TestSuite[] = [];

  suites.push(await testDatabaseOperations());
  suites.push(await testDataValidation());
  suites.push(await testErrorHandling());
  suites.push(await testPerformanceWithLargeData());

  return suites;
};

// 6. Quick health check
export const healthCheck = async (): Promise<{ healthy: boolean; issues: string[] }> => {
  const issues: string[] = [];

  try {
    const db = await openDatabase();

    // Simple connectivity check
    await db.getAllAsync('SELECT 1');

    // Check that some core tables exist
    const tables = [
      'supplements',
      'supplement_logs',
      'symptoms',
      'symptom_logs',
      'cognitive_test_results',
      'sleep_logs',
    ];

    for (const table of tables) {
      try {
        await db.getAllAsync(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
      } catch (_tableError: any) {
        issues.push(`Table ${table} is missing or inaccessible`);
      }
    }
  } catch (error: any) {
    issues.push(`Database connection failed: ${getErrorMessage(error)}`);
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
};
