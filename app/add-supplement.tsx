import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, View, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { addSupplement, checkSupplementExists } from '@/database/supplements';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';

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

export default function AddSupplementScreen() {
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [unit, setUnit] = useState('mg');
  const [selectedIcon, setSelectedIcon] = useState('medical');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a supplement name');
      return;
    }

    if (!dosage.trim() || isNaN(Number(dosage))) {
      Alert.alert('Error', 'Please enter a valid dosage amount');
      return;
    }

    if (!unit.trim()) {
      Alert.alert('Error', 'Please enter a dosage unit');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if supplement with this name already exists
      try {
        const exists = await checkSupplementExists(name.trim());
        if (exists) {
          Alert.alert('Error', 'A supplement with this name already exists');
          setIsSubmitting(false);
          return;
        }
      } catch (checkError) {
        console.error('Failed to check supplement existence:', checkError);
        // Continue with adding - the addSupplement function will handle duplicates
      }

      await addSupplement({
        name: name.trim(),
        default_dosage: Number(dosage),
        dosage_unit: unit.trim(),
        icon_id: selectedIcon,
        color: selectedColor,
        schedule_enabled: false,
        study_enabled: false
      });

      router.back();
    } catch (error) {
      console.error('Failed to add supplement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Provide specific error messages for common issues
      if (errorMessage.includes('Database not initialized')) {
        Alert.alert('Database Error', 'The database is still loading. Please wait a moment and try again.');
      } else if (errorMessage.includes('already exists')) {
        Alert.alert('Duplicate Supplement', errorMessage);
      } else if (errorMessage.includes('dosage')) {
        Alert.alert('Invalid Dosage', errorMessage);
      } else {
        Alert.alert('Error', `Failed to add supplement: ${errorMessage}`);
      }
    } finally {
      setIsSubmitting(false);
    }
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
        <ThemedText type="title" style={styles.title}>Add Supplement</ThemedText>
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
          <TextInput
            style={[styles.input, { borderColor: tintColor + '30', color: textColor }]}
            value={name}
            onChangeText={setName}
            placeholder="Enter supplement name"
            placeholderTextColor="#8E8E93"
            autoCapitalize="words"
            maxLength={50}
          />
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
            <TextInput
              style={[styles.unitInput, { borderColor: tintColor + '30', color: textColor }]}
              value={unit}
              onChangeText={setUnit}
              placeholder="Unit"
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              maxLength={10}
            />
          </View>
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
                  {name || 'Supplement Name'}
                </ThemedText>
                <ThemedText style={[styles.previewDosage, { color: getContrastingTextColor(selectedColor), opacity: 0.8 }]}>
                  {dosage || '0'} {unit}
                </ThemedText>
              </View>
            </View>
          </View>
        </ThemedView>
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
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
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
  unitInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
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
    marginBottom: 40,
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
});