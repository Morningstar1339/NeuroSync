import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Alert, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
// DISABLED FOR V1 - Re-enable for Mk II
// import { SleepTracker } from '@/components/sleep-tracker';
import { useRouter } from 'expo-router';
import { notificationManager } from '@/services/notification-manager';
import { isDatabaseInitialized } from '@/database/database';

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    // Database should already be initialized by RootLayout
    // Just verify it's ready and log status
    const checkAppStatus = () => {
      const dbReady = isDatabaseInitialized();
      console.log('HomeScreen: Database ready status:', dbReady);
      
      if (!dbReady) {
        console.warn('HomeScreen: Database not ready! This should not happen.');
      }
    };
    
    checkAppStatus();
    
    // Cleanup notification manager on unmount
    return () => {
      notificationManager.cleanup();
    };
  }, []);

  const handleLogSupplement = () => {
    router.push('/supplements');
  };

  // DISABLED FOR V1 - Re-enable for Mk II
  // const handleLogSymptom = () => {
  //   router.push('/body-diagram');
  // };

  const handleCognitiveTest = () => {
    router.push('/cognitive-tests');
  };

  const handleMenu = () => {
    Alert.alert('Menu', 'Select an option:', [
      // DISABLED FOR V1 - Re-enable for Mk II
      // { text: 'Sleep Logs', onPress: () => router.push('/sleep-logs') },
      { text: 'Export Data', onPress: () => router.push('/export') },
      { text: 'Notifications', onPress: () => router.push('/notification-settings') },
      { text: 'Help', onPress: () => router.push('/help') },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  return (
    <ThemedView style={styles.container} safeArea>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* DISABLED FOR V1 - Re-enable for Mk II */}
      {/* <SleepTracker /> */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={styles.title}>NeuroSync</ThemedText>
      </ThemedView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity style={styles.mainButton} onPress={handleLogSupplement}>
          <ThemedText type="subtitle" style={styles.buttonText}>Log Supplement</ThemedText>
        </TouchableOpacity>

        {/* DISABLED FOR V1 - Re-enable for Mk II */}
        {/* <TouchableOpacity style={styles.mainButton} onPress={handleLogSymptom}>
          <ThemedText type="subtitle" style={styles.buttonText}>Log Symptom</ThemedText>
        </TouchableOpacity> */}

        <TouchableOpacity style={styles.mainButton} onPress={handleCognitiveTest}>
          <ThemedText type="subtitle" style={styles.buttonText}>Cognitive Test</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={styles.bottomContainer}>
        <TouchableOpacity style={styles.smallButton} onPress={handleMenu}>
          <ThemedText style={styles.smallButtonText}>Menu</ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.smallButton} onPress={handleSettings}>
          <ThemedText style={styles.smallButtonText}>Settings</ThemedText>
        </TouchableOpacity>
      </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    minHeight: screenHeight * 0.9,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  buttonContainer: {
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
    marginVertical: 40,
  },
  mainButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  smallButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    minHeight: 44,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  smallButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
});
