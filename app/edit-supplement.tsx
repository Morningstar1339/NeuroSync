import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, View, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Supplement, Exclusion, TimeWindowParams, DosageLimitParams, StudyProtocol, getSupplementExclusions, addExclusion, deleteExclusion, getSupplementStudyProtocols, addStudyProtocol, deleteStudyProtocol } from '@/database/supplements';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { openDatabase } from '@/database/database';

const AVAILABLE_ICONS = [
  'medical', 'fitness', 'nutrition', 'leaf', 'water', 'rose',
  'flower', 'diamond', 'heart', 'star', 'sunny', 'moon',
  'flash', 'shield', 'rocket', 'trophy', 'gift', 'bulb',
  'glasses', 'watch', 'camera', 'headset', 'game-controller', 'phone-portrait',
  'flower-outline', 'medical-outline', 'ellipse', 'wine', 'bandage',
  'cigarette', 'pipe', 'water-outline'
];

const DEFAULT_COLORS = [
  '#007AFF', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#AF52DE', '#FF2D92', '#8E8E93', '#5856D6', '#FF6B6B', '#4ECDC4',
  '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

const getContrastingTextColor = (backgroundColor: string): string => {
  // Remove # and convert to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

export default function EditSupplementScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const supplementId = Number(params.id);

  // Parse supplement data from params
  const originalSupplement: Supplement = {
    id: supplementId,
    name: params.name as string,
    default_dosage: Number(params.default_dosage),
    dosage_unit: params.dosage_unit as string,
    icon_id: params.icon_id as string,
    color: (params.color as string) || '#007AFF',
    schedule_enabled: params.schedule_enabled === 'true',
    study_enabled: params.study_enabled === 'true'
  };

  const [dosage, setDosage] = useState(originalSupplement.default_dosage.toString());
  const [selectedIcon, setSelectedIcon] = useState(originalSupplement.icon_id || 'medical');
  const [selectedColor, setSelectedColor] = useState(originalSupplement.color || '#007AFF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Exclusion states
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [showAddExclusion, setShowAddExclusion] = useState(false);
  const [newExclusionType, setNewExclusionType] = useState<'time_window' | 'dosage_limit'>('time_window');
  const [newTimeWindow, setNewTimeWindow] = useState<TimeWindowParams>({ start_time: '22:00', end_time: '06:00' });
  const [newDosageLimit, setNewDosageLimit] = useState<DosageLimitParams>({ max_dosage: 1000, time_window_hours: 24 });
  
  // Study protocol states
  const [studyProtocols, setStudyProtocols] = useState<StudyProtocol[]>([]);
  const [showAddStudy, setShowAddStudy] = useState(false);
  const [newStudyType, setNewStudyType] = useState<'event_based' | 'daily_schedule'>('event_based');
  const [newTestType, setNewTestType] = useState<'reflexes' | 'memory' | 'judgment'>('reflexes');
  const [newIntervalMinutes, setNewIntervalMinutes] = useState(60);
  const [newDurationMinutes, setNewDurationMinutes] = useState(180);

  const loadExclusions = useCallback(async () => {
    try {
      const supplementExclusions = await getSupplementExclusions(supplementId);
      setExclusions(supplementExclusions);
    } catch (error) {
      console.error('Failed to load exclusions:', error);
    }
  }, [supplementId]);

  const loadStudyProtocols = useCallback(async () => {
    try {
      const protocols = await getSupplementStudyProtocols(supplementId);
      setStudyProtocols(protocols);
    } catch (error) {
      console.error('Failed to load study protocols:', error);
    }
  }, [supplementId]);

  useEffect(() => {
    loadExclusions();
    loadStudyProtocols();
  }, [loadExclusions, loadStudyProtocols]);

  const handleAddExclusion = async () => {
    try {
      let parameters: string;
      if (newExclusionType === 'time_window') {
        parameters = JSON.stringify(newTimeWindow);
      } else {
        parameters = JSON.stringify(newDosageLimit);
      }

      await addExclusion({
        supplement_id: originalSupplement.id,
        exclusion_type: newExclusionType,
        parameters
      });

      setShowAddExclusion(false);
      loadExclusions();
    } catch (error) {
      console.error('Failed to add exclusion:', error);
      Alert.alert('Error', 'Failed to add exclusion. Please try again.');
    }
  };

  const handleDeleteExclusion = async (exclusionId: number) => {
    Alert.alert(
      'Delete Exclusion',
      'Are you sure you want to delete this exclusion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExclusion(exclusionId);
              loadExclusions();
            } catch (error) {
              console.error('Failed to delete exclusion:', error);
              Alert.alert('Error', 'Failed to delete exclusion. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleAddStudyProtocol = async () => {
    try {
      // Validate minimum interval (test duration + 30 seconds)
      const minInterval = getTestDuration(newTestType) + 0.5; // 30 seconds in minutes
      if (newIntervalMinutes < minInterval) {
        Alert.alert('Invalid Interval', `Minimum interval is ${minInterval} minutes (test duration + 30 seconds)`);
        return;
      }

      await addStudyProtocol({
        supplement_id: originalSupplement.id,
        test_type: newTestType,
        interval_minutes: newIntervalMinutes,
        duration_minutes: newDurationMinutes,
        schedule_type: newStudyType,
        parameters: undefined
      });

      setShowAddStudy(false);
      loadStudyProtocols();
    } catch (error) {
      console.error('Failed to add study protocol:', error);
      Alert.alert('Error', 'Failed to add study protocol. Please try again.');
    }
  };

  const handleDeleteStudyProtocol = async (protocolId: number) => {
    Alert.alert(
      'Delete Study Protocol',
      'Are you sure you want to delete this study protocol?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStudyProtocol(protocolId);
              loadStudyProtocols();
            } catch (error) {
              console.error('Failed to delete study protocol:', error);
              Alert.alert('Error', 'Failed to delete study protocol. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getTestDuration = (testType: 'reflexes' | 'memory' | 'judgment'): number => {
    switch (testType) {
      case 'reflexes':
        return 10 / 60; // 10 seconds in minutes
      case 'memory':
        return 1; // 60 seconds in minutes
      case 'judgment':
        return 0.5; // 30 seconds in minutes
      default:
        return 1;
    }
  };

  const getTestDisplayName = (testType: 'reflexes' | 'memory' | 'judgment'): string => {
    switch (testType) {
      case 'reflexes':
        return 'Reflexes (10s)';
      case 'memory':
        return 'Memory (60s)';
      case 'judgment':
        return 'Judgment (30s)';
      default:
        return testType;
    }
  };

  const updateSupplement = async (updates: Partial<Supplement>) => {
    const db = await openDatabase();
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);
    values.push(originalSupplement.id);
    
    await db.runAsync(
      `UPDATE supplements SET ${setClause} WHERE id = ?`,
      values
    );
  };

  const deleteSupplement = async () => {
    const db = await openDatabase();
    // Delete supplement logs first (foreign key constraint)
    await db.runAsync('DELETE FROM supplement_logs WHERE supplement_id = ?', [originalSupplement.id]);
    // Delete the supplement
    await db.runAsync('DELETE FROM supplements WHERE id = ?', [originalSupplement.id]);
  };

  const handleSave = async () => {
    if (!dosage.trim() || isNaN(Number(dosage))) {
      Alert.alert('Error', 'Please enter a valid dosage amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateSupplement({
        default_dosage: Number(dosage),
        icon_id: selectedIcon,
        color: selectedColor
      });

      router.back();
    } catch (error) {
      console.error('Failed to update supplement:', error);
      Alert.alert('Error', 'Failed to update supplement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Supplement',
      `Are you sure you want to delete "${originalSupplement.name}"? This will also delete all logged entries for this supplement.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await deleteSupplement();
              router.back();
            } catch (error) {
              console.error('Failed to delete supplement:', error);
              Alert.alert('Error', 'Failed to delete supplement. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container} safeArea>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ThemedView style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>Edit Supplement</ThemedText>
          <TouchableOpacity 
            onPress={handleSave} 
            style={[styles.saveButton, { backgroundColor: tintColor }]}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.saveText}>Save</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Name</ThemedText>
            <View style={[styles.disabledInput, { borderColor: '#E5E5E7' }]}>
              <ThemedText style={styles.disabledText}>{originalSupplement.name}</ThemedText>
            </View>
            <ThemedText style={styles.helperText}>Name cannot be changed</ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Default Dosage</ThemedText>
            <View style={styles.dosageContainer}>
              <TextInput
                style={[styles.dosageInput, { borderColor: tintColor + '30', color: textColor }]}
                value={dosage}
                onChangeText={setDosage}
                placeholder="Amount"
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                maxLength={10}
              />
              <View style={[styles.disabledUnit, { borderColor: '#E5E5E7' }]}>
                <ThemedText style={styles.disabledText}>{originalSupplement.dosage_unit}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.helperText}>Unit cannot be changed</ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Icon</ThemedText>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map((iconName) => (
                <TouchableOpacity
                  key={iconName}
                  style={[
                    styles.iconButton,
                    selectedIcon === iconName && { 
                      backgroundColor: tintColor + '20',
                      borderColor: tintColor 
                    }
                  ]}
                  onPress={() => setSelectedIcon(iconName)}
                >
                  <Ionicons
                    name={iconName as any}
                    size={24}
                    color={selectedIcon === iconName ? tintColor : '#8E8E93'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText style={styles.label}>Color</ThemedText>
            <View style={styles.colorGrid}>
              {DEFAULT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColorButton
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={getContrastingTextColor(color)}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ThemedView>

          <ThemedView style={styles.preview}>
            <ThemedText style={styles.previewLabel}>Preview</ThemedText>
            <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
              <View style={styles.previewContent}>
                <Ionicons
                  name={selectedIcon as any}
                  size={24}
                  color={getContrastingTextColor(selectedColor)}
                  style={styles.previewIcon}
                />
                <View style={styles.previewText}>
                  <ThemedText style={[styles.previewName, { color: getContrastingTextColor(selectedColor) }]}>
                    {originalSupplement.name}
                  </ThemedText>
                  <ThemedText style={[styles.previewDosage, { color: getContrastingTextColor(selectedColor), opacity: 0.8 }]}>
                    {dosage || '0'} {originalSupplement.dosage_unit}
                  </ThemedText>
                </View>
              </View>
            </View>
          </ThemedView>

          <ThemedView style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.label}>Exclusions & Warnings</ThemedText>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: tintColor }]}
                onPress={() => setShowAddExclusion(true)}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            
            {exclusions.map((exclusion) => {
              const params = JSON.parse(exclusion.parameters);
              return (
                <View key={exclusion.id} style={[styles.exclusionCard, { borderColor: tintColor + '20' }]}>
                  <View style={styles.exclusionContent}>
                    <Ionicons
                      name={exclusion.exclusion_type === 'time_window' ? 'time-outline' : 'warning'}
                      size={20}
                      color={exclusion.exclusion_type === 'time_window' ? '#FF3B30' : '#FF9500'}
                      style={styles.exclusionIcon}
                    />
                    <View style={styles.exclusionText}>
                      <ThemedText style={styles.exclusionTitle}>
                        {exclusion.exclusion_type === 'time_window' ? 'Time Window' : 'Dosage Limit'}
                      </ThemedText>
                      <ThemedText style={styles.exclusionDescription}>
                        {exclusion.exclusion_type === 'time_window'
                          ? `Do not take between ${params.start_time} and ${params.end_time}`
                          : `Max ${params.max_dosage}${originalSupplement.dosage_unit} per ${params.time_window_hours} hours`
                        }
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteExclusionButton}
                      onPress={() => handleDeleteExclusion(exclusion.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {exclusions.length === 0 && (
              <ThemedText style={styles.noExclusionsText}>
                No exclusions configured. Tap + to add warnings.
              </ThemedText>
            )}
          </ThemedView>

          {showAddExclusion && (
            <ThemedView style={styles.addExclusionSection}>
              <ThemedText style={styles.label}>Add Exclusion</ThemedText>
              
              <View style={styles.exclusionTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newExclusionType === 'time_window' && { backgroundColor: tintColor + '20', borderColor: tintColor }
                  ]}
                  onPress={() => setNewExclusionType('time_window')}
                >
                  <ThemedText style={[
                    styles.typeButtonText,
                    newExclusionType === 'time_window' && { color: tintColor }
                  ]}>Time Window</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newExclusionType === 'dosage_limit' && { backgroundColor: tintColor + '20', borderColor: tintColor }
                  ]}
                  onPress={() => setNewExclusionType('dosage_limit')}
                >
                  <ThemedText style={[
                    styles.typeButtonText,
                    newExclusionType === 'dosage_limit' && { color: tintColor }
                  ]}>Dosage Limit</ThemedText>
                </TouchableOpacity>
              </View>

              {newExclusionType === 'time_window' ? (
                <View style={styles.timeWindowInputs}>
                  <View style={styles.timeInputGroup}>
                    <ThemedText style={styles.timeLabel}>From:</ThemedText>
                    <TextInput
                      style={[styles.timeInput, { borderColor: tintColor + '30', color: textColor }]}
                      value={newTimeWindow.start_time}
                      onChangeText={(text) => setNewTimeWindow({ ...newTimeWindow, start_time: text })}
                      placeholder="HH:MM"
                      placeholderTextColor="#8E8E93"
                    />
                  </View>
                  <View style={styles.timeInputGroup}>
                    <ThemedText style={styles.timeLabel}>To:</ThemedText>
                    <TextInput
                      style={[styles.timeInput, { borderColor: tintColor + '30', color: textColor }]}
                      value={newTimeWindow.end_time}
                      onChangeText={(text) => setNewTimeWindow({ ...newTimeWindow, end_time: text })}
                      placeholder="HH:MM"
                      placeholderTextColor="#8E8E93"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.dosageLimitInputs}>
                  <View style={styles.dosageInputGroup}>
                    <ThemedText style={styles.dosageLabel}>Max Dosage:</ThemedText>
                    <TextInput
                      style={[styles.dosageInput, { borderColor: tintColor + '30', color: textColor }]}
                      value={newDosageLimit.max_dosage.toString()}
                      onChangeText={(text) => setNewDosageLimit({ ...newDosageLimit, max_dosage: Number(text) || 0 })}
                      placeholder="Amount"
                      placeholderTextColor="#8E8E93"
                      keyboardType="numeric"
                    />
                    <ThemedText style={styles.unitText}>{originalSupplement.dosage_unit}</ThemedText>
                  </View>
                  <View style={styles.hoursInputGroup}>
                    <ThemedText style={styles.hoursLabel}>Per:</ThemedText>
                    <TextInput
                      style={[styles.hoursInput, { borderColor: tintColor + '30', color: textColor }]}
                      value={newDosageLimit.time_window_hours.toString()}
                      onChangeText={(text) => setNewDosageLimit({ ...newDosageLimit, time_window_hours: Number(text) || 1 })}
                      placeholder="Hours"
                      placeholderTextColor="#8E8E93"
                      keyboardType="numeric"
                    />
                    <ThemedText style={styles.unitText}>hours</ThemedText>
                  </View>
                </View>
              )}

              <View style={styles.exclusionButtons}>
                <TouchableOpacity
                  style={styles.cancelExclusionButton}
                  onPress={() => setShowAddExclusion(false)}
                >
                  <ThemedText style={styles.cancelExclusionText}>Cancel</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.addExclusionButton, { backgroundColor: tintColor }]}
                  onPress={handleAddExclusion}
                >
                  <ThemedText style={styles.addExclusionText}>Add Exclusion</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}

          <ThemedView style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.label}>Cognitive Study Protocols</ThemedText>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: tintColor }]}
                onPress={() => setShowAddStudy(true)}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            
            {studyProtocols.map((protocol) => (
              <View key={protocol.id} style={[styles.exclusionCard, { borderColor: tintColor + '20' }]}>
                <View style={styles.exclusionContent}>
                  <Ionicons
                    name="flask-outline"
                    size={20}
                    color={tintColor}
                    style={styles.exclusionIcon}
                  />
                  <View style={styles.exclusionText}>
                    <ThemedText style={styles.exclusionTitle}>
                      {getTestDisplayName(protocol.test_type)} - {protocol.schedule_type === 'event_based' ? 'Event-Based' : 'Daily Schedule'}
                    </ThemedText>
                    <ThemedText style={styles.exclusionDescription}>
                      {protocol.schedule_type === 'event_based'
                        ? `Every ${protocol.interval_minutes}min for ${Math.floor(protocol.duration_minutes / 60)}h${protocol.duration_minutes % 60 ? ` ${protocol.duration_minutes % 60}m` : ''} after taking`
                        : 'Test at scheduled times daily'
                      }
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteExclusionButton}
                    onPress={() => handleDeleteStudyProtocol(protocol.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {studyProtocols.length === 0 && (
              <ThemedText style={styles.noExclusionsText}>
                No study protocols configured. Tap + to add cognitive tests.
              </ThemedText>
            )}
          </ThemedView>

          {showAddStudy && (
            <ThemedView style={styles.addExclusionSection}>
              <ThemedText style={styles.label}>Add Study Protocol</ThemedText>
              
              <View style={styles.exclusionTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newStudyType === 'event_based' && { backgroundColor: tintColor + '20', borderColor: tintColor }
                  ]}
                  onPress={() => setNewStudyType('event_based')}
                >
                  <ThemedText style={[
                    styles.typeButtonText,
                    newStudyType === 'event_based' && { color: tintColor }
                  ]}>Event-Based</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    newStudyType === 'daily_schedule' && { backgroundColor: tintColor + '20', borderColor: tintColor }
                  ]}
                  onPress={() => setNewStudyType('daily_schedule')}
                >
                  <ThemedText style={[
                    styles.typeButtonText,
                    newStudyType === 'daily_schedule' && { color: tintColor }
                  ]}>Daily Schedule</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.studyInputs}>
                <View style={styles.testTypeSelector}>
                  <ThemedText style={styles.inputLabel}>Test Type:</ThemedText>
                  <View style={styles.testTypeButtons}>
                    {(['reflexes', 'memory', 'judgment'] as const).map((testType) => (
                      <TouchableOpacity
                        key={testType}
                        style={[
                          styles.testTypeButton,
                          newTestType === testType && { backgroundColor: tintColor + '20', borderColor: tintColor }
                        ]}
                        onPress={() => setNewTestType(testType)}
                      >
                        <ThemedText style={[
                          styles.testTypeButtonText,
                          newTestType === testType && { color: tintColor }
                        ]}>{getTestDisplayName(testType)}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {newStudyType === 'event_based' && (
                  <>
                    <View style={styles.inputRow}>
                      <ThemedText style={styles.inputLabel}>Interval (minutes):</ThemedText>
                      <TextInput
                        style={[styles.numberInput, { borderColor: tintColor + '30', color: textColor }]}
                        value={newIntervalMinutes.toString()}
                        onChangeText={(text) => setNewIntervalMinutes(Number(text) || 1)}
                        placeholder="60"
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric"
                      />
                    </View>
                    
                    <View style={styles.inputRow}>
                      <ThemedText style={styles.inputLabel}>Duration (minutes):</ThemedText>
                      <TextInput
                        style={[styles.numberInput, { borderColor: tintColor + '30', color: textColor }]}
                        value={newDurationMinutes.toString()}
                        onChangeText={(text) => setNewDurationMinutes(Number(text) || 60)}
                        placeholder="180"
                        placeholderTextColor="#8E8E93"
                        keyboardType="numeric"
                      />
                    </View>
                  </>
                )}

                <ThemedText style={styles.helperText}>
                  {newStudyType === 'event_based' 
                    ? `Tests will run every ${newIntervalMinutes} minutes for ${Math.floor(newDurationMinutes / 60)}h${newDurationMinutes % 60 ? ` ${newDurationMinutes % 60}m` : ''} after taking this supplement.`
                    : 'Tests will run at pre-configured daily times, not linked to supplement consumption.'
                  }
                </ThemedText>
              </View>

              <View style={styles.exclusionButtons}>
                <TouchableOpacity
                  style={styles.cancelExclusionButton}
                  onPress={() => setShowAddStudy(false)}
                >
                  <ThemedText style={styles.cancelExclusionText}>Cancel</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.addExclusionButton, { backgroundColor: tintColor }]}
                  onPress={handleAddStudyProtocol}
                >
                  <ThemedText style={styles.addExclusionText}>Add Protocol</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isSubmitting}
          >
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            <ThemedText style={styles.deleteButtonText}>
              Delete Supplement
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  disabledInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
  },
  disabledText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  helperText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  dosageContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dosageInput: {
    flex: 2,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  disabledUnit: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorButton: {
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  preview: {
    marginTop: 8,
    marginBottom: 32,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    marginRight: 12,
  },
  previewText: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewDosage: {
    fontSize: 14,
    color: '#8E8E93',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    marginBottom: 40,
    gap: 8,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exclusionCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  exclusionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exclusionIcon: {
    marginRight: 12,
  },
  exclusionText: {
    flex: 1,
  },
  exclusionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  exclusionDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
  deleteExclusionButton: {
    padding: 4,
  },
  noExclusionsText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    fontStyle: 'italic',
    marginVertical: 20,
  },
  addExclusionSection: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  exclusionTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeWindowInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  dosageLimitInputs: {
    marginBottom: 16,
  },
  dosageInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  dosageLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 80,
  },
  hoursInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hoursLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 80,
  },
  hoursInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  unitText: {
    fontSize: 14,
    opacity: 0.7,
    minWidth: 60,
  },
  exclusionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelExclusionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    alignItems: 'center',
  },
  cancelExclusionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  addExclusionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addExclusionText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  studyInputs: {
    marginBottom: 16,
  },
  testTypeSelector: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  testTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  testTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    alignItems: 'center',
  },
  testTypeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  numberInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
