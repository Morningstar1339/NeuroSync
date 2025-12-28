import { withDatabase, isDatabaseInitialized } from './database';

export interface Activity {
  id: number;
  name: string;
  default_value: number;
  unit: string;
  icon_id?: string;
  color?: string;
}

export interface ActivityLog {
  id: number;
  activity_id: number;
  timestamp: number;
  value: number;
  notes?: string;
}

export interface ActivityLogWithDetails extends ActivityLog {
  activity_name: string;
  unit: string;
  icon_id?: string;
  color?: string;
}

export const getAllActivities = async (): Promise<Activity[]> => {
  console.log('[getAllActivities] Starting...');
  if (!isDatabaseInitialized()) {
    console.log('[getAllActivities] ERROR: Database not initialized');
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  return await withDatabase(async (db) => {
    console.log('[getAllActivities] Querying database...');
    const result = await db.getAllAsync('SELECT * FROM activities ORDER BY name');
    console.log('[getAllActivities] Raw result count:', result.length);
    if (result.length > 0) {
      console.log('[getAllActivities] First result:', JSON.stringify(result[0]));
    }
    console.log('[getAllActivities] Returning', result.length, 'activities');
    return result as Activity[];
  }, 'get all activities');
};

export const checkActivityExists = async (name: string): Promise<boolean> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  if (!name || name.trim().length === 0) {
    throw new Error('Activity name cannot be empty');
  }
  
  return await withDatabase(async (db) => {
    const result = await db.getFirstAsync('SELECT id FROM activities WHERE LOWER(name) = LOWER(?)', [name.trim()]);
    return result !== null;
  }, 'check activity exists');
};

export const addActivity = async (activity: Omit<Activity, 'id'>): Promise<number> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  if (!activity.name || activity.name.trim().length === 0) {
    throw new Error('Activity name cannot be empty');
  }
  
  if (activity.default_value <= 0) {
    throw new Error('Default value must be greater than 0');
  }
  
  if (!activity.unit || activity.unit.trim().length === 0) {
    throw new Error('Unit cannot be empty');
  }
  
  if (activity.color && !/^#[0-9A-Fa-f]{6}$/.test(activity.color)) {
    throw new Error('Color must be in hex format (e.g., #007AFF)');
  }
  
  return await withDatabase(async (db) => {
    try {
      const existing = await db.getFirstAsync('SELECT id FROM activities WHERE LOWER(name) = LOWER(?)', [activity.name.trim()]);
      if (existing) {
        throw new Error(`An activity named "${activity.name}" already exists`);
      }
      
      const result = await db.runAsync(
        'INSERT INTO activities (name, default_value, unit, icon_id, color) VALUES (?, ?, ?, ?, ?)',
        [
          activity.name.trim(),
          activity.default_value,
          activity.unit.trim(),
          activity.icon_id || null,
          activity.color || '#007AFF'
        ]
      );
      
      if (!result.lastInsertRowId) {
        throw new Error('Failed to add activity: No ID returned');
      }
      
      return result.lastInsertRowId;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new Error(`An activity named "${activity.name}" already exists`);
      }
      throw error;
    }
  }, 'add activity');
};

export const updateActivity = async (activity: Activity): Promise<void> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  if (!activity.id || activity.id <= 0) {
    throw new Error('Invalid activity ID');
  }
  
  if (!activity.name || activity.name.trim().length === 0) {
    throw new Error('Activity name cannot be empty');
  }
  
  if (activity.default_value <= 0) {
    throw new Error('Default value must be greater than 0');
  }
  
  if (!activity.unit || activity.unit.trim().length === 0) {
    throw new Error('Unit cannot be empty');
  }
  
  return await withDatabase(async (db) => {
    const existing = await db.getFirstAsync('SELECT id FROM activities WHERE id = ?', [activity.id]);
    if (!existing) {
      throw new Error('Activity not found');
    }
    
    const result = await db.runAsync(
      'UPDATE activities SET name = ?, default_value = ?, unit = ?, icon_id = ?, color = ? WHERE id = ?',
      [
        activity.name.trim(),
        activity.default_value,
        activity.unit.trim(),
        activity.icon_id || null,
        activity.color || '#007AFF',
        activity.id
      ]
    );
    
    if (result.changes === 0) {
      throw new Error('No activity was updated');
    }
  }, 'update activity');
};

export const deleteActivity = async (activityId: number): Promise<void> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  if (!activityId || activityId <= 0) {
    throw new Error('Invalid activity ID');
  }
  
  return await withDatabase(async (db) => {
    await db.runAsync('DELETE FROM activity_logs WHERE activity_id = ?', [activityId]);
    const result = await db.runAsync('DELETE FROM activities WHERE id = ?', [activityId]);
    if (result.changes === 0) {
      throw new Error('Activity not found');
    }
  }, 'delete activity');
};

export const logActivity = async (activityId: number, value: number, notes?: string, timestamp?: number): Promise<number> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  if (!activityId || activityId <= 0) {
    throw new Error('Invalid activity ID');
  }
  
  if (value <= 0) {
    throw new Error('Value must be greater than 0');
  }
  
  if (notes && notes.length > 1000) {
    throw new Error('Notes must be less than 1000 characters');
  }
  
  return await withDatabase(async (db) => {
    const activity = await db.getFirstAsync('SELECT id FROM activities WHERE id = ?', [activityId]);
    if (!activity) {
      throw new Error('Activity not found');
    }
    
    const finalTimestamp = timestamp || Math.floor(Date.now() / 1000);
    
    const result = await db.runAsync(
      'INSERT INTO activity_logs (activity_id, timestamp, value, notes) VALUES (?, ?, ?, ?)',
      [activityId, finalTimestamp, value, notes?.trim() || null]
    );
    
    if (!result.lastInsertRowId) {
      throw new Error('Failed to save activity log: No ID returned');
    }
    
    return result.lastInsertRowId;
  }, 'log activity');
};

export const getActivityLogs = async (activityId?: number, limit?: number): Promise<ActivityLog[]> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  return await withDatabase(async (db) => {
    let query = 'SELECT * FROM activity_logs';
    const params: any[] = [];
    
    if (activityId) {
      if (activityId <= 0) {
        throw new Error('Invalid activity ID');
      }
      query += ' WHERE activity_id = ?';
      params.push(activityId);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    if (limit) {
      if (limit <= 0) {
        throw new Error('Limit must be greater than 0');
      }
      query += ' LIMIT ?';
      params.push(limit);
    }
    
    const result = await db.getAllAsync(query, params);
    return result as ActivityLog[];
  }, 'get activity logs');
};

export const getActivityLogsWithDetails = async (limit?: number): Promise<ActivityLogWithDetails[]> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  return await withDatabase(async (db) => {
    let query = `
      SELECT 
        al.id, al.activity_id, al.timestamp, al.value, al.notes,
        a.name as activity_name, a.unit, a.icon_id, a.color
      FROM activity_logs al
      JOIN activities a ON al.activity_id = a.id
      ORDER BY al.timestamp DESC
    `;
    const params: any[] = [];
    
    if (limit && limit > 0) {
      query += ' LIMIT ?';
      params.push(limit);
    }
    
    const result = await db.getAllAsync(query, params);
    return result as ActivityLogWithDetails[];
  }, 'get activity logs with details');
};

export const deleteActivityLog = async (logId: number): Promise<void> => {
  if (!isDatabaseInitialized()) {
    throw new Error('Database not initialized. Please wait for app to load completely.');
  }
  
  if (!logId || logId <= 0) {
    throw new Error('Invalid log ID');
  }
  
  return await withDatabase(async (db) => {
    const result = await db.runAsync('DELETE FROM activity_logs WHERE id = ?', [logId]);
    if (result.changes === 0) {
      throw new Error('Log entry not found');
    }
  }, 'delete activity log');
};
