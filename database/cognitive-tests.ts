import { withDatabase, getFallbackData, addFallbackData } from './database';

export interface CognitiveTestResult {
  id: number;
  test_type: 'reflexes' | 'memory' | 'judgment' | 'rock_dodger' | 'pattern_matcher' | 'melody_repeater' | 'tile_puzzle' | 'trail_maker' | 'n_back';
  timestamp: number;
  score: number;
  raw_data?: string;
  completion_time?: number;
  study_id?: number;
  supplement_log_id?: number;
}

export const saveCognitiveTestResult = async (
  testType: 'reflexes' | 'memory' | 'judgment' | 'rock_dodger' | 'pattern_matcher' | 'melody_repeater' | 'tile_puzzle' | 'trail_maker' | 'n_back',
  score: number,
  rawData?: any,
  completionTime?: number,
  studyId?: number,
  supplementLogId?: number
): Promise<number> => {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return await withDatabase(
    async (db) => {
      const result = await db.runAsync(
        'INSERT INTO cognitive_test_results (test_type, timestamp, score, raw_data, completion_time, study_id, supplement_log_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          testType,
          timestamp,
          score,
          rawData ? JSON.stringify(rawData) : null,
          completionTime || null,
          studyId || null,
          supplementLogId || null
        ]
      );
      return result.lastInsertRowId;
    },
    'saveCognitiveTestResult',
    async () => {
      // Fallback mode
      return addFallbackData('cognitive_test_results', {
        test_type: testType,
        timestamp,
        score,
        raw_data: rawData ? JSON.stringify(rawData) : null,
        completion_time: completionTime || null,
        study_id: studyId || null,
        supplement_log_id: supplementLogId || null
      });
    }
  );
};

export const getCognitiveTestResults = async (
  testType?: 'reflexes' | 'memory' | 'judgment' | 'rock_dodger' | 'pattern_matcher' | 'melody_repeater' | 'tile_puzzle' | 'trail_maker' | 'n_back',
  limit?: number
): Promise<CognitiveTestResult[]> => {
  return await withDatabase(
    async (db) => {
      let query = 'SELECT * FROM cognitive_test_results';
      const params: any[] = [];
      
      if (testType) {
        query += ' WHERE test_type = ?';
        params.push(testType);
      }
      
      query += ' ORDER BY timestamp DESC';
      
      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
      const result = await db.getAllAsync(query, params);
      return result.map((row: any) => ({
        ...row,
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      })) as CognitiveTestResult[];
    },
    'getCognitiveTestResults',
    async () => {
      // Fallback mode
      let results = getFallbackData('cognitive_test_results');
      
      if (testType) {
        results = results.filter((result: any) => result.test_type === testType);
      }
      
      results.sort((a: any, b: any) => b.timestamp - a.timestamp);
      
      if (limit) {
        results = results.slice(0, limit);
      }
      
      return results.map((row: any) => ({
        ...row,
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      })) as CognitiveTestResult[];
    }
  );
};

export const getTestResultsOlderThan24Hours = async (
  testType?: 'reflexes' | 'memory' | 'judgment' | 'rock_dodger' | 'pattern_matcher' | 'melody_repeater' | 'tile_puzzle' | 'trail_maker' | 'n_back'
): Promise<CognitiveTestResult[]> => {
  const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  
  return await withDatabase(
    async (db) => {
      let query = 'SELECT * FROM cognitive_test_results WHERE timestamp < ?';
      const params: any[] = [twentyFourHoursAgo];
      
      if (testType) {
        query += ' AND test_type = ?';
        params.push(testType);
      }
      
      query += ' ORDER BY timestamp DESC';
      
      const result = await db.getAllAsync(query, params);
      return result.map((row: any) => ({
        ...row,
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      })) as CognitiveTestResult[];
    },
    'getTestResultsOlderThan24Hours',
    async () => {
      // Fallback mode
      let results = getFallbackData('cognitive_test_results');
      
      results = results.filter((result: any) => result.timestamp < twentyFourHoursAgo);
      
      if (testType) {
        results = results.filter((result: any) => result.test_type === testType);
      }
      
      results.sort((a: any, b: any) => b.timestamp - a.timestamp);
      
      return results.map((row: any) => ({
        ...row,
        raw_data: row.raw_data ? JSON.parse(row.raw_data) : undefined
      })) as CognitiveTestResult[];
    }
  );
};