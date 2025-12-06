import { withDatabase, getFallbackData, addFallbackData, isFallbackMode } from './database';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export interface NotificationRecord {
  id: number;
  notification_id: string; // Expo notification identifier
  type: 'supplement_reminder' | 'study_protocol' | 'sleep_reminder';
  related_id: number; // supplement_id, study_protocol_id, etc.
  scheduled_time: number; // Unix timestamp
  title: string;
  body: string;
  data?: string; // JSON string for navigation data
  created_at: number;
  cancelled: boolean;
}

export interface NotificationSettings {
  notifications_enabled: boolean;
  supplement_reminders_enabled: boolean;
  study_notifications_enabled: boolean;
  sleep_reminders_enabled: boolean;
  sleep_reminder_type: 'time_based' | 'duration_based';
  sleep_reminder_time?: string; // HH:MM format
  sleep_reminder_hours?: number; // Hours after last sleep
}

// Initialize notifications table
export const initializeNotificationsTable = async (): Promise<void> => {
  try {
    if (isFallbackMode()) {
      console.log('Fallback mode - notification tables already initialized');
      return;
    }
    
    await withDatabase(
      async (db) => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS notification_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('supplement_reminder', 'study_protocol', 'sleep_reminder')),
            related_id INTEGER NOT NULL,
            scheduled_time INTEGER NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            data TEXT,
            created_at INTEGER NOT NULL,
            cancelled INTEGER DEFAULT 0
          );
          
          CREATE TABLE IF NOT EXISTS notification_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            notifications_enabled INTEGER DEFAULT 1,
            supplement_reminders_enabled INTEGER DEFAULT 1,
            study_notifications_enabled INTEGER DEFAULT 1,
            sleep_reminders_enabled INTEGER DEFAULT 1,
            sleep_reminder_type TEXT DEFAULT 'duration_based',
            sleep_reminder_time TEXT,
            sleep_reminder_hours INTEGER DEFAULT 16
          );
          
          CREATE INDEX IF NOT EXISTS idx_notification_records_type ON notification_records (type);
          CREATE INDEX IF NOT EXISTS idx_notification_records_scheduled_time ON notification_records (scheduled_time);
          CREATE INDEX IF NOT EXISTS idx_notification_records_cancelled ON notification_records (cancelled);
        `);
        
        // Insert default settings if they don't exist
        await db.execAsync(`INSERT OR IGNORE INTO notification_settings (id) VALUES (1);`);
      },
      'initializeNotificationsTable',
      async () => {
        // Fallback mode - tables already initialized in fallback data
        console.log('Fallback mode - notification tables already available');
      }
    );
  } catch (error) {
    console.error('Failed to initialize notifications table:', error);
  }
};

// Request notification permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (!Device.isDevice) {
      console.log('Notifications not available on simulator/emulator');
      return false;
    }

    // Check if running in Expo Go
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.log('Running in Expo Go - limited notification support');
      // Still try to get permissions for local notifications
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Configure notification behavior
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return true;
  } catch (error) {
    console.error('Failed to request notification permissions:', error);
    return false;
  }
};

// Get notification settings
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    return await withDatabase(
      async (db) => {
        const result = await db.getFirstAsync('SELECT * FROM notification_settings WHERE id = 1');
        
        if (!result) {
          // Return default settings
          return {
            notifications_enabled: true,
            supplement_reminders_enabled: true,
            study_notifications_enabled: true,
            sleep_reminders_enabled: true,
            sleep_reminder_type: 'duration_based',
            sleep_reminder_hours: 16
          };
        }
        
        return {
          notifications_enabled: Boolean((result as any).notifications_enabled),
          supplement_reminders_enabled: Boolean((result as any).supplement_reminders_enabled),
          study_notifications_enabled: Boolean((result as any).study_notifications_enabled),
          sleep_reminders_enabled: Boolean((result as any).sleep_reminders_enabled),
          sleep_reminder_type: (result as any).sleep_reminder_type || 'duration_based',
          sleep_reminder_time: (result as any).sleep_reminder_time,
          sleep_reminder_hours: (result as any).sleep_reminder_hours || 16
        };
      },
      'getNotificationSettings',
      async () => {
        // Fallback mode
        const settings = getFallbackData('notification_settings');
        const setting = settings.find((s: any) => s.id === 1);
        
        if (!setting) {
          return {
            notifications_enabled: true,
            supplement_reminders_enabled: true,
            study_notifications_enabled: true,
            sleep_reminders_enabled: true,
            sleep_reminder_type: 'duration_based',
            sleep_reminder_hours: 16
          };
        }
        
        return {
          notifications_enabled: Boolean(setting.notifications_enabled),
          supplement_reminders_enabled: Boolean(setting.supplement_reminders_enabled),
          study_notifications_enabled: Boolean(setting.study_notifications_enabled),
          sleep_reminders_enabled: Boolean(setting.sleep_reminders_enabled),
          sleep_reminder_type: setting.sleep_reminder_type || 'duration_based',
          sleep_reminder_time: setting.sleep_reminder_time,
          sleep_reminder_hours: setting.sleep_reminder_hours || 16
        };
      }
    );
  } catch (error) {
    console.error('Failed to get notification settings:', error);
    // Return default settings if database is not available
    return {
      notifications_enabled: true,
      supplement_reminders_enabled: true,
      study_notifications_enabled: true,
      sleep_reminders_enabled: true,
      sleep_reminder_type: 'duration_based',
      sleep_reminder_hours: 16
    };
  }
};

// Update notification settings
export const updateNotificationSettings = async (settings: Partial<NotificationSettings>): Promise<void> => {
  try {
    await withDatabase(
      async (db) => {
        const updateFields = [];
        const params = [];
        
        if (settings.notifications_enabled !== undefined) {
          updateFields.push('notifications_enabled = ?');
          params.push(settings.notifications_enabled ? 1 : 0);
        }
        
        if (settings.supplement_reminders_enabled !== undefined) {
          updateFields.push('supplement_reminders_enabled = ?');
          params.push(settings.supplement_reminders_enabled ? 1 : 0);
        }
        
        if (settings.study_notifications_enabled !== undefined) {
          updateFields.push('study_notifications_enabled = ?');
          params.push(settings.study_notifications_enabled ? 1 : 0);
        }
        
        if (settings.sleep_reminders_enabled !== undefined) {
          updateFields.push('sleep_reminders_enabled = ?');
          params.push(settings.sleep_reminders_enabled ? 1 : 0);
        }
        
        if (settings.sleep_reminder_type !== undefined) {
          updateFields.push('sleep_reminder_type = ?');
          params.push(settings.sleep_reminder_type);
        }
        
        if (settings.sleep_reminder_time !== undefined) {
          updateFields.push('sleep_reminder_time = ?');
          params.push(settings.sleep_reminder_time);
        }
        
        if (settings.sleep_reminder_hours !== undefined) {
          updateFields.push('sleep_reminder_hours = ?');
          params.push(settings.sleep_reminder_hours);
        }
        
        if (updateFields.length > 0) {
          await db.runAsync(
            `UPDATE notification_settings SET ${updateFields.join(', ')} WHERE id = 1`,
            params
          );
        }
      },
      'updateNotificationSettings',
      async () => {
        // Fallback mode
        const settingsData = getFallbackData('notification_settings');
        const existingSettings = settingsData.find((s: any) => s.id === 1);
        
        if (existingSettings) {
          // Update existing settings
          if (settings.notifications_enabled !== undefined) {
            existingSettings.notifications_enabled = settings.notifications_enabled ? 1 : 0;
          }
          if (settings.supplement_reminders_enabled !== undefined) {
            existingSettings.supplement_reminders_enabled = settings.supplement_reminders_enabled ? 1 : 0;
          }
          if (settings.study_notifications_enabled !== undefined) {
            existingSettings.study_notifications_enabled = settings.study_notifications_enabled ? 1 : 0;
          }
          if (settings.sleep_reminders_enabled !== undefined) {
            existingSettings.sleep_reminders_enabled = settings.sleep_reminders_enabled ? 1 : 0;
          }
          if (settings.sleep_reminder_type !== undefined) {
            existingSettings.sleep_reminder_type = settings.sleep_reminder_type;
          }
          if (settings.sleep_reminder_time !== undefined) {
            existingSettings.sleep_reminder_time = settings.sleep_reminder_time;
          }
          if (settings.sleep_reminder_hours !== undefined) {
            existingSettings.sleep_reminder_hours = settings.sleep_reminder_hours;
          }
        }
      }
    );
  } catch (error) {
    console.error('Failed to update notification settings:', error);
    // Don't throw - allow app to continue without updating settings
  }
};

// Schedule a local notification
export const scheduleNotification = async (
  type: NotificationRecord['type'],
  relatedId: number,
  scheduledTime: number,
  title: string,
  body: string,
  data?: any
): Promise<string | null> => {
  try {
    const settings = await getNotificationSettings();
    
    // Check if notifications are enabled globally
    if (!settings.notifications_enabled) {
      return null;
    }
    
    // Check type-specific settings
    if (type === 'supplement_reminder' && !settings.supplement_reminders_enabled) {
      return null;
    }
    
    if (type === 'study_protocol' && !settings.study_notifications_enabled) {
      return null;
    }
    
    if (type === 'sleep_reminder' && !settings.sleep_reminders_enabled) {
      return null;
    }
    
    // Don't schedule notifications in the past (with 1 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    if (scheduledTime <= now + 60) {
      console.log('Skipping notification scheduled for the past:', title);
      return null;
    }
    
    // Check if running in Expo Go
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.log('Expo Go detected - local notifications only');
    }
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(scheduledTime * 1000),
      },
    });
    
    // Store notification record in database
    await withDatabase(
      async (db) => {
        await db.runAsync(
          'INSERT INTO notification_records (notification_id, type, related_id, scheduled_time, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            notificationId,
            type,
            relatedId,
            scheduledTime,
            title,
            body,
            data ? JSON.stringify(data) : null,
            now
          ]
        );
      },
      'scheduleNotification-storeRecord',
      async () => {
        // Fallback mode - store in memory
        addFallbackData('notification_records', {
          notification_id: notificationId,
          type,
          related_id: relatedId,
          scheduled_time: scheduledTime,
          title,
          body,
          data: data ? JSON.stringify(data) : null,
          created_at: now,
          cancelled: 0
        });
      }
    );
    
    console.log(`Scheduled ${type} notification:`, title, 'at', new Date(scheduledTime * 1000));
    return notificationId;
  } catch (error) {
    console.error('Failed to schedule notification:', error);
    return null;
  }
};

// Cancel notifications by related ID and type
export const cancelNotificationsByRelatedId = async (type: NotificationRecord['type'], relatedId: number): Promise<void> => {
  try {
    await withDatabase(
      async (db) => {
        // Get notification IDs to cancel
        const notifications = await db.getAllAsync(
          'SELECT notification_id FROM notification_records WHERE type = ? AND related_id = ? AND cancelled = 0',
          [type, relatedId]
        );
        
        // Cancel each notification
        for (const notification of notifications) {
          try {
            await Notifications.cancelScheduledNotificationAsync((notification as any).notification_id);
          } catch (error) {
            console.error('Failed to cancel notification:', error);
          }
        }
        
        // Mark as cancelled in database
        await db.runAsync(
          'UPDATE notification_records SET cancelled = 1 WHERE type = ? AND related_id = ? AND cancelled = 0',
          [type, relatedId]
        );
        
        console.log(`Cancelled ${notifications.length} notifications for ${type} ${relatedId}`);
      },
      'cancelNotificationsByRelatedId',
      async () => {
        // Fallback mode
        const records = getFallbackData('notification_records');
        const notificationsToCancel = records.filter((record: any) => 
          record.type === type && record.related_id === relatedId && !record.cancelled
        );
        
        // Cancel each notification
        for (const notification of notificationsToCancel) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notification.notification_id);
          } catch (error) {
            console.error('Failed to cancel notification:', error);
          }
          
          // Mark as cancelled in fallback data
          notification.cancelled = 1;
        }
        
        console.log(`Cancelled ${notificationsToCancel.length} notifications for ${type} ${relatedId}`);
      }
    );
  } catch (error) {
    console.error('Failed to cancel notifications by related ID:', error);
    // Don't throw - allow app to continue
  }
};

// Cancel all notifications
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await withDatabase(
      async (db) => {
        try {
          await Notifications.cancelAllScheduledNotificationsAsync();
          await db.runAsync('UPDATE notification_records SET cancelled = 1 WHERE cancelled = 0');
          console.log('Cancelled all notifications');
        } catch (error) {
          console.error('Failed to cancel all notifications:', error);
        }
      },
      'cancelAllNotifications',
      async () => {
        // Fallback mode
        try {
          await Notifications.cancelAllScheduledNotificationsAsync();
          
          // Mark all as cancelled in fallback data
          const records = getFallbackData('notification_records');
          records.forEach((record: any) => {
            record.cancelled = 1;
          });
          
          console.log('Cancelled all notifications (fallback mode)');
        } catch (expoError) {
          console.error('Failed to cancel expo notifications:', expoError);
        }
      }
    );
  } catch (error) {
    console.error('Failed to access database for cancelling notifications:', error);
    // Still try to cancel expo notifications even if database fails
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('Cancelled expo notifications (database unavailable)');
    } catch (expoError) {
      console.error('Failed to cancel expo notifications:', expoError);
    }
  }
};

// Get pending notifications
export const getPendingNotifications = async (): Promise<NotificationRecord[]> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    return await withDatabase(
      async (db) => {
        const result = await db.getAllAsync(
          'SELECT * FROM notification_records WHERE scheduled_time > ? AND cancelled = 0 ORDER BY scheduled_time ASC',
          [now]
        );
        
        return result as NotificationRecord[];
      },
      'getPendingNotifications',
      async () => {
        // Fallback mode
        const records = getFallbackData('notification_records');
        return records
          .filter((record: any) => record.scheduled_time > now && !record.cancelled)
          .sort((a: any, b: any) => a.scheduled_time - b.scheduled_time);
      }
    );
  } catch (error) {
    console.error('Failed to get pending notifications:', error);
    return []; // Return empty array if database is not available
  }
};

// Clean up old notification records (older than 7 days)
export const cleanupOldNotificationRecords = async (): Promise<void> => {
  try {
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
    
    await withDatabase(
      async (db) => {
        await db.runAsync(
          'DELETE FROM notification_records WHERE created_at < ? AND (cancelled = 1 OR scheduled_time < ?)',
          [sevenDaysAgo, sevenDaysAgo]
        );
        
        console.log('Cleaned up old notification records');
      },
      'cleanupOldNotificationRecords',
      async () => {
        // Fallback mode
        const records = getFallbackData('notification_records');
        const filteredRecords = records.filter((record: any) => {
          return !(record.created_at < sevenDaysAgo && (record.cancelled || record.scheduled_time < sevenDaysAgo));
        });
        
        // Replace the array contents
        records.length = 0;
        records.push(...filteredRecords);
        
        console.log('Cleaned up old notification records (fallback mode)');
      }
    );
  } catch (error) {
    console.error('Failed to cleanup old notification records:', error);
    // Don't throw - this is not critical for app functionality
  }
};

// Test notification (for settings screen)
export const sendTestNotification = async (): Promise<void> => {
  try {
    // Check if running in Expo Go
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    if (isExpoGo) {
      console.log('Test notification in Expo Go - local only');
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'NeuroSync Test',
        body: 'Notifications are working correctly!',
        data: { test: true },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    
    console.log('Test notification scheduled');
  } catch (error) {
    console.error('Failed to send test notification:', error);
    throw error;
  }
};

// Get notification statistics
export const getNotificationStats = async (): Promise<{
  pending: number;
  cancelled: number;
  total: number;
}> => {
  try {
    const now = Math.floor(Date.now() / 1000);
    
    return await withDatabase(
      async (db) => {
        const pending = await db.getFirstAsync(
          'SELECT COUNT(*) as count FROM notification_records WHERE scheduled_time > ? AND cancelled = 0',
          [now]
        );
        
        const cancelled = await db.getFirstAsync(
          'SELECT COUNT(*) as count FROM notification_records WHERE cancelled = 1'
        );
        
        const total = await db.getFirstAsync(
          'SELECT COUNT(*) as count FROM notification_records'
        );
        
        return {
          pending: (pending as any)?.count || 0,
          cancelled: (cancelled as any)?.count || 0,
          total: (total as any)?.count || 0
        };
      },
      'getNotificationStats',
      async () => {
        // Fallback mode
        const records = getFallbackData('notification_records');
        
        const pending = records.filter((record: any) => record.scheduled_time > now && !record.cancelled).length;
        const cancelled = records.filter((record: any) => record.cancelled).length;
        const total = records.length;
        
        return {
          pending,
          cancelled,
          total
        };
      }
    );
  } catch (error) {
    console.error('Failed to get notification statistics:', error);
    // Return zero stats if database is not available
    return {
      pending: 0,
      cancelled: 0,
      total: 0
    };
  }
};