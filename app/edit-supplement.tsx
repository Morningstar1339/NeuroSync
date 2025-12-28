import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, View, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Supplement, Exclusion, DosageLimitParams, getSupplementExclusions, addExclusion, deleteExclusion } from '@/database/supplements';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { openDatabase } from '@/database/database';
import { useHierarchicalBack } from '@/hooks/use-hierarchical-back';

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
  
  useHierarchicalBack('edit-supplement');

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
  const [showAddDosageLimit, setShowAddDosageLimit] = useState(false);
  const [newDosageLimitMaxStr, setNewDosageLimitMaxStr] = useState('');
  const [newDosageLimitHoursStr, setNewDosageLimitHoursStr] = useState('24');

  const scrollViewRef = useRef<ScrollView>(null);

  const loadExclusions = useCallback(async () => {
    try {
      const supplementExclusions = await getSupplementExclusions(supplementId);
      setExclusions(supplementExclusions);
    } catch (error) {
      console.error('Failed to load exclusions:', error);
    }
  }, [supplementId]);

  useEffect(() => {
    loadExclusions();
  }, [loadExclusions]);

  const handleAddDosageLimit = async () => {
    try {
      const maxDosage = parseFloat(newDosageLimitMaxStr) || 0;
      const hours = parseFloat(newDosageLimitHoursStr) || 1;
      await addExclusion({
        supplement_id: originalSupplement.id,
        exclusion_type: 'dosage_limit',
        parameters: JSON.stringify({ max_dosage: maxDosage, time_window_hours: hours })
      });

      setShowAddDosageLimit(false);
      setNewDosageLimitMaxStr('');
      setNewDosageLimitHoursStr('24');
      loadExclusions();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to add warning:', error);
      Alert.alert('Error', 'Failed to add warning. Please try again.');
    }
  };

  const handleDeleteExclusion = async (exclusionId: number) => {
    Alert.alert(
      'Delete Warning',
      'Are you sure you want to delete this warning?',
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
              console.error('Failed to delete warning:', error);
              Alert.alert('Error', 'Failed to delete warning. Please try again.');
            }
          }
        }
      ]
    );
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

        <ScrollView ref={scrollViewRef} style={styles.content} showsVerticalScrollIndicator={false}>
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
              <ThemedText style={styles.label}>Warnings</ThemedText>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: tintColor }]}
                onPress={() => {
                  setShowAddDosageLimit(true);
                  setNewDosageLimitMaxStr('');
                  setNewDosageLimitHoursStr('24');
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            
            {exclusions.filter(e => e.exclusion_type === 'dosage_limit').map((exclusion) => {
              const params = JSON.parse(exclusion.parameters);
              return (
                <View key={exclusion.id} style={[styles.exclusionCard, { borderColor: tintColor + '20' }]}>
                  <View style={styles.exclusionContent}>
                    <Ionicons
                      name="warning"
                      size={20}
                      color="#FF9500"
                      style={styles.exclusionIcon}
                    />
                    <View style={styles.exclusionText}>
                      <ThemedText style={styles.exclusionTitle}>Dosage Limit</ThemedText>
                      <ThemedText style={styles.exclusionDescription}>
                        Max {params.max_dosage}{originalSupplement.dosage_unit} per {params.time_window_hours} hours
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

            {exclusions.filter(e => e.exclusion_type === 'dosage_limit').length === 0 && (
              <ThemedText style={styles.noExclusionsText}>
                No warnings configured. Tap + to add warnings.
              </ThemedText>
            )}
          </ThemedView>

          {showAddDosageLimit && (
            <ThemedView style={styles.addExclusionSection}>
              <ThemedText style={styles.label}>Add Warning</ThemedText>
              
              <View style={styles.dosageLimitInputs}>
                <View style={styles.dosageInputGroup}>
                  <ThemedText style={styles.dosageLabel}>Max Dosage:</ThemedText>
                  <TextInput
                    style={[styles.dosageInput, { borderColor: tintColor + '30', color: textColor }]}
                    value={newDosageLimitMaxStr}
                    onChangeText={setNewDosageLimitMaxStr}
                    placeholder="Amount"
                    placeholderTextColor="#8E8E93"
                    keyboardType="decimal-pad"
                  />
                  <ThemedText style={styles.unitText}>{originalSupplement.dosage_unit}</ThemedText>
                </View>
                <View style={styles.hoursInputGroup}>
                  <ThemedText style={styles.hoursLabel}>Per:</ThemedText>
                  <TextInput
                    style={[styles.hoursInput, { borderColor: tintColor + '30', color: textColor }]}
                    value={newDosageLimitHoursStr}
                    onChangeText={setNewDosageLimitHoursStr}
                    placeholder="Hours"
                    placeholderTextColor="#8E8E93"
                    keyboardType="decimal-pad"
                  />
                  <ThemedText style={styles.unitText}>hours</ThemedText>
                </View>
              </View>

              <View style={styles.exclusionButtons}>
                <TouchableOpacity
                  style={styles.cancelExclusionButton}
                  onPress={() => setShowAddDosageLimit(false)}
                >
                  <ThemedText style={styles.cancelExclusionText}>Cancel</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.addExclusionButton,
                    { backgroundColor: tintColor },
                    (!newDosageLimitMaxStr || !parseFloat(newDosageLimitMaxStr) || !newDosageLimitHoursStr || !parseFloat(newDosageLimitHoursStr)) && { opacity: 0.5 }
                  ]}
                  onPress={handleAddDosageLimit}
                  disabled={!newDosageLimitMaxStr || !parseFloat(newDosageLimitMaxStr) || !newDosageLimitHoursStr || !parseFloat(newDosageLimitHoursStr)}
                >
                  <ThemedText style={styles.addExclusionText}>Add Warning</ThemedText>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    marginBottom: 20,
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
  scheduleModeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  scheduleModeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  scheduleModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    alignItems: 'center',
  },
  scheduleModeButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  intervalInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  intervalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  intervalInput: {
    width: 60,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  timeWindowSection: {
    marginBottom: 16,
  },
  daysHint: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 4,
  },
  daysSelectorContainer: {
    marginTop: 4,
  },
  daysSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
});