// DISABLED FOR V1 - Re-enable for Mk II
/*
import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { getSleepLogs, updateSleepLog, SleepLog } from '@/database/sleep';
import { scheduleSleepReminders } from '@/services/reminder-scheduler';

export default function SleepLogsScreen() {
  const router = useRouter();
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLog, setEditingLog] = useState<SleepLog | null>(null);
  const [editSleepStart, setEditSleepStart] = useState('');
  const [editSleepEnd, setEditSleepEnd] = useState('');

  useEffect(() => {
    loadSleepLogs();
  }, []);

  const loadSleepLogs = async () => {
    try {
      const logs = await getSleepLogs(50); // Load last 50 sleep logs
      setSleepLogs(logs);
    } catch (error) {
      console.error('Error loading sleep logs:', error);
      Alert.alert('Error', 'Failed to load sleep logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatDateTimeForInput = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const parseDateTimeInput = (input: string): number => {
    // Expected format: YYYY-MM-DD HH:MM
    const date = new Date(input);
    return Math.floor(date.getTime() / 1000);
  };

  const handleEditLog = (log: SleepLog) => {
    setEditingLog(log);
    setEditSleepStart(formatDateTimeForInput(log.sleep_start));
    setEditSleepEnd(formatDateTimeForInput(log.sleep_end));
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;

    try {
      const newSleepStart = parseDateTimeInput(editSleepStart);
      const newSleepEnd = parseDateTimeInput(editSleepEnd);

      if (newSleepStart >= newSleepEnd) {
        Alert.alert('Error', 'Sleep start time must be before sleep end time');
        return;
      }

      await updateSleepLog(editingLog.id, newSleepStart, newSleepEnd);
      
      // Reschedule sleep reminders since sleep data changed
      try {
        await scheduleSleepReminders();
      } catch (reminderError) {
        console.error('Failed to reschedule sleep reminders:', reminderError);
        // Don't fail the update if reminder scheduling fails
      }
      
      setEditingLog(null);
      loadSleepLogs(); // Refresh the list
      Alert.alert('Success', 'Sleep log updated successfully');
    } catch (error) {
      console.error('Error updating sleep log:', error);
      Alert.alert('Error', 'Failed to update sleep log');
    }
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setEditSleepStart('');
    setEditSleepEnd('');
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading sleep logs...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>Sleep Logs</ThemedText>
        <ThemedText style={styles.subtitle}>
          Review and edit your sleep records
        </ThemedText>
      </ThemedView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {sleepLogs.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              No sleep logs yet. Sleep tracking will automatically log your sleep when enabled.
            </ThemedText>
          </ThemedView>
        ) : (
          sleepLogs.map((log) => (
            <ThemedView key={log.id} style={styles.logCard}>
              <ThemedView style={styles.logHeader}>
                <ThemedText style={styles.logDate}>
                  {new Date(log.sleep_start * 1000).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </ThemedText>
                {log.manually_edited && (
                  <ThemedText style={styles.editedBadge}>Edited</ThemedText>
                )}
              </ThemedView>

              <ThemedView style={styles.logDetails}>
                <ThemedView style={styles.timeRow}>
                  <ThemedText style={styles.timeLabel}>Sleep:</ThemedText>
                  <ThemedText style={styles.timeValue}>
                    {formatDateTime(log.sleep_start)}
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.timeRow}>
                  <ThemedText style={styles.timeLabel}>Wake:</ThemedText>
                  <ThemedText style={styles.timeValue}>
                    {formatDateTime(log.sleep_end)}
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.timeRow}>
                  <ThemedText style={styles.timeLabel}>Duration:</ThemedText>
                  <ThemedText style={styles.durationValue}>
                    {formatDuration(log.duration_seconds)}
                  </ThemedText>
                </ThemedView>
              </ThemedView>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEditLog(log)}
              >
                <ThemedText style={styles.editButtonText}>Edit</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          ))
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <ThemedText style={styles.backButtonText}>Back</ThemedText>
      </TouchableOpacity>

      <Modal
        visible={editingLog !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelEdit}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Edit Sleep Log</ThemedText>
            
            <ThemedView style={styles.inputSection}>
              <ThemedText style={styles.inputLabel}>Sleep Start (YYYY-MM-DD HH:MM)</ThemedText>
              <TextInput
                style={styles.textInput}
                value={editSleepStart}
                onChangeText={setEditSleepStart}
                placeholder="2024-01-01 22:30"
                placeholderTextColor="#8E8E93"
              />
            </ThemedView>

            <ThemedView style={styles.inputSection}>
              <ThemedText style={styles.inputLabel}>Sleep End (YYYY-MM-DD HH:MM)</ThemedText>
              <TextInput
                style={styles.textInput}
                value={editSleepEnd}
                onChangeText={setEditSleepEnd}
                placeholder="2024-01-02 06:30"
                placeholderTextColor="#8E8E93"
              />
            </ThemedView>

            <ThemedView style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelEdit}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveEdit}
              >
                <ThemedText style={styles.saveButtonText}>Save</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
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
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  logCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  editedBadge: {
    backgroundColor: '#FF9500',
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logDetails: {
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#000',
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#000',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
*/

export default function SleepLogsScreen() {
  return null;
}