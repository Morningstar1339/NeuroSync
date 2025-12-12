// DISABLED FOR V1 - Re-enable for Mk II
/*
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { logSymptom } from '@/database/symptoms';

export default function SymptomLoggingScreen() {
  const router = useRouter();
  const { symptomId, symptomName, region } = useLocalSearchParams<{
    symptomId: string;
    symptomName: string;
    region: string;
  }>();
  
  const [severity, setSeverity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isLogging, setIsLogging] = useState(false);

  const severityLabels = {
    1: 'Very Mild',
    2: 'Mild', 
    3: 'Moderate',
    4: 'Severe',
    5: 'Very Severe'
  };

  const handleLogSymptom = async () => {
    if (!symptomId) {
      Alert.alert('Error', 'No symptom selected');
      return;
    }

    setIsLogging(true);

    try {
      await logSymptom(parseInt(symptomId), severity, notes.trim() || undefined);
      
      Alert.alert(
        'Symptom Logged',
        `${symptomName} logged with severity ${severity}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to home screen
              router.push('/');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error logging symptom:', error);
      Alert.alert('Error', 'Failed to log symptom. Please try again.');
    } finally {
      setIsLogging(false);
    }
  };

  const formatRegionName = (region: string) => {
    return region.charAt(0).toUpperCase() + region.slice(1);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>Log Symptom</ThemedText>
        <ThemedText style={styles.symptomName}>{symptomName}</ThemedText>
        <ThemedText style={styles.region}>{formatRegionName(region || '')}</ThemedText>
      </ThemedView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Severity Level</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            How severe is this symptom right now?
          </ThemedText>

          <ThemedView style={styles.severityContainer}>
            {[1, 2, 3, 4, 5].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.severityButton,
                  severity === level && styles.severityButtonSelected
                ]}
                onPress={() => setSeverity(level)}
              >
                <ThemedText style={[
                  styles.severityNumber,
                  severity === level && styles.severityNumberSelected
                ]}>
                  {level}
                </ThemedText>
                <ThemedText style={[
                  styles.severityLabel,
                  severity === level && styles.severityLabelSelected
                ]}>
                  {severityLabels[level as keyof typeof severityLabels]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>

          <ThemedView style={styles.selectedSeverityDisplay}>
            <ThemedText style={styles.selectedSeverityText}>
              Selected: {severity} - {severityLabels[severity as keyof typeof severityLabels]}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Notes (Optional)</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Add any additional details about this symptom
          </ThemedText>

          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe the symptom, triggers, location, etc..."
            placeholderTextColor="#8E8E93"
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ThemedView>
      </ScrollView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.logButton, isLogging && styles.logButtonDisabled]}
          onPress={handleLogSymptom}
          disabled={isLogging}
        >
          <ThemedText style={styles.logButtonText}>
            {isLogging ? 'Logging...' : 'Log Symptom'}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          disabled={isLogging}
        >
          <ThemedText style={styles.backButtonText}>Back</ThemedText>
        </TouchableOpacity>
      </ThemedView>
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
  symptomName: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  region: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  severityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  severityButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  severityButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#005BBB',
  },
  severityNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000',
  },
  severityNumberSelected: {
    color: 'white',
  },
  severityLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#666',
  },
  severityLabelSelected: {
    color: 'white',
  },
  selectedSeverityDisplay: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedSeverityText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
    color: '#000',
    minHeight: 100,
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  logButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  logButtonText: {
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
*/

export default function SymptomLoggingScreen() {
  return null;
}