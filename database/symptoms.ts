import { withDatabase, getFallbackData, addFallbackData, updateFallbackData, deleteFallbackData, isFallbackMode } from './database';

export interface Symptom {
  id: number;
  body_region: string;
  description: string;
  last_used: number;
}

export interface SymptomLog {
  id: number;
  symptom_id: number;
  timestamp: number;
  severity: number;
  notes?: string;
}

export type BodyRegion = 'head' | 'thorax' | 'abdomen' | 'pelvis' | 'arms' | 'hands' | 'legs' | 'feet';

export const getSymptomsByRegion = async (bodyRegion: BodyRegion): Promise<Symptom[]> => {
  try {
    if (!bodyRegion) {
      console.error('Body region is required');
      return [];
    }
    
    return await withDatabase(
      async (db) => {
        const result = await db.getAllAsync(
          'SELECT * FROM symptoms WHERE body_region = ? ORDER BY last_used DESC',
          [bodyRegion]
        );
        
        if (!result || !Array.isArray(result)) {
          console.warn('No symptoms found for body region:', bodyRegion);
          return [];
        }
        
        return result as Symptom[];
      },
      'getSymptomsByRegion',
      async () => {
        // Fallback mode
        const symptoms = getFallbackData('symptoms');
        return symptoms.filter((symptom: any) => symptom.body_region === bodyRegion)
          .sort((a: any, b: any) => b.last_used - a.last_used);
      }
    );
  } catch (error) {
    console.error('Failed to get symptoms by region:', error);
    return [];
  }
};

export const addSymptom = async (bodyRegion: BodyRegion, description: string): Promise<number> => {
  try {
    if (!bodyRegion || !description) {
      console.error('Body region and description are required');
      return -1;
    }
    
    if (description.trim().length === 0) {
      console.error('Description cannot be empty');
      return -1;
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    return await withDatabase(
      async (db) => {
        const result = await db.runAsync(
          'INSERT INTO symptoms (body_region, description, last_used) VALUES (?, ?, ?)',
          [bodyRegion, description.trim(), timestamp]
        );
        
        if (!result || typeof result.lastInsertRowId !== 'number') {
          console.error('Failed to get insert ID for new symptom');
          return -1;
        }
        
        return result.lastInsertRowId;
      },
      'addSymptom',
      async () => {
        // Fallback mode
        return addFallbackData('symptoms', {
          body_region: bodyRegion,
          description: description.trim(),
          last_used: timestamp
        });
      }
    );
  } catch (error) {
    console.error('Failed to add symptom:', error);
    return -1;
  }
};

export const logSymptom = async (symptomId: number, severity: number, notes?: string): Promise<number> => {
  try {
    if (!symptomId || typeof symptomId !== 'number' || symptomId <= 0) {
      console.error('Valid symptom ID is required');
      return -1;
    }
    
    if (typeof severity !== 'number' || severity < 1 || severity > 5) {
      console.error('Severity must be a number between 1 and 5');
      return -1;
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    return await withDatabase(
      async (db) => {
        // Update last_used timestamp for the symptom
        try {
          await db.runAsync('UPDATE symptoms SET last_used = ? WHERE id = ?', [timestamp, symptomId]);
        } catch (updateError) {
          console.warn('Failed to update symptom last_used timestamp:', updateError);
          // Continue with logging even if update fails
        }
        
        // Log the symptom occurrence
        const result = await db.runAsync(
          'INSERT INTO symptom_logs (symptom_id, timestamp, severity, notes) VALUES (?, ?, ?, ?)',
          [symptomId, timestamp, severity, notes?.trim() || null]
        );
        
        if (!result || typeof result.lastInsertRowId !== 'number') {
          console.error('Failed to get insert ID for new symptom log');
          return -1;
        }
        
        return result.lastInsertRowId;
      },
      'logSymptom',
      async () => {
        // Fallback mode
        // Update last_used timestamp for the symptom
        updateFallbackData('symptoms', symptomId, { last_used: timestamp });
        
        // Log the symptom occurrence
        return addFallbackData('symptom_logs', {
          symptom_id: symptomId,
          timestamp,
          severity,
          notes: notes?.trim() || null
        });
      }
    );
  } catch (error) {
    console.error('Failed to log symptom:', error);
    return -1;
  }
};

export const getSymptomLogs = async (symptomId?: number, limit?: number): Promise<SymptomLog[]> => {
  try {
    if (symptomId && (typeof symptomId !== 'number' || symptomId <= 0)) {
      console.error('Symptom ID must be a positive number');
      return [];
    }
    
    if (limit && (typeof limit !== 'number' || limit <= 0)) {
      console.error('Limit must be a positive number');
      return [];
    }
    
    return await withDatabase(
      async (db) => {
        let query = 'SELECT * FROM symptom_logs';
        const params: any[] = [];
        
        if (symptomId) {
          query += ' WHERE symptom_id = ?';
          params.push(symptomId);
        }
        
        query += ' ORDER BY timestamp DESC';
        
        if (limit) {
          query += ' LIMIT ?';
          params.push(limit);
        }
        
        const result = await db.getAllAsync(query, params);
        
        if (!result || !Array.isArray(result)) {
          console.warn('No symptom logs found');
          return [];
        }
        
        return result as SymptomLog[];
      },
      'getSymptomLogs',
      async () => {
        // Fallback mode
        let logs = getFallbackData('symptom_logs');
        
        if (symptomId) {
          logs = logs.filter((log: any) => log.symptom_id === symptomId);
        }
        
        logs.sort((a: any, b: any) => b.timestamp - a.timestamp);
        
        if (limit) {
          logs = logs.slice(0, limit);
        }
        
        return logs;
      }
    );
  } catch (error) {
    console.error('Failed to get symptom logs:', error);
    return [];
  }
};

// Get a specific symptom by ID
export const getSymptomById = async (symptomId: number): Promise<Symptom | null> => {
  try {
    if (!symptomId || typeof symptomId !== 'number' || symptomId <= 0) {
      console.error('Valid symptom ID is required');
      return null;
    }
    
    return await withDatabase(
      async (db) => {
        const result = await db.getFirstAsync(
          'SELECT * FROM symptoms WHERE id = ?',
          [symptomId]
        );
        
        return result as Symptom | null;
      },
      'getSymptomById',
      async () => {
        // Fallback mode
        const symptoms = getFallbackData('symptoms');
        return symptoms.find((symptom: any) => symptom.id === symptomId) || null;
      }
    );
  } catch (error) {
    console.error('Failed to get symptom by ID:', error);
    return null;
  }
};

// Delete a symptom (and all its logs)
export const deleteSymptom = async (symptomId: number): Promise<boolean> => {
  try {
    if (!symptomId || typeof symptomId !== 'number' || symptomId <= 0) {
      console.error('Valid symptom ID is required');
      return false;
    }
    
    return await withDatabase(
      async (db) => {
        // First delete all symptom logs
        await db.runAsync('DELETE FROM symptom_logs WHERE symptom_id = ?', [symptomId]);
        
        // Then delete the symptom
        const result = await db.runAsync('DELETE FROM symptoms WHERE id = ?', [symptomId]);
        
        return (result.changes || 0) > 0;
      },
      'deleteSymptom',
      async () => {
        // Fallback mode
        // First delete all symptom logs
        const logs = getFallbackData('symptom_logs');
        const remainingLogs = logs.filter((log: any) => log.symptom_id !== symptomId);
        getFallbackData('symptom_logs').length = 0;
        getFallbackData('symptom_logs').push(...remainingLogs);
        
        // Then delete the symptom
        return deleteFallbackData('symptoms', symptomId);
      }
    );
  } catch (error) {
    console.error('Failed to delete symptom:', error);
    return false;
  }
};

// Get symptom statistics
export const getSymptomStats = async (symptomId: number): Promise<{
  totalLogs: number;
  averageSeverity: number;
  lastLogged: number | null;
} | null> => {
  try {
    if (!symptomId || typeof symptomId !== 'number' || symptomId <= 0) {
      console.error('Valid symptom ID is required');
      return null;
    }
    
    return await withDatabase(
      async (db) => {
        const result = await db.getFirstAsync(`
          SELECT 
            COUNT(*) as totalLogs,
            AVG(severity) as averageSeverity,
            MAX(timestamp) as lastLogged
          FROM symptom_logs 
          WHERE symptom_id = ?
        `, [symptomId]);
        
        if (!result) {
          return { totalLogs: 0, averageSeverity: 0, lastLogged: null };
        }
        
        return {
          totalLogs: (result as any).totalLogs || 0,
          averageSeverity: (result as any).averageSeverity || 0,
          lastLogged: (result as any).lastLogged || null
        };
      },
      'getSymptomStats',
      async () => {
        // Fallback mode
        const logs = getFallbackData('symptom_logs').filter((log: any) => log.symptom_id === symptomId);
        
        if (logs.length === 0) {
          return { totalLogs: 0, averageSeverity: 0, lastLogged: null };
        }
        
        const totalLogs = logs.length;
        const averageSeverity = logs.reduce((sum: number, log: any) => sum + log.severity, 0) / totalLogs;
        const lastLogged = Math.max(...logs.map((log: any) => log.timestamp));
        
        return {
          totalLogs,
          averageSeverity,
          lastLogged
        };
      }
    );
  } catch (error) {
    console.error('Failed to get symptom stats:', error);
    return null;
  }
};

// Initialize symptoms table with default symptoms if empty
export const initializeDefaultSymptoms = async (): Promise<void> => {
  try {
    if (isFallbackMode()) {
      console.log('Fallback mode - default symptoms already initialized');
      return;
    }
    
    await withDatabase(
      async (db) => {
        // Check if symptoms table has any data
        const count = await db.getFirstAsync('SELECT COUNT(*) as count FROM symptoms');
        if ((count as any)?.count > 0) {
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
            await db.runAsync(
              'INSERT INTO symptoms (body_region, description, last_used) VALUES (?, ?, ?)',
              [region, symptom, timestamp]
            );
          }
        }
        
        console.log('Default symptoms initialized successfully');
      },
      'initializeDefaultSymptoms',
      async () => {
        // Fallback mode - symptoms already initialized in fallback data
        console.log('Fallback mode - default symptoms already available');
      }
    );
  } catch (error) {
    console.error('Failed to initialize default symptoms:', error);
  }
};