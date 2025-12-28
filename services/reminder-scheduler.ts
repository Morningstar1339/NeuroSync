import { openDatabase } from '@/database/database';
import { scheduleNotification, cancelNotificationsByRelatedId } from '@/database/notifications';

// Schedule supplement reminder notifications
export const scheduleSupplementReminders = async (supplementId: number): Promise<void> => {
  const db = await openDatabase();
  
  // Get supplement details
  const supplement = await db.getFirstAsync(
    'SELECT * FROM supplements WHERE id = ?',
    [supplementId]
  );
  
  if (!supplement) {
    throw new Error('Supplement not found');
  }
  
  // Get active schedules for this supplement
  const schedules = await db.getAllAsync(
    'SELECT * FROM schedules WHERE supplement_id = ? AND enabled = 1',
    [supplementId]
  );
  
  if (schedules.length === 0) {
    console.log(`No active schedules found for supplement ${(supplement as any).name}`);
    return;
  }
  
  // Cancel existing notifications for this supplement
  await cancelNotificationsByRelatedId('supplement_reminder', supplementId);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (const schedule of schedules) {
    const scheduleData = schedule as any;
    const time = scheduleData.time; // Format: "HH:MM"
    const repeatInterval = scheduleData.repeat_interval; // "daily", "weekly", etc.
    
    // Parse time
    const [hours, minutes] = time.split(':').map(Number);
    
    // Calculate upcoming notification times
    const notificationTimes = calculateUpcomingTimes(today, hours, minutes, repeatInterval);
    
    for (const notificationTime of notificationTimes) {
      const scheduledTimestamp = Math.floor(notificationTime.getTime() / 1000);
      
      const title = (supplement as any).name;
      const body = `${(supplement as any).default_dosage} ${(supplement as any).dosage_unit}`;
      
      const data = {
        type: 'supplement_reminder',
        supplementId: supplementId,
        supplementName: (supplement as any).name,
        dosage: (supplement as any).default_dosage,
        dosageUnit: (supplement as any).dosage_unit,
        iconId: (supplement as any).icon_id,
        color: (supplement as any).color
      };
      
      await scheduleNotification(
        'supplement_reminder',
        supplementId,
        scheduledTimestamp,
        title,
        body,
        data
      );
    }
  }
  
  console.log(`Scheduled reminders for supplement: ${(supplement as any).name}`);
};

// Calculate upcoming notification times for the next 30 days
function calculateUpcomingTimes(baseDate: Date, hours: number, minutes: number, repeatInterval: string): Date[] {
  const times: Date[] = [];
  const now = new Date();
  
  for (let day = 0; day < 30; day++) {
    const notificationDate = new Date(baseDate);
    notificationDate.setDate(baseDate.getDate() + day);
    notificationDate.setHours(hours, minutes, 0, 0);
    
    // Skip past times
    if (notificationDate <= now) {
      continue;
    }
    
    // Handle different repeat intervals
    switch (repeatInterval?.toLowerCase() ?? 'daily') {
      case 'daily':
        times.push(new Date(notificationDate));
        break;
      
      case 'weekly':
        if (day % 7 === 0) {
          times.push(new Date(notificationDate));
        }
        break;
      
      case 'weekdays':
        const dayOfWeek = notificationDate.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
          times.push(new Date(notificationDate));
        }
        break;
      
      case 'weekends':
        const weekendDay = notificationDate.getDay();
        if (weekendDay === 0 || weekendDay === 6) { // Saturday or Sunday
          times.push(new Date(notificationDate));
        }
        break;
      
      default:
        // Default to daily
        times.push(new Date(notificationDate));
        break;
    }
  }
  
  return times;
}

// Reschedule all supplement reminders
export const rescheduleAllSupplementReminders = async (): Promise<void> => {
  const db = await openDatabase();
  
  // Get all supplements with schedules enabled
  const supplements = await db.getAllAsync(
    'SELECT DISTINCT s.id FROM supplements s JOIN schedules sch ON s.id = sch.supplement_id WHERE sch.enabled = 1'
  );
  
  console.log(`Rescheduling reminders for ${supplements.length} supplements`);
  
  for (const supplement of supplements) {
    try {
      await scheduleSupplementReminders((supplement as any).id);
    } catch (error) {
      console.error(`Failed to schedule reminders for supplement ${(supplement as any).id}:`, error);
    }
  }
};

// Schedule event-based study notifications after supplement logging
export const scheduleEventBasedStudyNotifications = async (supplementId: number, supplementLogId: number): Promise<void> => {
  const db = await openDatabase();
  
  // Get supplement name
  const supplement = await db.getFirstAsync(
    'SELECT name FROM supplements WHERE id = ?',
    [supplementId]
  );
  
  if (!supplement) {
    console.error('Supplement not found for event-based study notifications');
    return;
  }
  
  // Get event-based study protocols for this supplement
  const protocols = await db.getAllAsync(
    'SELECT * FROM study_protocols WHERE supplement_id = ? AND schedule_type = ?',
    [supplementId, 'event_based']
  );
  
  if (protocols.length === 0) {
    console.log(`No event-based study protocols found for supplement ${(supplement as any).name}`);
    return;
  }
  
  const baseTime = Math.floor(Date.now() / 1000);
  const supplementName = (supplement as any).name;
  
  for (const protocol of protocols) {
    const protocolData = protocol as any;
    const intervalMinutes = protocolData.interval_minutes;
    const durationMinutes = protocolData.duration_minutes;
    const testType = protocolData.test_type;
    
    // Schedule notifications at intervals for the duration
    const numNotifications = Math.floor(durationMinutes / intervalMinutes);
    
    for (let i = 0; i < numNotifications; i++) {
      const notificationTime = baseTime + (i * intervalMinutes * 60);
      
      const title = `Time for ${testType} test`;
      const body = `${supplementName} study - Tap to begin test`;
      
      const data = {
        type: 'study_protocol',
        studyProtocolId: protocolData.id,
        supplementLogId: supplementLogId,
        testType: testType,
        supplementName: supplementName,
        studyType: 'event_based'
      };
      
      await scheduleNotification(
        'study_protocol',
        protocolData.id,
        notificationTime,
        title,
        body,
        data
      );
    }
  }
  
  console.log(`Scheduled event-based study notifications for ${supplementName}`);
};

// Schedule daily study protocol notifications
export const scheduleBasedStudyNotifications = async (): Promise<void> => {
  const db = await openDatabase();
  
  // Get schedule-based study protocols
  const protocols = await db.getAllAsync(
    'SELECT sp.*, s.name as supplement_name FROM study_protocols sp LEFT JOIN supplements s ON sp.supplement_id = s.id WHERE sp.schedule_type = ?',
    ['daily_schedule']
  );
  
  if (protocols.length === 0) {
    console.log('No schedule-based study protocols found');
    return;
  }
  
  // Cancel existing schedule-based notifications
  for (const protocol of protocols) {
    await cancelNotificationsByRelatedId('study_protocol', (protocol as any).id);
  }
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (const protocol of protocols) {
    const protocolData = protocol as any;
    
    // Parse parameters to get scheduled times
    let scheduledTimes: string[] = [];
    try {
      if (protocolData.parameters) {
        const params = JSON.parse(protocolData.parameters);
        scheduledTimes = params.scheduled_times || [];
      }
    } catch (error) {
      console.error('Failed to parse study protocol parameters:', error);
      continue;
    }
    
    if (scheduledTimes.length === 0) {
      console.log(`No scheduled times found for protocol ${protocolData.id}`);
      continue;
    }
    
    // Schedule notifications for the next 30 days
    for (let day = 0; day < 30; day++) {
      for (const timeString of scheduledTimes) {
        const [hours, minutes] = timeString.split(':').map(Number);
        
        const notificationDate = new Date(today);
        notificationDate.setDate(today.getDate() + day);
        notificationDate.setHours(hours, minutes, 0, 0);
        
        // Skip past times
        if (notificationDate <= now) {
          continue;
        }
        
        const scheduledTimestamp = Math.floor(notificationDate.getTime() / 1000);
        
        const title = `Time for ${protocolData.test_type} test`;
        const body = protocolData.supplement_name 
          ? `${protocolData.supplement_name} study - Tap to begin test`
          : 'Daily cognitive test - Tap to begin';
        
        const data = {
          type: 'study_protocol',
          studyProtocolId: protocolData.id,
          testType: protocolData.test_type,
          supplementName: protocolData.supplement_name,
          studyType: 'daily_schedule'
        };
        
        await scheduleNotification(
          'study_protocol',
          protocolData.id,
          scheduledTimestamp,
          title,
          body,
          data
        );
      }
    }
  }
  
  console.log(`Scheduled notifications for ${protocols.length} schedule-based study protocols`);
};

// Schedule sleep reminder notifications
export const scheduleSleepReminders = async (): Promise<void> => {
  const { getNotificationSettings } = await import('@/database/notifications');
  const settings = await getNotificationSettings();
  
  if (!settings.sleep_reminders_enabled) {
    console.log('Sleep reminders are disabled');
    return;
  }
  
  // Cancel existing sleep reminders
  await cancelNotificationsByRelatedId('sleep_reminder', 0);
  
  if (settings.sleep_reminder_type === 'time_based' && settings.sleep_reminder_time) {
    await scheduleTimeBasedSleepReminders(settings.sleep_reminder_time);
  } else if (settings.sleep_reminder_type === 'duration_based' && settings.sleep_reminder_hours) {
    await scheduleDurationBasedSleepReminders(settings.sleep_reminder_hours);
  }
};

// Schedule time-based sleep reminders
async function scheduleTimeBasedSleepReminders(reminderTime: string): Promise<void> {
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Schedule for the next 30 days
  for (let day = 0; day < 30; day++) {
    const reminderDate = new Date(today);
    reminderDate.setDate(today.getDate() + day);
    reminderDate.setHours(hours, minutes, 0, 0);
    
    // Skip past times
    if (reminderDate <= now) {
      continue;
    }
    
    const scheduledTimestamp = Math.floor(reminderDate.getTime() / 1000);
    
    const title = 'Bedtime Reminder';
    const body = 'Time to consider going to sleep for optimal recovery';
    
    const data = {
      type: 'sleep_reminder',
      reminderType: 'time_based'
    };
    
    await scheduleNotification(
      'sleep_reminder',
      0, // Use 0 as related_id for sleep reminders
      scheduledTimestamp,
      title,
      body,
      data
    );
  }
  
  console.log(`Scheduled time-based sleep reminders for ${reminderTime}`);
}

// Schedule activity reminder notifications
export const scheduleActivityReminders = async (activityId?: number): Promise<void> => {
  const db = await openDatabase();
  
  let query = 'SELECT * FROM schedules WHERE schedule_type = ? AND enabled = 1';
  const params: any[] = ['activity'];
  
  if (activityId) {
    query += ' AND activity_id = ?';
    params.push(activityId);
  }
  
  const schedules = await db.getAllAsync(query, params);
  
  if (schedules.length === 0) {
    console.log('No active activity schedules found');
    return;
  }
  
  for (const schedule of schedules) {
    const scheduleData = schedule as any;
    
    const activity = await db.getFirstAsync(
      'SELECT * FROM activities WHERE id = ?',
      [scheduleData.activity_id]
    );
    
    if (!activity) continue;
    
    await cancelNotificationsByRelatedId('activity_reminder', scheduleData.activity_id);
    
    const time = scheduleData.time;
    const [hours, minutes] = time.split(':').map(Number);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let notificationDates: Date[] = [];
    try {
      const parsed = JSON.parse(scheduleData.days);
      if (parsed && typeof parsed === 'object' && 'interval' in parsed) {
        const interval = parsed.interval;
        const startDateTimestamp = scheduleData.start_date;
        let baseDate: Date;
        
        if (startDateTimestamp) {
          baseDate = new Date(startDateTimestamp * 1000);
          baseDate.setHours(hours, minutes, 0, 0);
          console.log(`[scheduleActivityReminders] Using start_date: ${baseDate.toLocaleDateString()}, interval: ${interval}`);
        } else {
          baseDate = new Date(today);
          baseDate.setHours(hours, minutes, 0, 0);
          console.log(`[scheduleActivityReminders] No start_date, using today, interval: ${interval}`);
        }
        
        for (let i = 0; i < 30; i++) {
          const candidateDate = new Date(baseDate);
          candidateDate.setDate(baseDate.getDate() + (i * interval));
          if (candidateDate > now && candidateDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
            notificationDates.push(candidateDate);
          }
        }
      } else {
        const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const days = parsed as string[];
        for (let day = 0; day < 30; day++) {
          const notificationDate = new Date(today);
          notificationDate.setDate(today.getDate() + day);
          notificationDate.setHours(hours, minutes, 0, 0);
          const dayOfWeek = notificationDate.getDay();
          const dayName = Object.keys(dayMap).find(k => dayMap[k] === dayOfWeek);
          if (dayName && days.includes(dayName) && notificationDate > now) {
            notificationDates.push(notificationDate);
          }
        }
      }
    } catch (e) {
      console.error('[scheduleActivityReminders] Failed to parse days:', e);
    }
    
    console.log(`[scheduleActivityReminders] Activity ${(activity as any).name}: ${notificationDates.length} notifications to schedule`);
    
    for (const notificationDate of notificationDates) {
      const scheduledTimestamp = Math.floor(notificationDate.getTime() / 1000);
      
      console.log(`[scheduleActivityReminders] Scheduling for: ${notificationDate.toLocaleString()}, trigger in ${Math.round((scheduledTimestamp - Math.floor(Date.now()/1000)) / 60)} minutes`);
      
      const title = `Activity Reminder: ${(activity as any).name}`;
      const body = `Log your ${(activity as any).name}`;
      
      const data = {
        type: 'activity_reminder',
        activityId: scheduleData.activity_id,
        activityName: (activity as any).name,
        defaultValue: (activity as any).default_value,
        unit: (activity as any).unit,
        iconId: (activity as any).icon_id,
        color: (activity as any).color
      };
      
      await scheduleNotification(
        'activity_reminder',
        scheduleData.activity_id,
        scheduledTimestamp,
        title,
        body,
        data
      );
    }
  }
  
  console.log('Scheduled activity reminders');
};

// Schedule daily review reminder notifications
export const scheduleDailyReviewReminders = async (): Promise<void> => {
  const db = await openDatabase();
  
  const schedules = await db.getAllAsync(
    'SELECT * FROM schedules WHERE schedule_type = ? AND enabled = 1',
    ['daily_review']
  );
  
  if (schedules.length === 0) {
    console.log('No active daily review schedules found');
    return;
  }
  
  await cancelNotificationsByRelatedId('daily_review_reminder', 0);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  for (const schedule of schedules) {
    const scheduleData = schedule as any;
    const time = scheduleData.time;
    const [hours, minutes] = time.split(':').map(Number);
    
    let notificationDates: Date[] = [];
    try {
      const parsed = JSON.parse(scheduleData.days);
      if (parsed && typeof parsed === 'object' && 'interval' in parsed) {
        const interval = parsed.interval;
        const startDateTimestamp = scheduleData.start_date;
        let baseDate: Date;
        
        if (startDateTimestamp) {
          baseDate = new Date(startDateTimestamp * 1000);
          baseDate.setHours(hours, minutes, 0, 0);
          console.log(`[scheduleDailyReviewReminders] Using start_date: ${baseDate.toLocaleDateString()}, interval: ${interval}`);
        } else {
          baseDate = new Date(today);
          baseDate.setHours(hours, minutes, 0, 0);
          console.log(`[scheduleDailyReviewReminders] No start_date, using today, interval: ${interval}`);
        }
        
        for (let i = 0; i < 30; i++) {
          const candidateDate = new Date(baseDate);
          candidateDate.setDate(baseDate.getDate() + (i * interval));
          if (candidateDate > now && candidateDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
            notificationDates.push(candidateDate);
          }
        }
      } else {
        const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const days = parsed as string[];
        for (let day = 0; day < 30; day++) {
          const notificationDate = new Date(today);
          notificationDate.setDate(today.getDate() + day);
          notificationDate.setHours(hours, minutes, 0, 0);
          const dayOfWeek = notificationDate.getDay();
          const dayName = Object.keys(dayMap).find(k => dayMap[k] === dayOfWeek);
          if (dayName && days.includes(dayName) && notificationDate > now) {
            notificationDates.push(notificationDate);
          }
        }
      }
    } catch (e) {
      console.error('[scheduleDailyReviewReminders] Failed to parse days:', e);
    }
    
    console.log(`[scheduleDailyReviewReminders] ${notificationDates.length} notifications to schedule`);
    
    for (const notificationDate of notificationDates) {
      const scheduledTimestamp = Math.floor(notificationDate.getTime() / 1000);
      
      console.log(`[scheduleDailyReviewReminders] Scheduling for: ${notificationDate.toLocaleString()}, trigger in ${Math.round((scheduledTimestamp - Math.floor(Date.now()/1000)) / 60)} minutes`);
      
      const title = 'Daily Review';
      const body = 'Time to reflect on your day';
      
      const data = {
        type: 'daily_review_reminder'
      };
      
      await scheduleNotification(
        'daily_review_reminder',
        0,
        scheduledTimestamp,
        title,
        body,
        data
      );
    }
  }
  
  console.log('Scheduled daily review reminders');
};

// Schedule duration-based sleep reminders (after last sleep)
async function scheduleDurationBasedSleepReminders(hours: number): Promise<void> {
  const db = await openDatabase();
  
  // Get the most recent sleep log
  const lastSleep = await db.getFirstAsync(
    'SELECT * FROM sleep_logs ORDER BY sleep_end DESC LIMIT 1'
  );
  
  if (!lastSleep) {
    console.log('No sleep logs found for duration-based reminders');
    return;
  }
  
  const lastSleepEnd = (lastSleep as any).sleep_end;
  const reminderTime = lastSleepEnd + (hours * 60 * 60); // Convert hours to seconds
  const now = Math.floor(Date.now() / 1000);
  
  // Only schedule if the reminder time is in the future
  if (reminderTime > now) {
    const title = 'Sleep Reminder';
    const body = `It's been ${hours} hours since your last sleep. Consider resting soon.`;
    
    const data = {
      type: 'sleep_reminder',
      reminderType: 'duration_based',
      hoursSinceLastSleep: hours
    };
    
    await scheduleNotification(
      'sleep_reminder',
      0,
      reminderTime,
      title,
      body,
      data
    );
    
    console.log(`Scheduled duration-based sleep reminder for ${new Date(reminderTime * 1000)}`);
  } else {
    console.log('Duration-based sleep reminder time has already passed');
  }
}