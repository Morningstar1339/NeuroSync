import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View, Alert, ScrollView, Switch } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  getNotificationSettings, 
  updateNotificationSettings, 
  requestNotificationPermissions,
  sendTestNotification,
  getNotificationStats,
  NotificationSettings 
} from '@/database/notifications';
import { 
  rescheduleAllSupplementReminders,
  scheduleBasedStudyNotifications,
  scheduleSleepReminders 
} from '@/services/reminder-scheduler';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  
  const [settings, setSettings] = useState<NotificationSettings>({
    notifications_enabled: true,
    supplement_reminders_enabled: true,
    study_notifications_enabled: true,
    sleep_reminders_enabled: true,
    sleep_reminder_type: 'duration_based',
    sleep_reminder_hours: 16
  });
  
  const [stats, setStats] = useState({ pending: 0, cancelled: 0, total: 0 });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
    checkPermissions();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await getNotificationSettings();
      setSettings(currentSettings);
      
      // Set temp time for picker
      if (currentSettings.sleep_reminder_time) {
        const [hours, minutes] = currentSettings.sleep_reminder_time.split(':').map(Number);
        const time = new Date();
        time.setHours(hours, minutes, 0, 0);
        setTempTime(time);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      const notificationStats = await getNotificationStats();
      setStats(notificationStats);
    } catch (error) {
      console.error('Failed to load notification stats:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const granted = await requestNotificationPermissions();
      setPermissionGranted(granted);
    } catch (error) {
      console.error('Failed to check notification permissions:', error);
    }
  };

  const handleHomePress = () => {
    router.push('/');
  };

  const updateSetting = async (key: keyof NotificationSettings, value: any) => {
    try {
      setIsLoading(true);
      
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      
      await updateNotificationSettings({ [key]: value });
      
      // Reschedule notifications if global settings changed
      if (key === 'notifications_enabled' && value) {
        await rescheduleAllNotifications();
      } else if (key === 'supplement_reminders_enabled' && value) {
        await rescheduleAllSupplementReminders();
      } else if (key === 'study_notifications_enabled' && value) {
        await scheduleBasedStudyNotifications();
      } else if (key.startsWith('sleep_reminder') && settings.sleep_reminders_enabled) {
        await scheduleSleepReminders();
      }
      
      await loadStats();
    } catch (error) {
      console.error('Failed to update setting:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const rescheduleAllNotifications = async () => {
    try {
      setIsLoading(true);
      await rescheduleAllSupplementReminders();
      await scheduleBasedStudyNotifications();
      await scheduleSleepReminders();
      await loadStats();
    } catch (error) {
      console.error('Failed to reschedule notifications:', error);
      Alert.alert('Error', 'Failed to reschedule notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      if (!permissionGranted) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Please enable notifications in your device settings to test notifications.'
          );
          return;
        }
        setPermissionGranted(true);
      }
      
      await sendTestNotification();
      Alert.alert('Test Sent', 'A test notification should appear shortly!');
    } catch (error) {
      console.error('Failed to send test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const granted = await requestNotificationPermissions();
      setPermissionGranted(granted);
      
      if (granted) {
        Alert.alert('Success', 'Notification permissions granted!');
        await rescheduleAllNotifications();
      } else {
        Alert.alert(
          'Permission Denied',
          'Notification permissions are required for reminders to work. Please enable them in your device settings.'
        );
      }
    } catch (error) {
      console.error('Failed to request permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions');
    }
  };

  const handleTimePickerChange = (event: any, selectedTime?: Date) => {
    void event;
	setShowTimePicker(false);
    
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      setTempTime(selectedTime);
      updateSetting('sleep_reminder_time', timeString);
    }
  };

  const formatTime = (timeString?: string): string => {
    if (!timeString) return 'Not set';
    
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ThemedView style={styles.container} safeArea>
      <ThemedView style={styles.header}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleHomePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="home-outline" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Notification Settings</ThemedText>
        <View style={styles.headerPlaceholder} />
      </ThemedView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Permission Status */}
        <ThemedView style={[styles.section, !permissionGranted && styles.warningSection]}>
          <View style={styles.sectionHeader}>
            <Ionicons 
              name={permissionGranted ? "checkmark-circle" : "warning"} 
              size={24} 
              color={permissionGranted ? "#34C759" : "#FF9500"} 
            />
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Permission Status
            </ThemedText>
          </View>
          
          <ThemedText style={styles.sectionDescription}>
            {permissionGranted 
              ? 'Notifications are enabled and working properly'
              : 'Notification permissions are required for reminders to work'
            }
          </ThemedText>
          
          {!permissionGranted && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: tintColor }]}
              onPress={handleRequestPermissions}
            >
              <Ionicons name="notifications-outline" size={20} color="white" />
              <ThemedText style={styles.actionButtonText}>Enable Notifications</ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>

        {/* Global Settings */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Global Settings</ThemedText>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Enable Notifications</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Master switch for all notification types
              </ThemedText>
            </View>
            <Switch
              value={settings.notifications_enabled}
              onValueChange={(value) => updateSetting('notifications_enabled', value)}
              trackColor={{ false: '#767577', true: tintColor + '40' }}
              thumbColor={settings.notifications_enabled ? tintColor : '#f4f3f4'}
              disabled={isLoading}
            />
          </View>
        </ThemedView>

        {/* Supplement Reminders */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Supplement Reminders</ThemedText>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Supplement Reminders</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Notifications based on your supplement schedules
              </ThemedText>
            </View>
            <Switch
              value={settings.supplement_reminders_enabled}
              onValueChange={(value) => updateSetting('supplement_reminders_enabled', value)}
              trackColor={{ false: '#767577', true: tintColor + '40' }}
              thumbColor={settings.supplement_reminders_enabled ? tintColor : '#f4f3f4'}
              disabled={isLoading}
            />
          </View>
        </ThemedView>

        {/* Study Notifications */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Study Notifications</ThemedText>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Cognitive Test Reminders</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Notifications for scheduled cognitive tests
              </ThemedText>
            </View>
            <Switch
              value={settings.study_notifications_enabled}
              onValueChange={(value) => updateSetting('study_notifications_enabled', value)}
              trackColor={{ false: '#767577', true: tintColor + '40' }}
              thumbColor={settings.study_notifications_enabled ? tintColor : '#f4f3f4'}
              disabled={isLoading}
            />
          </View>
        </ThemedView>

        {/* Sleep Reminders */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Sleep Reminders</ThemedText>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <ThemedText style={styles.settingLabel}>Sleep Reminders</ThemedText>
              <ThemedText style={styles.settingDescription}>
                Notifications to help maintain good sleep habits
              </ThemedText>
            </View>
            <Switch
              value={settings.sleep_reminders_enabled}
              onValueChange={(value) => updateSetting('sleep_reminders_enabled', value)}
              trackColor={{ false: '#767577', true: tintColor + '40' }}
              thumbColor={settings.sleep_reminders_enabled ? tintColor : '#f4f3f4'}
              disabled={isLoading}
            />
          </View>

          {settings.sleep_reminders_enabled && (
            <>
              <View style={styles.subSection}>
                <ThemedText style={styles.subSectionTitle}>Reminder Type</ThemedText>
                
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    settings.sleep_reminder_type === 'time_based' && styles.radioOptionSelected
                  ]}
                  onPress={() => updateSetting('sleep_reminder_type', 'time_based')}
                >
                  <Ionicons
                    name={settings.sleep_reminder_type === 'time_based' ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={tintColor}
                  />
                  <View style={styles.radioContent}>
                    <ThemedText style={styles.radioLabel}>Fixed Time</ThemedText>
                    <ThemedText style={styles.radioDescription}>Remind me at a specific time each day</ThemedText>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    settings.sleep_reminder_type === 'duration_based' && styles.radioOptionSelected
                  ]}
                  onPress={() => updateSetting('sleep_reminder_type', 'duration_based')}
                >
                  <Ionicons
                    name={settings.sleep_reminder_type === 'duration_based' ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={tintColor}
                  />
                  <View style={styles.radioContent}>
                    <ThemedText style={styles.radioLabel}>Duration Based</ThemedText>
                    <ThemedText style={styles.radioDescription}>Remind me X hours after last sleep</ThemedText>
                  </View>
                </TouchableOpacity>
              </View>

              {settings.sleep_reminder_type === 'time_based' && (
                <View style={styles.subSection}>
                  <TouchableOpacity
                    style={[styles.timeButton, { borderColor: tintColor }]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <ThemedText style={styles.timeButtonLabel}>Reminder Time</ThemedText>
                    <ThemedText style={[styles.timeButtonValue, { color: tintColor }]}>
                      {formatTime(settings.sleep_reminder_time)}
                    </ThemedText>
                    <Ionicons name="time-outline" size={20} color={tintColor} />
                  </TouchableOpacity>
                </View>
              )}

              {settings.sleep_reminder_type === 'duration_based' && (
                <View style={styles.subSection}>
                  <ThemedText style={styles.subSectionTitle}>Hours After Last Sleep</ThemedText>
                  <View style={styles.durationOptions}>
                    {[12, 14, 16, 18, 20].map(hours => (
                      <TouchableOpacity
                        key={hours}
                        style={[
                          styles.durationOption,
                          { borderColor: tintColor },
                          settings.sleep_reminder_hours === hours && { backgroundColor: tintColor + '20' }
                        ]}
                        onPress={() => updateSetting('sleep_reminder_hours', hours)}
                      >
                        <ThemedText
                          style={[
                            styles.durationOptionText,
                            settings.sleep_reminder_hours === hours && { color: tintColor, fontWeight: '600' }
                          ]}
                        >
                          {hours}h
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ThemedView>

        {/* Statistics */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Statistics</ThemedText>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{stats.pending}</ThemedText>
              <ThemedText style={styles.statLabel}>Pending</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{stats.total}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Scheduled</ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Actions */}
        <ThemedView style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: tintColor }]}
            onPress={handleTestNotification}
            disabled={isLoading}
          >
            <Ionicons name="notifications-outline" size={20} color="white" />
            <ThemedText style={styles.actionButtonText}>Send Test Notification</ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={rescheduleAllNotifications}
            disabled={isLoading}
          >
            <Ionicons name="refresh-outline" size={20} color={tintColor} />
            <ThemedText style={[styles.actionButtonText, { color: tintColor }]}>
              {isLoading ? 'Rescheduling...' : 'Reschedule All'}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Time Picker */}
      {showTimePicker && (
        <View style={styles.timePickerContainer}>
          <DateTimePicker
            value={tempTime}
            mode="time"
            display="default"
            onChange={handleTimePickerChange}
          />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  homeButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  warningSection: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 15,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  subSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    opacity: 0.8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
    gap: 12,
  },
  radioOptionSelected: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  radioDescription: {
    fontSize: 13,
    opacity: 0.7,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderRadius: 8,
    gap: 10,
  },
  timeButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  timeButtonValue: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  durationOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    minWidth: 50,
    alignItems: 'center',
  },
  durationOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  scrollContent: {
    paddingBottom: 120, // Extra padding for time picker
  },
  bottomSpacing: {
    height: 80, // Increased spacing
  },
  timePickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
});