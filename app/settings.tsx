import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Dimensions, StatusBar, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendDelayedTestNotification, getNotificationDebugInfo, listScheduledNotifications, getNotificationSettings, updateNotificationSettings, scheduleBedtimeReminder, cancelBedtimeReminder } from '@/database/notifications';

const { height: screenHeight } = Dimensions.get('window');
const isSmallScreen = screenHeight < 700;
const isVerySmallScreen = screenHeight < 600;

interface SleepSettings {
  bedtimeHour: number; // 1-12
  bedtimeMinute: number; // 0, 5, 10, 15, etc.
  bedtimeAmPm: 'AM' | 'PM';
}

const SETTINGS_KEY = 'sleep_settings';

const defaultSettings: SleepSettings = {
  bedtimeHour: 10,
  bedtimeMinute: 0,
  bedtimeAmPm: 'PM',
};

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<SleepSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [bedtimeReminderEnabled, setBedtimeReminderEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    loadBedtimeReminderSetting();
  }, []);

  const loadBedtimeReminderSetting = async () => {
    try {
      const notifSettings = await getNotificationSettings();
      setBedtimeReminderEnabled(notifSettings.bedtime_reminder_enabled);
    } catch (error) {
      console.error('Error loading bedtime reminder setting:', error);
    }
  };

  const toggleBedtimeReminder = async (enabled: boolean) => {
    try {
      setBedtimeReminderEnabled(enabled);
      
      const hour24 = settings.bedtimeAmPm === 'PM' && settings.bedtimeHour !== 12
        ? settings.bedtimeHour + 12
        : settings.bedtimeAmPm === 'AM' && settings.bedtimeHour === 12
        ? 0
        : settings.bedtimeHour;
      const timeString = `${hour24.toString().padStart(2, '0')}:${settings.bedtimeMinute.toString().padStart(2, '0')}`;
      
      await updateNotificationSettings({
        bedtime_reminder_enabled: enabled,
        bedtime_reminder_time: timeString
      });
      
      if (enabled) {
        await scheduleBedtimeReminder();
        Alert.alert('Reminder Set', `You'll receive a bedtime reminder at ${formatBedtime()} daily.`);
      } else {
        await cancelBedtimeReminder();
      }
    } catch (error) {
      console.error('Error toggling bedtime reminder:', error);
      setBedtimeReminderEnabled(!enabled);
      Alert.alert('Error', 'Failed to update reminder setting.');
    }
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: SleepSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      
      if (bedtimeReminderEnabled) {
        const hour24 = newSettings.bedtimeAmPm === 'PM' && newSettings.bedtimeHour !== 12
          ? newSettings.bedtimeHour + 12
          : newSettings.bedtimeAmPm === 'AM' && newSettings.bedtimeHour === 12
          ? 0
          : newSettings.bedtimeHour;
        const timeString = `${hour24.toString().padStart(2, '0')}:${newSettings.bedtimeMinute.toString().padStart(2, '0')}`;
        
        await updateNotificationSettings({ bedtime_reminder_time: timeString });
        await scheduleBedtimeReminder();
      }
      
      Alert.alert('Settings Saved', 'Your bedtime has been updated.');
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const formatBedtime = (): string => {
    return `${settings.bedtimeHour}:${settings.bedtimeMinute.toString().padStart(2, '0')} ${settings.bedtimeAmPm}`;
  };

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // Generate minute options (0, 5, 10, 15, ..., 55)
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0}
      >
        <ThemedView style={styles.innerContainer}>
          {/* Fixed Header */}
          <ThemedView style={styles.header}>
            <ThemedText type="title" style={styles.title}>Sleep Settings</ThemedText>
            <ThemedText style={styles.subtitle}>
              Set your normal bedtime for automatic sleep detection
            </ThemedText>
          </ThemedView>

          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Normal Bedtime</ThemedText>
              <ThemedText style={styles.currentValue}>{formatBedtime()}</ThemedText>
              
              <ThemedView style={styles.timeSelector}>
                {/* Hour Dropdown */}
                <ThemedView style={styles.dropdownContainer}>
                  <ThemedText style={styles.dropdownLabel}>Hour</ThemedText>
                  <ScrollView 
                    style={styles.dropdown}
                    contentContainerStyle={styles.dropdownContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {hourOptions.map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[
                          styles.dropdownOption,
                          settings.bedtimeHour === hour && styles.dropdownOptionSelected
                        ]}
                        onPress={() => setSettings({...settings, bedtimeHour: hour})}
                      >
                        <ThemedText style={[
                          styles.dropdownOptionText,
                          settings.bedtimeHour === hour && styles.dropdownOptionTextSelected
                        ]}>
                          {hour}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </ThemedView>

                {/* Minute Dropdown */}
                <ThemedView style={styles.dropdownContainer}>
                  <ThemedText style={styles.dropdownLabel}>Minute</ThemedText>
                  <ScrollView 
                    style={styles.dropdown}
                    contentContainerStyle={styles.dropdownContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {minuteOptions.map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[
                          styles.dropdownOption,
                          settings.bedtimeMinute === minute && styles.dropdownOptionSelected
                        ]}
                        onPress={() => setSettings({...settings, bedtimeMinute: minute})}
                      >
                        <ThemedText style={[
                          styles.dropdownOptionText,
                          settings.bedtimeMinute === minute && styles.dropdownOptionTextSelected
                        ]}>
                          {minute.toString().padStart(2, '0')}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </ThemedView>

                {/* AM/PM Toggle */}
                <ThemedView style={styles.dropdownContainer}>
                  <ThemedText style={styles.dropdownLabel}>Period</ThemedText>
                  <ThemedView style={styles.ampmToggle}>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        settings.bedtimeAmPm === 'AM' && styles.ampmButtonSelected
                      ]}
                      onPress={() => setSettings({...settings, bedtimeAmPm: 'AM'})}
                    >
                      <ThemedText style={[
                        styles.ampmText,
                        settings.bedtimeAmPm === 'AM' && styles.ampmTextSelected
                      ]}>
                        AM
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.ampmButton,
                        settings.bedtimeAmPm === 'PM' && styles.ampmButtonSelected
                      ]}
                      onPress={() => setSettings({...settings, bedtimeAmPm: 'PM'})}
                    >
                      <ThemedText style={[
                        styles.ampmText,
                        settings.bedtimeAmPm === 'PM' && styles.ampmTextSelected
                      ]}>
                        PM
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </ThemedView>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.reminderSection}>
              <View style={styles.reminderRow}>
                <View style={styles.reminderTextContainer}>
                  <ThemedText style={styles.reminderTitle}>Bedtime Reminder</ThemedText>
                  <ThemedText style={styles.reminderSubtitle}>
                    Get notified at your bedtime to log sleep tomorrow
                  </ThemedText>
                </View>
                <Switch
                  value={bedtimeReminderEnabled}
                  onValueChange={toggleBedtimeReminder}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </ThemedView>

            <ThemedView style={styles.infoSection}>
              <ThemedText style={styles.infoTitle}>How It Works</ThemedText>
              <ThemedText style={styles.infoText}>
                • Enable the reminder above to get a daily notification at your bedtime
              </ThemedText>
              <ThemedText style={styles.infoText}>
                • When you wake up, open the app to log your sleep
              </ThemedText>
              <ThemedText style={styles.infoText}>
                • Consistent logging helps identify sleep-cognition patterns
              </ThemedText>
            </ThemedView>

            {/* Notification Debug Section */}
            <ThemedView style={styles.notifDebugSection}>
              <ThemedText style={styles.notifDebugTitle}>Notification Debug</ThemedText>
              
              <TouchableOpacity
                style={styles.notifTestButton}
                onPress={async () => {
                  const result = await sendDelayedTestNotification(10);
                  Alert.alert(
                    result.success ? 'Test Scheduled' : 'Failed',
                    result.message
                  );
                }}
              >
                <ThemedText style={styles.notifTestButtonText}>Test Notification (10s)</ThemedText>
                <ThemedText style={styles.notifTestButtonSubtext}>Sends a notification in 10 seconds</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.notifTestButton, { marginTop: 8, backgroundColor: '#5856D6' }]}
                onPress={async () => {
                  try {
                    const info = await getNotificationDebugInfo();
                    const scheduled = await listScheduledNotifications();
                    
                    const channelInfo = info.channels.length > 0 
                      ? info.channels.map(c => `${c.name} (${c.id}): importance ${c.importance}`).join('\n')
                      : 'No channels (iOS)';
                    
                    const scheduledInfo = scheduled.length > 0
                      ? scheduled.slice(0, 5).map(n => `• ${n.title}`).join('\n')
                      : 'None';
                    
                    Alert.alert(
                      'Notification Status',
                      `Permission: ${info.permissionStatus}\n` +
                      `Platform: ${info.platform}\n` +
                      `Is Device: ${info.isDevice}\n` +
                      `Scheduled: ${info.scheduledCount}\n\n` +
                      `Channels:\n${channelInfo}\n\n` +
                      `Settings:\n` +
                      `• Enabled: ${info.settings.notifications_enabled}\n` +
                      `• Supplements: ${info.settings.supplement_reminders_enabled}\n` +
                      `• Sleep: ${info.settings.sleep_reminders_enabled}\n\n` +
                      `Scheduled Notifications:\n${scheduledInfo}`
                    );
                  } catch (error) {
                    Alert.alert('Error', String(error));
                  }
                }}
              >
                <ThemedText style={styles.notifTestButtonText}>Show Debug Info</ThemedText>
                <ThemedText style={styles.notifTestButtonSubtext}>Permissions, channels, scheduled</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* Database Debug Section */}
            <ThemedView style={styles.debugSection}>
              <ThemedText style={styles.debugTitle}>Developer Tools</ThemedText>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => router.push('/database-debug')}
              >
                <ThemedText style={styles.debugButtonText}>Database Debug</ThemedText>
                <ThemedText style={styles.debugButtonSubtext}>Diagnose database issues</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugButton, { marginTop: 8 }]}
                onPress={() => router.push('/invariant-test' as any)}
              >
                <ThemedText style={styles.debugButtonText}>Invariant Tests</ThemedText>
                <ThemedText style={styles.debugButtonSubtext}>Test database sanity checks</ThemedText>
              </TouchableOpacity>
            </ThemedView>

            {/* Spacer to ensure buttons don't overlap content */}
            <ThemedView style={styles.bottomSpacer} />
          </ScrollView>

          {/* Fixed Bottom Buttons */}
          <ThemedView style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => saveSettings(settings)}
            >
              <ThemedText style={styles.saveButtonText}>Save Bedtime</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <ThemedText style={styles.backButtonText}>Back</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: isVerySmallScreen ? 16 : 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: isVerySmallScreen ? 16 : 20,
    paddingBottom: isVerySmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: isVerySmallScreen ? 16 : 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  currentValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#007AFF',
    textAlign: 'center',
  },
  timeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: isVerySmallScreen ? 6 : isSmallScreen ? 8 : 12,
    minHeight: isVerySmallScreen ? 200 : isSmallScreen ? 220 : 250,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  dropdownContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  dropdown: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    height: isVerySmallScreen ? 140 : isSmallScreen ? 160 : 180,
    width: '100%',
    maxHeight: isVerySmallScreen ? 140 : isSmallScreen ? 160 : 180,
    elevation: Platform.OS === 'android' ? 2 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : undefined,
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 1 } : undefined,
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : undefined,
    shadowRadius: Platform.OS === 'ios' ? 2 : undefined,
  },
  dropdownContent: {
    paddingVertical: 4,
  },
  dropdownOption: {
    paddingVertical: isVerySmallScreen ? 10 : 12,
    paddingHorizontal: isVerySmallScreen ? 12 : 16,
    borderRadius: 6,
    marginVertical: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    minHeight: isVerySmallScreen ? 40 : 44,
  },
  dropdownOptionSelected: {
    backgroundColor: '#007AFF',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#000',
  },
  dropdownOptionTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  ampmToggle: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    padding: 4,
    width: '100%',
    height: isVerySmallScreen ? 60 : 80,
    elevation: Platform.OS === 'android' ? 2 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : undefined,
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: 1 } : undefined,
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : undefined,
    shadowRadius: Platform.OS === 'ios' ? 2 : undefined,
  },
  ampmButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginHorizontal: 2,
  },
  ampmButtonSelected: {
    backgroundColor: '#007AFF',
  },
  ampmText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  ampmTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  reminderSection: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  reminderSubtitle: {
    fontSize: 13,
    color: '#558B2F',
    lineHeight: 18,
  },
  infoSection: {
    backgroundColor: '#F2F2F7',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
    lineHeight: 20,
  },
  notifDebugSection: {
    backgroundColor: '#E8F4FD',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  notifDebugTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0051A8',
    textAlign: 'center',
  },
  notifTestButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  notifTestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  notifTestButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  debugSection: {
    backgroundColor: '#FFF3CD',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#856404',
    textAlign: 'center',
  },
  debugButton: {
    backgroundColor: '#FFC107',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  debugButtonSubtext: {
    fontSize: 12,
    color: '#6C757D',
  },
  bottomSpacer: {
    height: isVerySmallScreen ? 80 : isSmallScreen ? 100 : 120,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: isVerySmallScreen ? 16 : 20,
    right: isVerySmallScreen ? 16 : 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: isVerySmallScreen ? 8 : 12,
    elevation: Platform.OS === 'android' ? 4 : 0,
    shadowColor: Platform.OS === 'ios' ? '#000' : undefined,
    shadowOffset: Platform.OS === 'ios' ? { width: 0, height: -2 } : undefined,
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : undefined,
    shadowRadius: Platform.OS === 'ios' ? 4 : undefined,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});