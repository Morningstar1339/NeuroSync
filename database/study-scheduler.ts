import { withDatabase } from './database';
import { StudyProtocol } from './supplements';

export type SchedulableTestType = 
  | 'reflexes' | 'memory' | 'judgment' | 'connections'
  | 'rock_dodger' | 'pattern_matcher' | 'tile_puzzle' | 'n_back'
  | 'stroop' | 'questionnaire';

export interface ScheduledTest {
  id: number;
  study_protocol_id: number;
  supplement_log_id?: number;
  test_type: SchedulableTestType;
  scheduled_time: number; // Unix timestamp
  completed: boolean;
  created_at: number;
}

export interface StudySession {
  supplement_log_id: number;
  supplement_name: string;
  protocols: StudyProtocol[];
  start_time: number;
}

// Initialize scheduled tests table (should be added to database schema)
export const initializeStudyScheduler = async () => {
  return await withDatabase(
    async (db) => {
      db.execSync(`
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
        
        CREATE INDEX IF NOT EXISTS idx_scheduled_tests_time ON scheduled_tests (scheduled_time);
        CREATE INDEX IF NOT EXISTS idx_scheduled_tests_completed ON scheduled_tests (completed);
      `);
    },
    'initializeStudyScheduler'
  );
};

// Schedule tests based on event-based study protocols when supplement is logged
export const scheduleEventBasedTests = async (supplementId: number, supplementLogId: number): Promise<void> => {
  return await withDatabase(
    async (db) => {
      // Get all event-based study protocols for this supplement
      const protocols = await db.getAllAsync(
        'SELECT * FROM study_protocols WHERE supplement_id = ? AND schedule_type = ?',
        [supplementId, 'event_based']
      ) as StudyProtocol[];
      
      const baseTime = Math.floor(Date.now() / 1000);
      
      for (const protocol of protocols) {
        // Schedule tests at intervals for the duration
        const numTests = Math.floor(protocol.duration_minutes / protocol.interval_minutes);
        
        for (let i = 0; i < numTests; i++) {
          let scheduledTime = baseTime + (i * protocol.interval_minutes * 60);
          
          // Check for overlaps and adjust time if necessary
          const overlapCheck = await checkForOverlappingTests(protocol.test_type, scheduledTime);
          if (overlapCheck.hasOverlap) {
            // Try to find a better time within a reasonable window (±30 minutes)
            const suggestions = await suggestAlternativeTime(protocol.test_type, scheduledTime);
            if (suggestions.length > 0) {
              // Use the first suggestion that's within 30 minutes of the original time
              const maxDeviation = 30 * 60; // 30 minutes in seconds
              const goodSuggestion = suggestions.find(time => 
                Math.abs(time - scheduledTime) <= maxDeviation
              );
              if (goodSuggestion) {
                scheduledTime = goodSuggestion;
              }
              // If no good suggestion found, keep original time (user will see overlap warning)
            }
          }
          
          db.runSync(
            'INSERT INTO scheduled_tests (study_protocol_id, supplement_log_id, test_type, scheduled_time, created_at) VALUES (?, ?, ?, ?, ?)',
            [protocol.id, supplementLogId, protocol.test_type, scheduledTime, baseTime]
          );
        }
      }
    },
    'scheduleEventBasedTests'
  );
};

// Get upcoming tests (within next hour)
export const getUpcomingTests = async (): Promise<ScheduledTest[]> => {
  return await withDatabase(
    async (db) => {
      const now = Math.floor(Date.now() / 1000);
      const oneHourFromNow = now + (60 * 60);
      
      const result = await db.getAllAsync(
        'SELECT * FROM scheduled_tests WHERE scheduled_time BETWEEN ? AND ? AND completed = 0 ORDER BY scheduled_time ASC',
        [now, oneHourFromNow]
      );
      
      return result as ScheduledTest[];
    },
    'getUpcomingTests',
    async () => []
  );
};

// Get overdue tests (past scheduled time but not completed)
export const getOverdueTests = async (): Promise<ScheduledTest[]> => {
  return await withDatabase(
    async (db) => {
      const now = Math.floor(Date.now() / 1000);
      
      const result = await db.getAllAsync(
        'SELECT * FROM scheduled_tests WHERE scheduled_time < ? AND completed = 0 ORDER BY scheduled_time ASC',
        [now]
      );
      
      return result as ScheduledTest[];
    },
    'getOverdueTests',
    async () => []
  );
};

const TEST_DURATIONS: Record<SchedulableTestType, number> = {
  reflexes: 10,
  memory: 60,
  judgment: 30,
  connections: 60,
  rock_dodger: 30,
  pattern_matcher: 45,
  tile_puzzle: 60,
  n_back: 90,
  stroop: 45,
  questionnaire: 30
};

// Check for test conflicts (tests scheduled within test duration + 30 seconds)
export const checkTestConflicts = async (scheduledTime: number, testType: SchedulableTestType): Promise<ScheduledTest[]> => {
  return await withDatabase(
    async (db) => {
      const testDurations = TEST_DURATIONS;
      
      const testDuration = testDurations[testType];
      const conflictWindow = testDuration + 30;
      
      const windowStart = scheduledTime - conflictWindow;
      const windowEnd = scheduledTime + conflictWindow;
      
      const result = await db.getAllAsync(
        'SELECT * FROM scheduled_tests WHERE scheduled_time BETWEEN ? AND ? AND completed = 0',
        [windowStart, windowEnd]
      );
      
      return result as ScheduledTest[];
    },
    'checkTestConflicts',
    async () => []
  );
};

// Mark test as completed and link to test result
export const completeScheduledTest = async (scheduledTestId: number, testResultId?: number): Promise<void> => {
  return await withDatabase(
    async (db) => {
      await db.runAsync(
        'UPDATE scheduled_tests SET completed = 1 WHERE id = ?',
        [scheduledTestId]
      );
    },
    'completeScheduledTest',
    async () => {}
  );
};

// Get all active study sessions (recently logged supplements with active protocols)
export const getActiveStudySessions = async (): Promise<StudySession[]> => {
  return await withDatabase(
    async (db) => {
      const sixHoursAgo = Math.floor(Date.now() / 1000) - (6 * 60 * 60);
  
      const result: any[] = await db.getAllAsync(`
        SELECT 
          sl.id as supplement_log_id,
          s.name as supplement_name,
          sl.timestamp,
          sp.*
        FROM supplement_logs sl
        JOIN supplements s ON sl.supplement_id = s.id
        JOIN study_protocols sp ON s.id = sp.supplement_id
        WHERE sl.timestamp > ? 
          AND sp.schedule_type = 'event_based'
          AND sp.duration_minutes > (? - sl.timestamp) / 60
        ORDER BY sl.timestamp DESC
      `, [sixHoursAgo, Math.floor(Date.now() / 1000)]);
      
      const sessions: Record<number, StudySession> = {};
      
      result.forEach((row) => {
        const typedRow = row;
        if (!sessions[typedRow.supplement_log_id]) {
          sessions[typedRow.supplement_log_id] = {
            supplement_log_id: typedRow.supplement_log_id,
            supplement_name: typedRow.supplement_name,
            protocols: [],
            start_time: typedRow.timestamp
          };
        }
        
        sessions[typedRow.supplement_log_id].protocols.push({
          id: typedRow.id,
          supplement_id: typedRow.supplement_id,
          test_type: typedRow.test_type,
          interval_minutes: typedRow.interval_minutes,
          duration_minutes: typedRow.duration_minutes,
          schedule_type: typedRow.schedule_type,
          parameters: typedRow.parameters
        });
      });
      
      return Object.values(sessions);
    },
    'getActiveStudySessions',
    async () => []
  );
};

// Get the most relevant scheduled test for a given test type (closest to current time)
export const getRelevantScheduledTest = async (testType: SchedulableTestType): Promise<ScheduledTest | null> => {
  return await withDatabase(
    async (db) => {
      const now = Math.floor(Date.now() / 1000);
      const twoHoursAgo = now - (2 * 60 * 60);
      const oneHourFromNow = now + (60 * 60);
      
      const result = await db.getAllAsync(
        `SELECT * FROM scheduled_tests 
         WHERE test_type = ? 
           AND scheduled_time BETWEEN ? AND ? 
           AND completed = 0 
         ORDER BY ABS(scheduled_time - ?) ASC 
         LIMIT 1`,
        [testType, twoHoursAgo, oneHourFromNow, now]
      );
      
      return result.length > 0 ? result[0] as ScheduledTest : null;
    },
    'getRelevantScheduledTest',
    async () => null
  );
};

// Get scheduled test by ID
export const getScheduledTestById = async (id: number): Promise<ScheduledTest | null> => {
  return await withDatabase(
    async (db) => {
      const result = await db.getAllAsync(
        'SELECT * FROM scheduled_tests WHERE id = ?',
        [id]
      );
      
      return result.length > 0 ? result[0] as ScheduledTest : null;
    },
    'getScheduledTestById',
    async () => null
  );
};

// Get study protocol and supplement log info for a scheduled test
export const getTestContext = async (scheduledTestId: number): Promise<{
  study_protocol_id: number;
  supplement_log_id?: number;
  supplement_name?: string;
} | null> => {
  return await withDatabase(
    async (db) => {
      const result = await db.getAllAsync(`
        SELECT 
          st.study_protocol_id,
          st.supplement_log_id,
          s.name as supplement_name
        FROM scheduled_tests st
        LEFT JOIN supplement_logs sl ON st.supplement_log_id = sl.id
        LEFT JOIN supplements s ON sl.supplement_id = s.id
        WHERE st.id = ?
      `, [scheduledTestId]);
      
      return result.length > 0 ? result[0] as any : null;
    },
    'getTestContext',
    async () => null
  );
};

// Check if there are any pending tests scheduled for the same time window
export const checkForOverlappingTests = async (
  testType: SchedulableTestType, 
  scheduledTime: number
): Promise<{hasOverlap: boolean, overlappingTests: ScheduledTest[]}> => {
  return await withDatabase(
    async (db) => {
      const testDuration = TEST_DURATIONS[testType];
      const bufferTime = 60;
      
      const windowStart = scheduledTime - testDuration - bufferTime;
      const windowEnd = scheduledTime + testDuration + bufferTime;
      
      const overlappingTests = await db.getAllAsync(
        `SELECT * FROM scheduled_tests 
         WHERE scheduled_time BETWEEN ? AND ? 
           AND completed = 0 
           AND test_type != ?
         ORDER BY scheduled_time ASC`,
        [windowStart, windowEnd, testType]
      ) as ScheduledTest[];
      
      return {
        hasOverlap: overlappingTests.length > 0,
        overlappingTests
      };
    },
    'checkForOverlappingTests',
    async () => ({ hasOverlap: false, overlappingTests: [] })
  );
};

// Get currently active tests (tests that should be happening right now)
export const getCurrentlyActiveTests = async (): Promise<ScheduledTest[]> => {
  return await withDatabase(
    async (db) => {
      const now = Math.floor(Date.now() / 1000);
      
      // Consider tests active if they started within their test duration and aren't completed
      const result = await db.getAllAsync(`
        SELECT st.*, 
               CASE 
                 WHEN st.test_type = 'reflexes' THEN 10
                 WHEN st.test_type = 'memory' THEN 60  
                 WHEN st.test_type = 'judgment' THEN 30
                 WHEN st.test_type = 'connections' THEN 60
                 WHEN st.test_type = 'rock_dodger' THEN 30
                 WHEN st.test_type = 'pattern_matcher' THEN 45
                 WHEN st.test_type = 'tile_puzzle' THEN 60
                 WHEN st.test_type = 'n_back' THEN 90
                 WHEN st.test_type = 'stroop' THEN 45
                 WHEN st.test_type = 'questionnaire' THEN 30
                 ELSE 30
               END as duration_seconds
        FROM scheduled_tests st
        WHERE st.completed = 0 
          AND st.scheduled_time <= ?
          AND st.scheduled_time > (? - duration_seconds)
        ORDER BY st.scheduled_time ASC
      `, [now, now]);
      
      return result as ScheduledTest[];
    },
    'getCurrentlyActiveTests',
    async () => []
  );
};

// Check if user is currently in the middle of a test session
export const isUserInActiveTestSession = async (): Promise<{
  isActive: boolean, 
  activeTest?: ScheduledTest,
  timeRemaining?: number
}> => {
  const activeTests = await getCurrentlyActiveTests();
  
  if (activeTests.length === 0) {
    return { isActive: false };
  }
  
  const activeTest = activeTests[0]; // Get the first (earliest) active test
  const now = Math.floor(Date.now() / 1000);
  
  const testDuration = TEST_DURATIONS[activeTest.test_type] || 30;
  const timeRemaining = (activeTest.scheduled_time + testDuration) - now;
  
  return {
    isActive: true,
    activeTest,
    timeRemaining: Math.max(0, timeRemaining)
  };
};

// Suggest better scheduling time to avoid overlaps
export const suggestAlternativeTime = async (
  testType: SchedulableTestType,
  preferredTime: number
): Promise<number[]> => {
  return await withDatabase(
    async (db) => {
      const fourHoursFromPreferred = preferredTime + (4 * 60 * 60);
      const scheduledTests = await db.getAllAsync(
        'SELECT * FROM scheduled_tests WHERE scheduled_time BETWEEN ? AND ? AND completed = 0 ORDER BY scheduled_time ASC',
        [preferredTime, fourHoursFromPreferred]
      ) as ScheduledTest[];
      
      const testDuration = TEST_DURATIONS[testType];
      const bufferTime = 60;
      const totalTimeNeeded = testDuration + bufferTime;
      
      const suggestions: number[] = [];
      let currentTime = preferredTime;
      
      for (const scheduledTest of scheduledTests) {
        const scheduledTestDuration = TEST_DURATIONS[scheduledTest.test_type] || 30;
        const scheduledTestEnd = scheduledTest.scheduled_time + scheduledTestDuration + bufferTime;
        
        if (currentTime + totalTimeNeeded <= scheduledTest.scheduled_time - bufferTime) {
          suggestions.push(currentTime);
          if (suggestions.length >= 3) break;
        }
        
        currentTime = Math.max(currentTime, scheduledTestEnd);
      }
      
      while (suggestions.length < 3 && currentTime < fourHoursFromPreferred) {
        suggestions.push(currentTime);
        currentTime += totalTimeNeeded;
      }
      
      return suggestions;
    },
    'suggestAlternativeTime',
    async () => [preferredTime]
  );
};

// Clean up old completed tests (older than 24 hours)
export const cleanupOldScheduledTests = async (): Promise<void> => {
  return await withDatabase(
    async (db) => {
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
      
      await db.runAsync(
        'DELETE FROM scheduled_tests WHERE completed = 1 AND created_at < ?',
        [twentyFourHoursAgo]
      );
    },
    'cleanupOldScheduledTests',
    async () => {}
  );
};