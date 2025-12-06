import { openDatabase } from './database';

export interface QueryPerformanceResult {
  query: string;
  executionTime: number;
  recordCount: number;
  isOptimal: boolean;
}

// Utility to measure query execution time
const measureQueryTime = async (query: string, params: any[] = []): Promise<QueryPerformanceResult> => {
  const db = await openDatabase();
  const startTime = performance.now();
  
  const result = await db.getAllAsync(query, params);
  
  const endTime = performance.now();
  const executionTime = endTime - startTime;
  
  return {
    query: query.replace(/\s+/g, ' ').trim(),
    executionTime,
    recordCount: result.length,
    isOptimal: executionTime < 50 // Target: under 50ms as per spec
  };
};

// Test critical queries used in the app
export const auditDatabasePerformance = async (): Promise<QueryPerformanceResult[]> => {
  const results: QueryPerformanceResult[] = [];
  
  // Critical queries from supplement list
  results.push(await measureQueryTime(
    'SELECT * FROM supplements ORDER BY name'
  ));
  
  // Recent supplement logs for dashboard
  results.push(await measureQueryTime(
    `SELECT sl.*, s.name as supplement_name 
     FROM supplement_logs sl 
     JOIN supplements s ON sl.supplement_id = s.id 
     ORDER BY sl.timestamp DESC 
     LIMIT 50`
  ));
  
  // Exclusion checking query
  results.push(await measureQueryTime(
    `SELECT * FROM exclusions WHERE supplement_id = ?`,
    [1] // Test with supplement ID 1
  ));
  
  // Study protocol lookup
  results.push(await measureQueryTime(
    `SELECT * FROM study_protocols WHERE supplement_id = ? AND schedule_type = ?`,
    [1, 'event_based']
  ));
  
  // Scheduled tests lookup
  results.push(await measureQueryTime(
    `SELECT * FROM scheduled_tests 
     WHERE scheduled_time BETWEEN ? AND ? AND completed = 0 
     ORDER BY scheduled_time ASC`,
    [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 3600]
  ));
  
  // Recent cognitive test results
  results.push(await measureQueryTime(
    `SELECT * FROM cognitive_test_results 
     ORDER BY timestamp DESC 
     LIMIT 50`
  ));
  
  // Sleep logs for recent period
  results.push(await measureQueryTime(
    `SELECT * FROM sleep_logs 
     WHERE sleep_start > ? 
     ORDER BY sleep_start DESC 
     LIMIT 30`,
    [Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60)] // Last 30 days
  ));
  
  // Complex join for export functionality
  results.push(await measureQueryTime(
    `SELECT 
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
     LIMIT 100`
  ));
  
  // Symptom logs with joins
  results.push(await measureQueryTime(
    `SELECT 
       sl.id,
       s.body_region,
       s.description as symptom_description,
       sl.timestamp,
       sl.severity,
       sl.notes
     FROM symptom_logs sl
     JOIN symptoms s ON sl.symptom_id = s.id
     ORDER BY sl.timestamp DESC
     LIMIT 50`
  ));
  
  return results;
};

// Generate test data for performance testing
export const generateTestData = async (supplementCount: number = 10, logsPerSupplement: number = 20): Promise<void> => {
  const db = await openDatabase();
  
  console.log(`Generating ${supplementCount} supplements with ${logsPerSupplement} logs each...`);
  
  // Create test supplements
  const supplementNames = [
    'Omega-3', 'Vitamin D3', 'Magnesium', 'B-Complex', 'Zinc', 
    'Iron', 'Calcium', 'Vitamin C', 'CoQ10', 'Probiotics',
    'Melatonin', 'Creatine', 'L-Theanine', 'Rhodiola', 'Ashwagandha',
    'Bacopa Monnieri', 'Lion\'s Mane', 'Turmeric', 'Fish Oil', 'Multivitamin'
  ];
  
  for (let i = 0; i < supplementCount; i++) {
    const name = supplementNames[i] || `Test Supplement ${i + 1}`;
    
    try {
      const result = await db.runAsync(
        'INSERT INTO supplements (name, default_dosage, dosage_unit, icon_id, schedule_enabled, study_enabled) VALUES (?, ?, ?, ?, ?, ?)',
        [name, 100 + (i * 50), 'mg', 'medical', i % 2 === 0 ? 1 : 0, i % 3 === 0 ? 1 : 0]
      );
      
      const supplementId = result.lastInsertRowId;
      
      // Generate logs for this supplement
      for (let j = 0; j < logsPerSupplement; j++) {
        const daysAgo = Math.floor(Math.random() * 30); // Last 30 days
        const timestamp = Math.floor(Date.now() / 1000) - (daysAgo * 24 * 60 * 60) - (Math.random() * 24 * 60 * 60);
        const dosage = 100 + (Math.random() * 200);
        
        await db.runAsync(
          'INSERT INTO supplement_logs (supplement_id, timestamp, dosage) VALUES (?, ?, ?)',
          [supplementId, timestamp, dosage]
        );
      }
      
      // Add some exclusions and study protocols
      if (i % 3 === 0) {
        await db.runAsync(
          'INSERT INTO exclusions (supplement_id, exclusion_type, parameters) VALUES (?, ?, ?)',
          [supplementId, 'time_window', JSON.stringify({ startTime: '22:00', endTime: '06:00' })]
        );
      }
      
      if (i % 4 === 0) {
        await db.runAsync(
          'INSERT INTO study_protocols (supplement_id, test_type, interval_minutes, duration_minutes, schedule_type) VALUES (?, ?, ?, ?, ?)',
          [supplementId, 'memory', 60, 240, 'event_based']
        );
      }
      
    } catch (error) {
  if (error instanceof Error) {
    if (!error.message.includes('UNIQUE constraint failed')) {
      // ...
    }
  } else {
    console.error('Unknown error in performance handler:', error);
  }
}

  }
  
  // Generate some cognitive test results
  const testTypes = ['reflexes', 'memory', 'judgment'];
  for (let i = 0; i < 100; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const timestamp = Math.floor(Date.now() / 1000) - (daysAgo * 24 * 60 * 60) - (Math.random() * 24 * 60 * 60);
    const testType = testTypes[Math.floor(Math.random() * testTypes.length)];
    const score = Math.floor(Math.random() * 100) + 1;
    
    await db.runAsync(
      'INSERT INTO cognitive_test_results (test_type, timestamp, score) VALUES (?, ?, ?)',
      [testType, timestamp, score]
    );
  }
  
  // Generate some symptoms and symptom logs
  const bodyRegions = ['head', 'thorax', 'abdomen', 'arms', 'legs'];
  const symptomTypes = ['pain', 'fatigue', 'tension', 'discomfort', 'stiffness'];
  
  for (let i = 0; i < 20; i++) {
    const region = bodyRegions[Math.floor(Math.random() * bodyRegions.length)];
    const symptom = symptomTypes[Math.floor(Math.random() * symptomTypes.length)];
    const description = `${symptom} in ${region}`;
    
    try {
      const result = await db.runAsync(
        'INSERT INTO symptoms (body_region, description, last_used) VALUES (?, ?, ?)',
        [region, description, Math.floor(Date.now() / 1000)]
      );
      
      const symptomId = result.lastInsertRowId;
      
      // Generate some logs for this symptom
      for (let j = 0; j < 5; j++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const timestamp = Math.floor(Date.now() / 1000) - (daysAgo * 24 * 60 * 60);
        const severity = Math.floor(Math.random() * 5) + 1;
        
        await db.runAsync(
          'INSERT INTO symptom_logs (symptom_id, timestamp, severity) VALUES (?, ?, ?)',
          [symptomId, timestamp, severity]
        );
      }
    } catch (error) {
  if (error instanceof Error) {
    if (!error.message.includes('UNIQUE constraint failed')) {
      // ...
    }
  } else {
    console.error('Unknown error in performance handler:', error);
  }
}

  }
  
  console.log('Test data generation complete!');
};

// Clean up test data
export const clearTestData = async (): Promise<void> => {
  const db = await openDatabase();
  
  // Clear all tables (be careful - this removes all data!)
  await db.execAsync(`
    DELETE FROM scheduled_tests;
    DELETE FROM symptom_logs;
    DELETE FROM supplement_logs;
    DELETE FROM cognitive_test_results;
    DELETE FROM sleep_logs;
    DELETE FROM exclusions;
    DELETE FROM study_protocols;
    DELETE FROM schedules;
    DELETE FROM symptoms;
    DELETE FROM supplements;
  `);
  
  console.log('All test data cleared!');
};

// Optimize database by running ANALYZE and VACUUM
export const optimizeDatabase = async (): Promise<void> => {
  const db = await openDatabase();
  
  console.log('Optimizing database...');
  
  // Update statistics for query planner
  await db.execAsync('ANALYZE');
  
  // Defragment and reclaim space
  await db.execAsync('VACUUM');
  
  console.log('Database optimization complete!');
};

// Check if all indexes are properly created
export const verifyIndexes = async (): Promise<string[]> => {
  const db = await openDatabase();
  
  const indexes = await db.getAllAsync(`
    SELECT name, tbl_name, sql 
    FROM sqlite_master 
    WHERE type = 'index' AND sql IS NOT NULL
    ORDER BY tbl_name, name
  `);
  
  return indexes.map((idx: any) => `${idx.tbl_name}.${idx.name}: ${idx.sql}`);
};

// Get database size and table statistics
export const getDatabaseStats = async (): Promise<{[key: string]: any}> => {
  const db = await openDatabase();
  
  const stats: {[key: string]: any} = {};
  
  // Get table row counts
  const tables = ['supplements', 'supplement_logs', 'symptoms', 'symptom_logs', 
                 'cognitive_test_results', 'sleep_logs', 'schedules', 'exclusions', 
                 'study_protocols', 'scheduled_tests'];
  
  for (const table of tables) {
    const result = await db.getAllAsync(`SELECT COUNT(*) as count FROM ${table}`);
    stats[table] = (result[0] as any).count;
  }
  
  // Get database page count and size
  const pageCount = await db.getAllAsync('PRAGMA page_count');
  const pageSize = await db.getAllAsync('PRAGMA page_size');
  
  stats.database_pages = (pageCount[0] as any).page_count;
  stats.page_size_bytes = (pageSize[0] as any).page_size;
  stats.estimated_size_mb = ((stats.database_pages * stats.page_size_bytes) / (1024 * 1024)).toFixed(2);
  
  return stats;
};