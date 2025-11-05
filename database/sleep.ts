import { withDatabase, getFallbackData, addFallbackData, updateFallbackData } from './database';

export interface SleepLog {
  id: number;
  sleep_start: number;
  sleep_end: number;
  duration_seconds: number;
  manually_edited: boolean;
}

export const logSleep = async (
  sleepStart: number,
  sleepEnd: number,
  manuallyEdited: boolean = false
): Promise<number> => {
  const durationSeconds = sleepEnd - sleepStart;
  
  return await withDatabase(
    async (db) => {
      const result = await db.runAsync(
        'INSERT INTO sleep_logs (sleep_start, sleep_end, duration_seconds, manually_edited) VALUES (?, ?, ?, ?)',
        [sleepStart, sleepEnd, durationSeconds, manuallyEdited ? 1 : 0]
      );
      return result.lastInsertRowId;
    },
    'logSleep',
    async () => {
      // Fallback mode
      return addFallbackData('sleep_logs', {
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_seconds: durationSeconds,
        manually_edited: manuallyEdited
      });
    }
  );
};

export const getSleepLogs = async (limit?: number): Promise<SleepLog[]> => {
  return await withDatabase(
    async (db) => {
      let query = 'SELECT * FROM sleep_logs ORDER BY sleep_start DESC';
      const params: any[] = [];
      
      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
      const result = await db.getAllAsync(query, params);
      return result.map((row: any) => ({
        ...row,
        manually_edited: Boolean(row.manually_edited)
      })) as SleepLog[];
    },
    'getSleepLogs',
    async () => {
      // Fallback mode
      let logs = getFallbackData('sleep_logs');
      logs.sort((a: any, b: any) => b.sleep_start - a.sleep_start);
      
      if (limit) {
        logs = logs.slice(0, limit);
      }
      
      return logs.map((row: any) => ({
        ...row,
        manually_edited: Boolean(row.manually_edited)
      })) as SleepLog[];
    }
  );
};

export const updateSleepLog = async (
  id: number,
  sleepStart: number,
  sleepEnd: number
): Promise<void> => {
  const durationSeconds = sleepEnd - sleepStart;
  
  await withDatabase(
    async (db) => {
      await db.runAsync(
        'UPDATE sleep_logs SET sleep_start = ?, sleep_end = ?, duration_seconds = ?, manually_edited = 1 WHERE id = ?',
        [sleepStart, sleepEnd, durationSeconds, id]
      );
    },
    'updateSleepLog',
    async () => {
      // Fallback mode
      updateFallbackData('sleep_logs', id, {
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_seconds: durationSeconds,
        manually_edited: true
      });
    }
  );
};

export const getLastSleepLog = async (): Promise<SleepLog | null> => {
  return await withDatabase(
    async (db) => {
      const result = await db.getFirstAsync('SELECT * FROM sleep_logs ORDER BY sleep_start DESC LIMIT 1');
      
      if (!result) return null;
      
      return {
        ...(result as any),
        manually_edited: Boolean((result as any).manually_edited)
      } as SleepLog;
    },
    'getLastSleepLog',
    async () => {
      // Fallback mode
      const logs = getFallbackData('sleep_logs');
      if (logs.length === 0) return null;
      
      const sortedLogs = logs.sort((a: any, b: any) => b.sleep_start - a.sleep_start);
      const lastLog = sortedLogs[0];
      
      return {
        ...lastLog,
        manually_edited: Boolean(lastLog.manually_edited)
      } as SleepLog;
    }
  );
};