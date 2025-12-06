import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Modal, View } from 'react-native';
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

const loadSymptoms = useCallback(async () => {
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
}, [region]);

useEffect(() => {
  loadSymptoms();
}, [loadSymptoms]);

  const handleSymptomSelect = (symptom: Symptom) => {
    router.push({
      pathname: '/symptom-logging',
      params: {
        symptomId: symptom.id.toString(),
        symptomName: symptom.description,
        region: region,
      },
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
      const trimmed = newSymptomText.trim();
      const symptomId = await addSymptom(region, trimmed);
      setShowAddModal(false);
      setNewSymptomText('');

      // Navigate directly to logging for the new symptom
      router.push({
        pathname: '/symptom-logging',
        params: {
          symptomId: symptomId.toString(),
          symptomName: trimmed,
          region: region,
        },
      });
    } catch (error) {
      console.error('Error adding symptom:', error);
      Alert.alert('Error', 'Failed to add new symptom');
    }
  };

  const formatRegionName = (region: string) => {
    if (!region) return '';
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

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {symptoms.length === 0 ? (
          <ThemedView style={styles.emptyStateContainer}>
            <ThemedText style={styles.emptyStateTitle}>No symptoms yet</ThemedText>
            <ThemedText style={styles.emptyStateSubtitle}>
              Add your first symptom for this region.
            </ThemedText>
          </ThemedView>
        ) : (
          symptoms.map((symptom) => (
            <TouchableOpacity
              key={symptom.id}
              style={styles.symptomButton}
              onPress={() => handleSymptomSelect(symptom)}
            >
              <ThemedText style={styles.symptomText}>
                {symptom.description}
              </ThemedText>
            </TouchableOpacity>
          ))
        )}

        <ThemedView style={styles.addNewSection}>
          <TouchableOpacity
            style={styles.addNewButton}
            onPress={() => setShowAddModal(true)}
          >
            <ThemedText style={styles.addNewText}>+ Add New Symptom</ThemedText>
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
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Add New Symptom</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Use a short phrase that will be easy to recognize later.
            </ThemedText>

            <TextInput
              style={styles.textInput}
              placeholder="e.g. Sharp pain behind right eye"
              placeholderTextColor="#999"
              value={newSymptomText}
              onChangeText={setNewSymptomText}
            />

            <View style={styles.modalButtons}>
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
            </View>
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  symptomButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 10,
  },
  symptomText: {
    fontSize: 16,
  },
  addNewSection: {
    marginTop: 16,
  },
  addNewButton: {
    backgroundColor: '#30B454',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addNewText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 12,
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
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
