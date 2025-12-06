import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, Alert, View, Modal, TextInput, AppState, AppStateStatus, Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDosage, setEditDosage] = useState('');
  const [editTimestamp, setEditTimestamp] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [pendingPickerOpen, setPendingPickerOpen] = useState(false);
  const [tempTimestamp, setTempTimestamp] = useState(new Date());
  const [countdown, setCountdown] = useState(10);
  const [isCountdownActive, setIsCountdownActive] = useState(true);
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef(AppState.currentState);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');

  // Determine if we have all the required params
  const hasValidParams =
    !!params &&
    !!params.id &&
    !!params.name &&
    !!params.default_dosage &&
    !!params.dosage_unit;

  const supplement: Supplement = useMemo(() => ({
    id: Number(params.id) || 0,
    name: (params.name as string) || 'Unknown',
    default_dosage: Number(params.default_dosage) || 0,
    dosage_unit: (params.dosage_unit as string) || 'mg',
    icon_id: (params.icon_id as string) || 'medical',
    schedule_enabled: params.schedule_enabled === 'true',
    study_enabled: params.study_enabled === 'true'
  }), [params.id, params.name, params.default_dosage, params.dosage_unit, params.icon_id, params.schedule_enabled, params.study_enabled]);

  const logSupplementEntry = useCallback(async (forceOverride: boolean = false, customDosage?: number, customTimestamp?: Date) => {
    if (isLogged || isLogging) return;
    
    const dosageToUse = customDosage || supplement.default_dosage;
    
    if (!supplement || !supplement.id || dosageToUse <= 0) {
      Alert.alert('Error', 'Invalid supplement data. Please try again.');
      router.back();
      return;
    }
    
    // Check for exclusions unless this is a forced override
    if (!forceOverride) {
      try {
        const exclusionCheck = await isExclusionActive(supplement.id, dosageToUse);
        if (exclusionCheck.active) {
          Alert.alert(
            'Exclusion Warning',
            `${exclusionCheck.reason}\n\nDo you want to log anyway?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log Anyway',
                style: 'destructive',
                onPress: () => logSupplementEntry(true, customDosage, customTimestamp) // Override exclusion
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
      // Add note if this was an override or custom dosage
      let notes = forceOverride ? 'Override exclusion warning' : undefined;
      if (customDosage && customDosage !== supplement.default_dosage) {
        notes = notes ? `${notes} - Custom dosage: ${customDosage}${supplement.dosage_unit}` : `Custom dosage: ${customDosage}${supplement.dosage_unit}`;
      }
      const timestampSeconds = customTimestamp ? Math.floor(customTimestamp.getTime() / 1000) : undefined;
      const logId = await logSupplement(supplement.id, dosageToUse, notes, timestampSeconds);
      
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
  }, [isLogged, isLogging, supplement, router]);

  // Auto-confirm countdown timer
  useEffect(() => {
    if (!isCountdownActive || isLogged || isLogging) return;

    if (countdown <= 0) {
      logSupplementEntry();
      return;
    }

    timerRef.current = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [countdown, isCountdownActive, isLogged, isLogging, logSupplementEntry]);

  // AppState listener for background/inactive detection
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        // App going to background - auto-confirm immediately
        if (isCountdownActive && !isLogged && !isLogging) {
          logSupplementEntry();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [isCountdownActive, isLogged, isLogging, logSupplementEntry]);

  // Always call hooks; handle invalid params inside the effect
  useEffect(() => {
    if (!hasValidParams) {
      Alert.alert('Error', 'Missing supplement data. Please try again.');
      router.back();
    }
  }, [hasValidParams, router]);

  // Cleanup timer when component unmounts or navigates away
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!hasValidParams) {
    // While the effect runs and navigates back, render nothing
    return null;
  }

  const handleConfirmNow = () => {
    setIsCountdownActive(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    logSupplementEntry();
  };

  const handleEdit = () => {
    setIsCountdownActive(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setEditDosage(supplement.default_dosage.toString());
    setEditTimestamp(new Date());
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    const dosage = parseFloat(editDosage);
    if (isNaN(dosage) || dosage <= 0) {
      Alert.alert('Error', 'Please enter a valid dosage amount');
      return;
    }
    
    // Validate timestamp is not in the future
    if (editTimestamp.getTime() > Date.now()) {
      Alert.alert('Error', 'Cannot set a time in the future');
      return;
    }
    
    setShowEditModal(false);
    logSupplementEntry(false, dosage, editTimestamp);
  };

  const handleDateTimeChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDateTimePicker(false);
      if (selectedDate) {
        const maxTime = new Date();
        const finalDate = selectedDate.getTime() > maxTime.getTime() ? maxTime : selectedDate;
        setEditTimestamp(finalDate);
      }
      setShowEditModal(true);
    } else if (selectedDate) {
      const maxTime = new Date();
      const finalDate = selectedDate.getTime() > maxTime.getTime() ? maxTime : selectedDate;
      setTempTimestamp(finalDate);
    }
  };

  const handleOpenDatePicker = () => {
    setTempTimestamp(editTimestamp);
    setShowEditModal(false);
    setPendingPickerOpen(true);
  };

  const handleConfirmDateTime = () => {
    setEditTimestamp(tempTimestamp);
    setShowDateTimePicker(false);
    setShowEditModal(true);
  };

  const handleCancelDateTime = () => {
    setShowDateTimePicker(false);
    setShowEditModal(true);
  };

  useEffect(() => {
    if (pendingPickerOpen && !showEditModal) {
      setPendingPickerOpen(false);
      setShowDateTimePicker(true);
    }
  }, [pendingPickerOpen, showEditModal]);

  const handleCancel = () => {
    setIsCountdownActive(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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
              {isLogging ? 'Logging...' : 
               isCountdownActive ? `Confirm (auto in ${countdown}s)` : 'Confirm'}
            </ThemedText>
          </TouchableOpacity>
          
          {isCountdownActive && !isLogging && (
            <ThemedText style={styles.countdownText}>
              Auto-confirming in {countdown} second{countdown !== 1 ? 's' : ''}...
            </ThemedText>
          )}

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

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ThemedView style={styles.modalContent}>
              <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <ThemedText style={styles.modalHeaderCancel}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>Edit Entry</ThemedText>
              <TouchableOpacity onPress={handleSaveEdit}>
                <ThemedText style={[styles.modalHeaderSave, { color: tintColor }]}>Save</ThemedText>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.editSection}>
                <ThemedText style={styles.editLabel}>Dosage</ThemedText>
                <View style={styles.dosageInputContainer}>
                  <TextInput
                    style={styles.dosageInput}
                    value={editDosage}
                    onChangeText={setEditDosage}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                  <ThemedText style={styles.dosageUnit}>{supplement?.dosage_unit || 'mg'}</ThemedText>
                </View>
              </View>

              <View style={styles.editSection}>
                <ThemedText style={styles.editLabel}>Timestamp</ThemedText>
                <TouchableOpacity
                  style={styles.timestampButton}
                  onPress={handleOpenDatePicker}
                >
                  <ThemedText style={styles.timestampText}>
                    {editTimestamp.toLocaleString()}
                  </ThemedText>
                  <Ionicons name="calendar" size={20} color="#8E8E93" />
                </TouchableOpacity>
                <ThemedText style={styles.editNote}>
                  Tap to adjust when you took this supplement
                </ThemedText>
              </View>
            </ScrollView>
            </ThemedView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date/Time Picker - iOS wrapped in modal with confirm button */}
      {showDateTimePicker && Platform.OS === 'ios' && (
        <Modal
          visible={true}
          animationType="slide"
          transparent
          onRequestClose={handleCancelDateTime}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={handleCancelDateTime}>
                  <ThemedText style={styles.pickerCancelText}>Cancel</ThemedText>
                </TouchableOpacity>
                <ThemedText style={styles.pickerTitle}>Select Date & Time</ThemedText>
                <TouchableOpacity onPress={handleConfirmDateTime}>
                  <ThemedText style={[styles.pickerDoneText, { color: tintColor }]}>Done</ThemedText>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTimestamp}
                mode="datetime"
                display="spinner"
                onChange={handleDateTimeChange}
                maximumDate={new Date()}
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      )}
      {showDateTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={editTimestamp}
          mode="datetime"
          display="default"
          onChange={handleDateTimeChange}
          maximumDate={new Date()}
        />
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
  countdownText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalHeaderCancel: {
    fontSize: 16,
    color: '#8E8E93',
  },
  modalHeaderSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalScrollContent: {
    padding: 24,
  },
  editSection: {
    marginBottom: 24,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dosageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
  },
  dosageInput: {
    flex: 1,
    fontSize: 16,
    padding: 12,
    color: '#000',
  },
  dosageUnit: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 8,
  },
  editNote: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  timestampButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timestampText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    height: 200,
  },
});
