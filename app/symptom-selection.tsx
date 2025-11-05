import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSymptomsByRegion, addSymptom, Symptom, BodyRegion } from '@/database/symptoms';

export default function SymptomSelectionScreen() {
  const router = useRouter();
  const { region } = useLocalSearchParams<{ region: BodyRegion }>();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymptomText, setNewSymptomText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSymptoms();
  }, [region]);

  const loadSymptoms = async () => {
    if (!region) return;
    
    try {
      const existingSymptoms = await getSymptomsByRegion(region);
      setSymptoms(existingSymptoms);
    } catch (error) {
      console.error('Error loading symptoms:', error);
      Alert.alert('Error', 'Failed to load symptoms');
    } finally {
      setLoading(false);
    }
  };

  const handleSymptomSelect = (symptom: Symptom) => {
    router.push({
      pathname: '/symptom-logging',
      params: { 
        symptomId: symptom.id.toString(),
        symptomName: symptom.description,
        region: region 
      }
    });
  };

  const handleAddNewSymptom = async () => {
    if (!newSymptomText.trim()) {
      Alert.alert('Error', 'Please enter a symptom description');
      return;
    }

    if (!region) {
      Alert.alert('Error', 'No region selected');
      return;
    }

    try {
      const symptomId = await addSymptom(region, newSymptomText.trim());
      setShowAddModal(false);
      setNewSymptomText('');
      
      // Navigate to symptom logging with the new symptom
      router.push({
        pathname: '/symptom-logging',
        params: { 
          symptomId: symptomId.toString(),
          symptomName: newSymptomText.trim(),
          region: region 
        }
      });
    } catch (error) {
      console.error('Error adding symptom:', error);
      Alert.alert('Error', 'Failed to add new symptom');
    }
  };

  const formatRegionName = (region: string) => {
    return region.charAt(0).toUpperCase() + region.slice(1);
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading symptoms...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          {formatRegionName(region || '')} Symptoms
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Select a symptom or add a new one
        </ThemedText>
      </ThemedView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {symptoms.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Previously Logged Symptoms</ThemedText>
            {symptoms.map((symptom) => (
              <TouchableOpacity
                key={symptom.id}
                style={styles.symptomButton}
                onPress={() => handleSymptomSelect(symptom)}
              >
                <ThemedText style={styles.symptomText}>{symptom.description}</ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>
        )}

        <ThemedView style={styles.section}>
          <TouchableOpacity
            style={styles.addNewButton}
            onPress={() => setShowAddModal(true)}
          >
            <ThemedText style={styles.addNewText}>+ Add New Custom Symptom</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>

      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.back()}
      >
        <ThemedText style={styles.backButtonText}>Back to Body Diagram</ThemedText>
      </TouchableOpacity>

      {/* Add New Symptom Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Add New Symptom</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Describe the symptom for {formatRegionName(region || '')}
            </ThemedText>
            
            <TextInput
              style={styles.textInput}
              value={newSymptomText}
              onChangeText={setNewSymptomText}
              placeholder="e.g., Headache, Sharp pain, Numbness..."
              placeholderTextColor="#8E8E93"
              multiline={false}
              autoFocus={true}
            />

            <ThemedView style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewSymptomText('');
                }}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddNewSymptom}
              >
                <ThemedText style={styles.addButtonText}>Add Symptom</ThemedText>
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
    marginVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  symptomButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  symptomText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  addNewButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#30B454',
  },
  addNewText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
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
    marginBottom: 8,
    color: '#000',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#F8F8F8',
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
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
  addButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});