import React, { useState } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import {
  instrumentedAddSupplement,
  instrumentedLogSupplement,
  instrumentedLogSymptom,
  instrumentedSaveCognitiveTestResult,
  instrumentedLogSleep,
  clearViolations,
  getReport,
} from '@/utils/instrumented-db';

export default function InvariantTestScreen() {
  const router = useRouter();
  const [results, setResults] = useState<string[]>([]);

  const addResult = (msg: string) => {
    setResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runTest = async (name: string, testFn: () => Promise<void>) => {
    addResult(`Running: ${name}...`);
    try {
      await testFn();
      addResult(`Completed: ${name}`);
    } catch (error) {
      addResult(`Error in ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testEmptySupplementName = async () => {
    await runTest('Empty Supplement Name', async () => {
      await instrumentedAddSupplement({
        name: '',
        default_dosage: 100,
        dosage_unit: 'mg',
        schedule_enabled: false,
        study_enabled: false,
      });
    });
  };

  const testNegativeDosage = async () => {
    await runTest('Negative Dosage', async () => {
      await instrumentedAddSupplement({
        name: 'Test Supplement',
        default_dosage: -50,
        dosage_unit: 'mg',
        schedule_enabled: false,
        study_enabled: false,
      });
    });
  };

  const testZeroDosage = async () => {
    await runTest('Zero Dosage', async () => {
      await instrumentedAddSupplement({
        name: 'Test Supplement',
        default_dosage: 0,
        dosage_unit: 'mg',
        schedule_enabled: false,
        study_enabled: false,
      });
    });
  };

  const testInvalidColor = async () => {
    await runTest('Invalid Color Format', async () => {
      await instrumentedAddSupplement({
        name: 'Test Supplement',
        default_dosage: 100,
        dosage_unit: 'mg',
        color: 'not-a-color',
        schedule_enabled: false,
        study_enabled: false,
      });
    });
  };

  const testInvalidSupplementId = async () => {
    await runTest('Invalid Supplement ID (log)', async () => {
      await instrumentedLogSupplement(-1, 100);
    });
  };

  const testInvalidSeverity = async () => {
    await runTest('Invalid Severity (0)', async () => {
      await instrumentedLogSymptom(1, 0);
    });
  };

  const testSeverityTooHigh = async () => {
    await runTest('Severity Too High (10)', async () => {
      await instrumentedLogSymptom(1, 10);
    });
  };

  const testNegativeScore = async () => {
    await runTest('Negative Score', async () => {
      await instrumentedSaveCognitiveTestResult('memory', -100);
    });
  };

  const testInvalidAccuracy = async () => {
    await runTest('Invalid Accuracy (150%)', async () => {
      await instrumentedSaveCognitiveTestResult('memory', 50, undefined, undefined, undefined, undefined, 150);
    });
  };

  const testInvalidTestType = async () => {
    await runTest('Invalid Test Type', async () => {
      await instrumentedSaveCognitiveTestResult('invalid_test' as any, 50);
    });
  };

  const testSleepEndBeforeStart = async () => {
    await runTest('Sleep End Before Start', async () => {
      const now = Math.floor(Date.now() / 1000);
      await instrumentedLogSleep(now, now - 3600);
    });
  };

  const testInvalidTimestamp = async () => {
    await runTest('Invalid Timestamp (negative)', async () => {
      await instrumentedLogSleep(-1000, 1000);
    });
  };

  const runAllTests = async () => {
    clearViolations();
    setResults([]);
    addResult('Starting all invariant tests...');
    addResult('---');

    await testEmptySupplementName();
    await testNegativeDosage();
    await testZeroDosage();
    await testInvalidColor();
    await testInvalidSupplementId();
    await testInvalidSeverity();
    await testSeverityTooHigh();
    await testNegativeScore();
    await testInvalidAccuracy();
    await testInvalidTestType();
    await testSleepEndBeforeStart();
    await testInvalidTimestamp();

    addResult('---');
    addResult('All tests completed!');
    
    const report = getReport();
    addResult(`Total violations: ${report.totalViolations}`);
    addResult('By module:');
    Object.entries(report.byModule).forEach(([mod, count]) => {
      addResult(`  ${mod}: ${count}`);
    });
  };

  const showDetailedReport = () => {
    const report = getReport();
    
    if (report.totalViolations === 0) {
      Alert.alert('No Violations', 'No invariant violations have been recorded.');
      return;
    }

    const details = report.violations.map((v, i) => 
      `${i + 1}. [${v.phase}] ${v.module}.${v.function}\n` +
      `   Invariant: ${v.invariant}\n` +
      `   Expected: ${v.expected}\n` +
      `   Actual: ${JSON.stringify(v.actual)}`
    ).join('\n\n');

    Alert.alert(
      `${report.totalViolations} Violations Found`,
      details.substring(0, 2000) + (details.length > 2000 ? '\n\n... (truncated)' : ''),
      [{ text: 'OK' }]
    );
  };

  const clearResults = () => {
    clearViolations();
    setResults([]);
    addResult('Cleared all violations and results');
  };

  return (
    <ThemedView style={styles.container} safeArea>
      <ThemedView style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backText}>Back</ThemedText>
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Invariant Tests</ThemedText>
      </ThemedView>

      <ThemedView style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={runAllTests}>
          <ThemedText style={styles.buttonText}>Run All Tests</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={showDetailedReport}>
          <ThemedText style={styles.buttonText}>View Report</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearResults}>
          <ThemedText style={styles.buttonText}>Clear</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Individual Tests</ThemedText>
      
      <ScrollView style={styles.testList}>
        <TouchableOpacity style={styles.testButton} onPress={testEmptySupplementName}>
          <ThemedText>Empty Supplement Name</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testNegativeDosage}>
          <ThemedText>Negative Dosage</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testZeroDosage}>
          <ThemedText>Zero Dosage</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testInvalidColor}>
          <ThemedText>Invalid Color Format</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testInvalidSupplementId}>
          <ThemedText>Invalid Supplement ID</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testInvalidSeverity}>
          <ThemedText>Severity = 0 (invalid)</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testSeverityTooHigh}>
          <ThemedText>Severity = 10 (too high)</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testNegativeScore}>
          <ThemedText>Negative Test Score</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testInvalidAccuracy}>
          <ThemedText>Accuracy = 150% (invalid)</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testInvalidTestType}>
          <ThemedText>Invalid Test Type</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testSleepEndBeforeStart}>
          <ThemedText>Sleep End Before Start</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={testInvalidTimestamp}>
          <ThemedText>Negative Timestamp</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      <ThemedText type="subtitle" style={styles.sectionTitle}>Results</ThemedText>
      
      <ScrollView style={styles.resultsContainer}>
        {results.length === 0 ? (
          <ThemedText style={styles.placeholder}>Run tests to see results...</ThemedText>
        ) : (
          results.map((result, index) => (
            <ThemedText key={index} style={styles.resultText}>{result}</ThemedText>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 8,
  },
  testList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#E5E5EA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 12,
  },
  placeholder: {
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  resultText: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
  },
});
