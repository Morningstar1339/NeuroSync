import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { logSupplement, Supplement, isExclusionActive } from '@/database/supplements';
import { scheduleEventBasedTests } from '@/database/study-scheduler';
import { scheduleEventBasedStudyNotifications } from '@/services/reminder-scheduler';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function LogSupplementScreen() {
  const [isLogged, setIsLogged] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');

  // Parse supplement data from params with null checks
  if (!params || !params.id || !params.name || !params.default_dosage || !params.dosage_unit) {
    // Handle missing params by navigating back
    React.useEffect(() => {
      Alert.alert('Error', 'Missing supplement data. Please try again.');
      router.back();
    }, []);
    return null;
  }

  const supplement: Supplement = {
    id: Number(params.id) || 0,
    name: (params.name as string) || 'Unknown',
    default_dosage: Number(params.default_dosage) || 0,
    dosage_unit: (params.dosage_unit as string) || 'mg',
    icon_id: (params.icon_id as string) || 'medical',
    schedule_enabled: params.schedule_enabled === 'true',
    study_enabled: params.study_enabled === 'true'
  };



  const logSupplementEntry = async (forceOverride: boolean = false) => {
    if (isLogged || isLogging) return;
    
    if (!supplement || !supplement.id || supplement.default_dosage <= 0) {
      Alert.alert('Error', 'Invalid supplement data. Please try again.');
      router.back();
      return;
    }
    
    // Check for exclusions unless this is a forced override
    if (!forceOverride) {
      try {
        const exclusionCheck = await isExclusionActive(supplement.id, supplement.default_dosage);
        if (exclusionCheck.active) {
          Alert.alert(
            'Exclusion Warning',
            `${exclusionCheck.reason}\n\nDo you want to log anyway?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log Anyway',
                style: 'destructive',
                onPress: () => logSupplementEntry(true) // Override exclusion
              }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Failed to check exclusions:', error);
        // Continue with logging if exclusion check fails
      }
    }
    
    setIsLogging(true);
    try {
      // Add note if this was an override
      const notes = forceOverride ? 'Override exclusion warning' : undefined;
      const logId = await logSupplement(supplement.id, supplement.default_dosage, notes);
      
      // Schedule event-based tests for this supplement
      try {
        await scheduleEventBasedTests(supplement.id, logId);
      } catch (scheduleError) {
        console.error('Failed to schedule tests:', scheduleError);
        // Don't fail the logging if scheduling fails
      }
      
      // Schedule event-based study notifications
      try {
        await scheduleEventBasedStudyNotifications(supplement.id, logId);
      } catch (notificationError) {
        console.error('Failed to schedule study notifications:', notificationError);
        // Don't fail the logging if notification scheduling fails
      }
      
      setIsLogged(true);
      
      // Show brief confirmation then navigate back
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Failed to log supplement:', error);
      Alert.alert('Error', 'Failed to log supplement. Please try again.');
      router.back();
    } finally {
      setIsLogging(false);
    }
  };

  const handleConfirmNow = () => {
    logSupplementEntry();
  };

  const handleEdit = () => {
    // For now, just show alert. This would navigate to an edit screen
    Alert.alert('Edit Entry', 'Edit functionality will be implemented');
  };

  const handleCancel = () => {
    router.back();
  };

  if (isLogged) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centeredContent}>
          <Ionicons name="checkmark-circle" size={80} color="#34C759" />
          <ThemedText type="title" style={styles.successTitle}>
            Logged!
          </ThemedText>
          <ThemedText style={styles.successText}>
            {supplement?.name || 'Supplement'} has been logged
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Ionicons name="close" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </ThemedView>

      <View style={styles.centeredContent}>
        <View style={styles.supplementInfo}>
          <Ionicons
            name={(supplement?.icon_id || 'medical') as any}
            size={60}
            color={tintColor}
            style={styles.supplementIcon}
          />
          <ThemedText type="title" style={styles.supplementName}>
            {supplement?.name || 'Unknown Supplement'}
          </ThemedText>
          <ThemedText style={styles.dosageText}>
            {supplement?.default_dosage || 0} {supplement?.dosage_unit || 'mg'}
          </ThemedText>
        </View>


        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: tintColor }]}
            onPress={handleConfirmNow}
            disabled={isLogging}
          >
            <ThemedText style={styles.confirmButtonText}>
              {isLogging ? 'Logging...' : 'Confirm'}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.secondaryButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleEdit}>
              <Ionicons name="pencil" size={20} color="#8E8E93" />
              <ThemedText style={styles.secondaryButtonText}>Edit</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
              <Ionicons name="close" size={20} color="#8E8E93" />
              <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    alignItems: 'flex-end',
  },
  cancelButton: {
    padding: 8,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  supplementInfo: {
    alignItems: 'center',
    marginBottom: 60,
  },
  supplementIcon: {
    marginBottom: 16,
  },
  supplementName: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  dosageText: {
    fontSize: 18,
    color: '#8E8E93',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  confirmButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButtons: {
    flexDirection: 'row',
    gap: 40,
  },
  secondaryButton: {
    alignItems: 'center',
    padding: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 18,
    color: '#8E8E93',
    textAlign: 'center',
  },
});