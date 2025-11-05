import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { 
  requestNotificationPermissions,
  cleanupOldNotificationRecords 
} from '@/database/notifications';
import { 
  rescheduleAllSupplementReminders,
  scheduleBasedStudyNotifications,
  scheduleSleepReminders 
} from './reminder-scheduler';

export class NotificationManager {
  private static instance: NotificationManager;
  private notificationListener: any;
  private responseListener: any;
  private appStateSubscription: any;
  private isExpoGo: boolean = false;
  private notificationsSupported: boolean = true;
  private isInitialized: boolean = false;
  private isDatabaseReady: boolean = false;
  private initializationFailed: boolean = false;

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  async initialize(isDatabaseReady: boolean = false): Promise<void> {
    console.log('Initializing NotificationManager...', { isDatabaseReady });
    
    // If already failed, don't try again
    if (this.initializationFailed) {
      console.log('NotificationManager initialization previously failed - skipping');
      return;
    }
    
    // If already initialized, don't do it again
    if (this.isInitialized) {
      console.log('NotificationManager already initialized');
      return;
    }
    
    try {
      this.isDatabaseReady = isDatabaseReady;
      
      // Check if running in Expo Go
      this.isExpoGo = Constants.executionEnvironment === 'storeClient';
      
      if (this.isExpoGo) {
        console.log('Running in Expo Go - push notifications disabled');
        this.notificationsSupported = false;
        // Still allow local notifications in Expo Go
      }
      
      // Request permissions with error handling
      await this.requestPermissions();
      
      // Set up notification handlers with error handling
      this.setupNotificationHandlers();
      
      // Set up listeners with error handling
      this.setupListeners();
      
      // Only do database operations if database is ready
      if (this.isDatabaseReady) {
        // Clean up old records
        await this.safeCleanupOldRecords();
        
        // Initial scheduling with error handling
        await this.scheduleInitialNotifications();
      } else {
        console.log('Database not ready - skipping database-dependent operations');
      }
      
      this.isInitialized = true;
      console.log('NotificationManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationManager:', error);
      this.notificationsSupported = false;
      this.initializationFailed = true;
      // Don't throw - allow app to continue without notifications
    }
  }

  private async requestPermissions(): Promise<void> {
    try {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        console.log('Notification permissions not granted');
      }
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
    }
  }

  private setupNotificationHandlers(): void {
    try {
      // Configure how notifications are handled when app is in foreground
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (error) {
      console.error('Failed to setup notification handlers:', error);
      this.notificationsSupported = false;
    }
  }

  private setupListeners(): void {
    try {
      // Listen for notifications while app is running
      this.notificationListener = Notifications.addNotificationReceivedListener(
        this.handleNotificationReceived.bind(this)
      );

      // Listen for user tapping notifications
      this.responseListener = Notifications.addNotificationResponseReceivedListener(
        this.handleNotificationResponse.bind(this)
      );

      // Listen for app state changes
      this.appStateSubscription = AppState.addEventListener(
        'change',
        this.handleAppStateChange.bind(this)
      );
    } catch (error) {
      console.error('Failed to setup notification listeners:', error);
      this.notificationsSupported = false;
    }
  }

  private handleNotificationReceived(notification: Notifications.Notification): void {
    console.log('Notification received:', notification.request.content.title);
    
    // Update badge count (could be enhanced to show actual pending tests)
    const data = notification.request.content.data;
    if (data?.type === 'study_protocol') {
      this.updateBadgeCount();
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    console.log('Notification tapped:', response.notification.request.content.title);
    
    const data = response.notification.request.content.data;
    
    // Handle deep linking based on notification type
    switch (data?.type) {
      case 'supplement_reminder':
        await this.handleSupplementReminderTap(data);
        break;
      
      case 'study_protocol':
        await this.handleStudyProtocolTap(data);
        break;
      
      case 'sleep_reminder':
        await this.handleSleepReminderTap(data);
        break;
      
      default:
        console.log('Unknown notification type:', data?.type);
        break;
    }
  }

  private async handleSupplementReminderTap(data: any): Promise<void> {
    try {
      // Navigate to supplement logging screen for the specific supplement
      router.push({
        pathname: '/log-supplement',
        params: {
          id: data.supplementId?.toString(),
          name: data.supplementName,
          default_dosage: data.dosage?.toString(),
          dosage_unit: data.dosageUnit,
          icon_id: data.iconId || 'medical',
          color: data.color || '#007AFF',
          schedule_enabled: 'true',
          study_enabled: 'false'
        }
      });
    } catch (error) {
      console.error('Failed to handle supplement reminder tap:', error);
      // Fallback to supplements list
      router.push('/supplements');
    }
  }

  private async handleStudyProtocolTap(data: any): Promise<void> {
    try {
      const testType = data.testType;
      
      // Navigate to the appropriate cognitive test
      switch (testType) {
        case 'reflexes':
          router.push('/tests/reflexes');
          break;
        case 'memory':
          router.push('/tests/memory');
          break;
        case 'judgment':
          router.push('/tests/connections');
          break;
        default:
          // Fallback to cognitive tests menu
          router.push('/cognitive-tests');
          break;
      }
    } catch (error) {
      console.error('Failed to handle study protocol tap:', error);
      // Fallback to cognitive tests menu
      router.push('/cognitive-tests');
    }
  }

  private async handleSleepReminderTap(data: any): Promise<void> {
    try {
      // Navigate to sleep logs or settings
      router.push('/sleep-logs');
    } catch (error) {
      console.error('Failed to handle sleep reminder tap:', error);
      // Fallback to home screen
      router.push('/');
    }
  }

  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    console.log('App state changed to:', nextAppState);
    
    if (nextAppState === 'active') {
      // App became active - reschedule any missed notifications
      await this.rescheduleOnAppActive();
    } else if (nextAppState === 'background') {
      // App went to background - clean up and prepare for potential termination
      await this.prepareForBackground();
    }
  }

  private async rescheduleOnAppActive(): Promise<void> {
    if (!this.isNotificationSupported() || !this.isDatabaseReady) {
      console.log('Skipping reschedule - notifications not supported or database not ready');
      return;
    }
    
    try {
      // Clean up old notification records
      await this.safeCleanupOldRecords();
      
      // Reschedule sleep reminders (they might need updating based on new sleep data)
      await scheduleSleepReminders();
      
      console.log('Rescheduled notifications on app active');
    } catch (error) {
      console.error('Failed to reschedule notifications on app active:', error);
      // Don't disable notifications for this error - it might be temporary
    }
  }

  private async prepareForBackground(): Promise<void> {
    if (!this.isNotificationSupported() || !this.isDatabaseReady) {
      console.log('Skipping background prep - notifications not supported or database not ready');
      return;
    }
    
    try {
      // Clean up old notification records before going to background
      await this.safeCleanupOldRecords();
      
      console.log('Prepared for background mode');
    } catch (error) {
      console.error('Failed to prepare for background:', error);
      // Android-specific error handling - don't crash the app
      if (error instanceof Error && error.message.includes('NullPointerException')) {
        console.warn('Android NotificationManager NullPointerException - disabling background notifications');
        // Continue normally but don't try database operations in background anymore
      }
    }
  }

  private async updateBadgeCount(): Promise<void> {
    try {
      if (!this.notificationsSupported) {
        return;
      }
      // For now, just clear the badge when app is active
      // In a more sophisticated implementation, you could count pending study tests
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  }

  private async scheduleInitialNotifications(): Promise<void> {
    try {
      if (!this.notificationsSupported || !this.isDatabaseReady) {
        console.log('Notifications not supported or database not ready - skipping scheduling');
        return;
      }
      
      console.log('Scheduling initial notifications...');
      
      // Schedule supplement reminders
      await rescheduleAllSupplementReminders();
      
      // Schedule study protocol notifications
      await scheduleBasedStudyNotifications();
      
      // Schedule sleep reminders
      await scheduleSleepReminders();
      
      console.log('Initial notification scheduling complete');
    } catch (error) {
      console.error('Failed to schedule initial notifications:', error);
      // Don't disable notifications for scheduling errors - they might be temporary
    }
  }

  private async safeCleanupOldRecords(): Promise<void> {
    if (!this.isDatabaseReady) {
      console.log('Database not ready - skipping cleanup');
      return;
    }
    
    try {
      await cleanupOldNotificationRecords();
    } catch (error) {
      console.error('Failed to cleanup old notification records:', error);
      // Don't throw - this is not critical
    }
  }

  async rescheduleAllNotifications(): Promise<void> {
    if (!this.notificationsSupported || !this.isDatabaseReady) {
      console.log('Notifications not supported or database not ready - skipping reschedule');
      return;
    }
    await this.scheduleInitialNotifications();
  }

  // Method to set database ready status after database initialization
  public setDatabaseReady(): void {
    console.log('NotificationManager: Database is now ready');
    this.isDatabaseReady = true;
    
    // If we're already initialized but missed database operations, do them now
    if (this.isInitialized && this.notificationsSupported) {
      this.performDelayedDatabaseOperations();
    }
  }

  private async performDelayedDatabaseOperations(): Promise<void> {
    try {
      console.log('Performing delayed database operations...');
      
      // Clean up old records
      await this.safeCleanupOldRecords();
      
      // Initial scheduling
      await this.scheduleInitialNotifications();
      
      console.log('Delayed database operations completed');
    } catch (error) {
      console.error('Failed to perform delayed database operations:', error);
    }
  }

  // Public method to check if notifications are supported
  public isNotificationSupported(): boolean {
    return this.notificationsSupported;
  }

  // Public method to check if running in Expo Go
  public isRunningInExpoGo(): boolean {
    return this.isExpoGo;
  }

  cleanup(): void {
    console.log('Cleaning up NotificationManager...');
    
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

// Singleton instance
export const notificationManager = NotificationManager.getInstance();