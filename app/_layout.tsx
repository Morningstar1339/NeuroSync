import React, { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, AppState } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeDatabase, isDatabaseInitialized, resetDatabaseState, initializeDatabaseWithRetry, checkDatabaseHealth } from '@/database/database';
import { notificationManager } from '@/services/notification-manager';

export const unstable_settings = {
  anchor: '(tabs)',
};

type AppState = 'loading' | 'ready' | 'error';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appState, setAppState] = useState<AppState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    initializeApp();
  }, []);

  // React lifecycle logging
  useEffect(() => {
    console.log('🟢 APP MOUNTED');
    return () => {
      console.log('🔴 APP UNMOUNTING');
    };
  }, []);

  // App state change logging
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('🔄 APP STATE CHANGED:', nextAppState);
      // Check database state when app state changes
      console.log('DB status after state change:', checkDatabaseHealth());
    });
    
    return () => subscription.remove();
  }, []);

  // Memory pressure logging
  useEffect(() => {
    const subscription = AppState.addEventListener('memoryWarning', () => {
      console.log('⚠️ MEMORY WARNING RECEIVED');
      console.log('DB status during memory warning:', checkDatabaseHealth());
    });
    return () => subscription.remove();
  }, []);

  const initializeApp = async () => {
    console.log('RootLayout: Starting app initialization...');
    setAppState('loading');
    setErrorMessage('');

    try {
      // Step 1: Initialize database with retry logic
      console.log('RootLayout: Initializing database with retry logic...');
      const dbResult = await initializeDatabaseWithRetry(3);
      
      if (!dbResult.success) {
        throw new Error(`Database initialization failed after ${dbResult.attempts} attempts: ${dbResult.error}`);
      }
      
      console.log(`RootLayout: Database initialized successfully on attempt ${dbResult.attempts}`);

      // Step 2: Initialize notification manager with database ready
      console.log('RootLayout: Initializing notification manager...');
      await notificationManager.initialize(true);
      notificationManager.setDatabaseReady();
      
      console.log('RootLayout: App initialization completed successfully');
      setAppState('ready');

    } catch (error) {
      console.error('RootLayout: App initialization failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown initialization error');
      setAppState('error');
      
      // Try to initialize notification manager without database as fallback
      try {
        console.log('RootLayout: Attempting fallback notification initialization...');
        await notificationManager.initialize(false);
      } catch (notificationError) {
        console.error('RootLayout: Fallback notification initialization failed:', notificationError);
      }
    }
  };

  const handleRetry = async () => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    console.log(`RootLayout: Retry attempt ${newRetryCount}`);
    
    // Reset database state before retrying
    resetDatabaseState();
    
    // Wait a bit before retrying
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await initializeApp();
  };

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset Database',
      'This will clear all app data and restart the app. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Reset database state
              resetDatabaseState();
              setRetryCount(0);
              await initializeApp();
            } catch (error) {
              console.error('Failed to reset database:', error);
            }
          }
        }
      ]
    );
  };

  // Loading screen
  if (appState === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Initializing NeuroSync...</Text>
          <Text style={styles.subText}>Setting up database and notifications</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Error screen
  if (appState === 'error') {
    return (
      <SafeAreaProvider>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Initialization Failed</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.buttonText}>
                Retry {retryCount > 0 && `(${retryCount})`}
              </Text>
            </TouchableOpacity>
            
            {retryCount >= 2 && (
              <TouchableOpacity style={styles.resetButton} onPress={handleResetDatabase}>
                <Text style={styles.buttonText}>Reset Database</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.helpText}>
            If this problem persists, try restarting the app or clearing app data.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Main app (database is ready)
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="supplements" options={{ headerShown: false }} />
          <Stack.Screen name="add-supplement" options={{ headerShown: false }} />
          <Stack.Screen name="edit-supplement" options={{ headerShown: false }} />
          <Stack.Screen name="log-supplement" options={{ headerShown: false }} />
          <Stack.Screen name="body-diagram" options={{ headerShown: false }} />
          <Stack.Screen name="symptom-selection" options={{ headerShown: false }} />
          <Stack.Screen name="symptom-logging" options={{ headerShown: false }} />
          <Stack.Screen name="cognitive-tests" options={{ headerShown: false }} />
          <Stack.Screen name="tests/reflexes" options={{ headerShown: false }} />
          <Stack.Screen name="tests/memory" options={{ headerShown: false }} />
          <Stack.Screen name="tests/connections" options={{ headerShown: false }} />
          <Stack.Screen name="tests/all-three" options={{ headerShown: false }} />
          <Stack.Screen name="tests/rock-dodger" options={{ headerShown: false }} />
          <Stack.Screen name="tests/pattern-matcher" options={{ headerShown: false }} />
          <Stack.Screen name="tests/melody-repeater" options={{ headerShown: false }} />
          <Stack.Screen name="tests/tile-puzzle" options={{ headerShown: false }} />
          <Stack.Screen name="tests/trail-maker" options={{ headerShown: false }} />
          <Stack.Screen name="tests/n-back" options={{ headerShown: false }} />
          <Stack.Screen name="tests/all-nine" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="database-debug" options={{ headerShown: false }} />
          <Stack.Screen name="sleep-logs" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 16,
  },
});
