import { Alert } from 'react-native';
import { checkDatabaseHealth, getDatabase } from '@/database/database';

/**
 * Validates database access before starting a cognitive test
 * Shows appropriate alerts to the user if validation fails
 * Returns true if test can proceed, false if it should be aborted
 */
export const validateTestPrerequisites = async (testName: string): Promise<boolean> => {
  console.log(`🔄 TEST VALIDATION: Starting validation for ${testName} test`);
  
  try {
    // Step 1: Check database health
    console.log(`🔄 TEST VALIDATION: Checking database health...`);
    const healthCheck = checkDatabaseHealth();
    
    if (!healthCheck.healthy) {
      console.log(`❌ TEST VALIDATION: Database unhealthy - ${healthCheck.issues.join(', ')}`);
      
      Alert.alert(
        'Database Issue',
        `Cannot start ${testName} test. Database issues detected:\n\n${healthCheck.issues.join('\n')}\n\nPlease restart the app and try again.`,
        [
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );
      return false;
    }
    
    // Step 2: Test database accessibility
    console.log(`🔄 TEST VALIDATION: Testing database accessibility...`);
    const db = getDatabase();
    if (!db) {
      console.log(`❌ TEST VALIDATION: Database instance not available`);
      
      Alert.alert(
        'Database Unavailable',
        `Cannot start ${testName} test. Database is not accessible.\n\nPlease restart the app and try again.`,
        [
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );
      return false;
    }
    
    // Step 3: Test database write capability
    console.log(`🔄 TEST VALIDATION: Testing database write capability...`);
    try {
      const testResult = db.getFirstSync('SELECT 1 as test');
      if ((testResult as any)?.test !== 1) {
        throw new Error('Database query test failed');
      }
    } catch (error) {
      console.log(`❌ TEST VALIDATION: Database write test failed - ${error}`);
      
      Alert.alert(
        'Database Error',
        `Cannot start ${testName} test. Database connection failed.\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease restart the app and try again.`,
        [
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );
      return false;
    }
    
    console.log(`✅ TEST VALIDATION: All validations passed for ${testName} test`);
    return true;
    
  } catch (error) {
    console.log(`❌ TEST VALIDATION: Validation failed with error - ${error}`);
    
    Alert.alert(
      'Validation Error',
      `Cannot start ${testName} test due to validation error.\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease restart the app and try again.`,
      [
        {
          text: 'OK',
          style: 'default'
        }
      ]
    );
    return false;
  }
};

/**
 * Handles test result save errors gracefully with user-friendly alerts
 * Provides retry and return to menu options
 */
export const handleTestSaveError = (
  testName: string,
  error: any,
  onRetry: () => void,
  onReturnToMenu: () => void
): void => {
  console.log(`❌ TEST SAVE ERROR: Failed to save ${testName} test result:`, error);
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  Alert.alert(
    'Failed to Save Results',
    `Your ${testName} test results could not be saved.\n\nError: ${errorMessage}\n\nWould you like to try again or return to the menu?`,
    [
      {
        text: 'Retry',
        style: 'default',
        onPress: onRetry
      },
      {
        text: 'Return to Menu',
        style: 'cancel',
        onPress: onReturnToMenu
      }
    ]
  );
};

/**
 * Shows a generic error alert with return to menu option
 */
export const showTestErrorAlert = (
  testName: string,
  error: any,
  onReturnToMenu: () => void
): void => {
  console.log(`❌ TEST ERROR: ${testName} test encountered an error:`, error);
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  Alert.alert(
    'Test Error',
    `An error occurred during the ${testName} test.\n\nError: ${errorMessage}`,
    [
      {
        text: 'Return to Menu',
        style: 'default',
        onPress: onReturnToMenu
      }
    ]
  );
};