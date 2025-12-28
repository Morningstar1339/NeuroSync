import { withDatabase, getFallbackData, addFallbackData, updateFallbackData, asyncStorageGet, asyncStorageSet } from './database';

export interface SleepLog {
  id: number;
  sleep_start: number | null;
  sleep_end: number | null;
  duration_seconds: number | null;
  manually_edited: boolean;
  didnt_sleep: boolean;
  logged_at: number;
}

const LAST_SLEEP_PROMPT_KEY = 'last_sleep_prompt_timestamp';
const TWENTY_FOUR_HOURS = 24 * 60 * 60;

export const logSleep = async (
  sleepStart: number,
  sleepEnd: number,
  manuallyEdited: boolean = false
): Promise<number> => {
  const durationSeconds = sleepEnd - sleepStart;
  const loggedAt = Math.floor(Date.now() / 1000);
  
  return await withDatabase(
    async (db) => {
      const result = await db.runAsync(
        'INSERT INTO sleep_logs (sleep_start, sleep_end, duration_seconds, manually_edited, didnt_sleep, logged_at) VALUES (?, ?, ?, ?, 0, ?)',
        [sleepStart, sleepEnd, durationSeconds, manuallyEdited ? 1 : 0, loggedAt]
      );
      return result.lastInsertRowId;
    },
    'logSleep',
    async () => {
      return addFallbackData('sleep_logs', {
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_seconds: durationSeconds,
        manually_edited: manuallyEdited,
        didnt_sleep: false,
        logged_at: loggedAt
      });
    }
  );
};

export const logDidntSleep = async (): Promise<number> => {
  const loggedAt = Math.floor(Date.now() / 1000);
  
  return await withDatabase(
    async (db) => {
      const result = await db.runAsync(
        'INSERT INTO sleep_logs (sleep_start, sleep_end, duration_seconds, manually_edited, didnt_sleep, logged_at) VALUES (NULL, NULL, NULL, 0, 1, ?)',
        [loggedAt]
      );
      return result.lastInsertRowId;
    },
    'logDidntSleep',
    async () => {
      return addFallbackData('sleep_logs', {
        sleep_start: null,
        sleep_end: null,
        duration_seconds: null,
        manually_edited: false,
        didnt_sleep: true,
        logged_at: loggedAt
      });
    }
  );
};

export const getSleepLogs = async (limit?: number): Promise<SleepLog[]> => {
  return await withDatabase(
    async (db) => {
      let query = 'SELECT * FROM sleep_logs ORDER BY logged_at DESC';
      const params: any[] = [];
      
      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
      const result = await db.getAllAsync(query, params);
      return result.map((row: any) => ({
        ...row,
        manually_edited: Boolean(row.manually_edited),
        didnt_sleep: Boolean(row.didnt_sleep)
      })) as SleepLog[];
    },
    'getSleepLogs',
    async () => {
      let logs = getFallbackData('sleep_logs');
      logs.sort((a: any, b: any) => b.logged_at - a.logged_at);
      
      if (limit) {
        logs = logs.slice(0, limit);
      }
      
      return logs.map((row: any) => ({
        ...row,
        manually_edited: Boolean(row.manually_edited),
        didnt_sleep: Boolean(row.didnt_sleep)
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
        'UPDATE sleep_logs SET sleep_start = ?, sleep_end = ?, duration_seconds = ?, manually_edited = 1, didnt_sleep = 0 WHERE id = ?',
        [sleepStart, sleepEnd, durationSeconds, id]
      );
    },
    'updateSleepLog',
    async () => {
      updateFallbackData('sleep_logs', id, {
        sleep_start: sleepStart,
        sleep_end: sleepEnd,
        duration_seconds: durationSeconds,
        manually_edited: true,
        didnt_sleep: false
      });
    }
  );
};

export const getLastSleepLog = async (): Promise<SleepLog | null> => {
  return await withDatabase(
    async (db) => {
      const result = await db.getFirstAsync('SELECT * FROM sleep_logs ORDER BY logged_at DESC LIMIT 1');
      
      if (!result) return null;
      
      return {
        ...(result as any),
        manually_edited: Boolean((result as any).manually_edited),
        didnt_sleep: Boolean((result as any).didnt_sleep)
      } as SleepLog;
    },
    'getLastSleepLog',
    async () => {
      const logs = getFallbackData('sleep_logs');
      if (logs.length === 0) return null;
      
      const sortedLogs = logs.sort((a: any, b: any) => b.logged_at - a.logged_at);
      const lastLog = sortedLogs[0];
      
      return {
        ...lastLog,
        manually_edited: Boolean(lastLog.manually_edited),
        didnt_sleep: Boolean(lastLog.didnt_sleep)
      } as SleepLog;
    }
  );
};

export const shouldPromptForSleep = async (): Promise<boolean> => {
  try {
    const data = await asyncStorageGet(LAST_SLEEP_PROMPT_KEY);
    const lastPromptTimestamp = data.length > 0 ? data[0]?.timestamp : null;
    
    if (!lastPromptTimestamp) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastPrompt = now - lastPromptTimestamp;
    
    return timeSinceLastPrompt >= TWENTY_FOUR_HOURS;
  } catch (error) {
    console.error('Error checking sleep prompt status:', error);
    return true;
  }
};

export const markSleepPromptShown = async (): Promise<void> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    await asyncStorageSet(LAST_SLEEP_PROMPT_KEY, [{ timestamp: now }]);
  } catch (error) {
    console.error('Error marking sleep prompt as shown:', error);
  }
};

export const resetSleepPromptTimer = async (): Promise<void> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    await asyncStorageSet(LAST_SLEEP_PROMPT_KEY, [{ timestamp: now }]);
  } catch (error) {
    console.error('Error resetting sleep prompt timer:', error);
  }
};

export const getTimeSinceLastSleepLog = async (): Promise<number | null> => {
  const lastLog = await getLastSleepLog();
  if (!lastLog) return null;
  
  const now = Math.floor(Date.now() / 1000);
  return now - lastLog.logged_at;
};

export const isOverdueForSleepLog = async (): Promise<boolean> => {
  const timeSince = await getTimeSinceLastSleepLog();
  if (timeSince === null) return true;
  return timeSince >= TWENTY_FOUR_HOURS;
};

export const isMorningWithoutSleepLog = async (): Promise<boolean> => {
  const now = new Date();
  const currentHour = now.getHours();
  
  if (currentHour >= 12) {
    return false;
  }
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000);
  
  const lastLog = await getLastSleepLog();
  if (!lastLog) {
    return true;
  }
  
  return lastLog.logged_at < todayStartTimestamp;
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

export const deleteSleepLog = async (id: number): Promise<void> => {
  await withDatabase(
    async (db) => {
      await db.runAsync('DELETE FROM sleep_logs WHERE id = ?', [id]);
    },
    'deleteSleepLog',
    async () => {
      const logs = getFallbackData('sleep_logs');
      const index = logs.findIndex((log: any) => log.id === id);
      if (index !== -1) {
        logs.splice(index, 1);
      }
    }
  );
};
