import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';
import { validateTestPrerequisites, handleTestSaveError } from '@/utils/test-validation';
import { checkDatabaseHealth } from '@/database/database';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const BUBBLE_SIZE = 40; // ~1cm on most devices
const TEST_DURATION = 10000; // 10 seconds

interface BubblePosition {
  x: number;
  y: number;
}

export default function ReflexesTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION / 1000);
  const [bubblePosition, setBubblePosition] = useState<BubblePosition>({ x: 0, y: 0 });
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  
  const gameTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  const generateRandomPosition = (): BubblePosition => {
    // Calculate safe play area using safe area insets
    const EXTRA_BUFFER = 100; // Extra buffer for Android navigation bar
    const SIDE_MARGIN = 50; // Margin from left/right edges
    const HEADER_HEIGHT = 60; // Reduced space for game header (timer/score)
    
    // Calculate play area boundaries with safe area insets
    // Start from 15% down from top to allow upper spawning
    const playAreaTop = Math.max(insets.top + HEADER_HEIGHT, screenHeight * 0.15);
    const playAreaBottom = screenHeight - insets.bottom - EXTRA_BUFFER;
    const playAreaLeft = insets.left + SIDE_MARGIN;
    const playAreaRight = screenWidth - insets.right - SIDE_MARGIN;
    
    // Use full allowed range from 15% to 80% of screen height
    const safePlayAreaBottom = Math.min(playAreaBottom, screenHeight * 0.8);
    
    // Ensure bubbles don't get cut off at edges
    const adjustedMinX = playAreaLeft + BUBBLE_SIZE / 2;
    const adjustedMaxX = playAreaRight - BUBBLE_SIZE / 2;
    const adjustedMinY = playAreaTop + BUBBLE_SIZE / 2;
    const adjustedMaxY = safePlayAreaBottom - BUBBLE_SIZE / 2;
    
    // Ensure we have a valid play area
    if (adjustedMaxX <= adjustedMinX || adjustedMaxY <= adjustedMinY) {
      // Fallback to center if play area is too small
      return {
        x: screenWidth / 2,
        y: screenHeight / 2,
      };
    }
    
    return {
      x: Math.random() * (adjustedMaxX - adjustedMinX) + adjustedMinX,
      y: Math.random() * (adjustedMaxY - adjustedMinY) + adjustedMinY,
    };
  };

  const startGame = async () => {
    console.log('🔄 REFLEXES TEST: Starting game with pre-validation...');
    
    // Pre-test validation: Check database accessibility
    const canProceed = await validateTestPrerequisites('Reflexes');
    if (!canProceed) {
      console.log('❌ REFLEXES TEST: Pre-validation failed, aborting test start');
      return;
    }
    
    // Check for active test sessions before starting
    try {
      const activeSession = await isUserInActiveTestSession();
      if (activeSession.isActive && activeSession.activeTest?.test_type !== 'reflexes') {
        Alert.alert(
          'Test Session Active',
          `You have an active ${activeSession.activeTest?.test_type} test (${Math.ceil(activeSession.timeRemaining || 0)}s remaining). Starting another test may affect your results.\n\nContinue anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => startGameNow() }
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Failed to check active session:', error);
    }
    
    console.log('✅ REFLEXES TEST: Pre-validation passed, starting game');
    startGameNow();
  };

  const startGameNow = () => {
    setGameState('playing');
    setScore(0);
    setTimeLeft(TEST_DURATION / 1000);
    setBubblePosition(generateRandomPosition());
    
    // Start countdown timer
    countdownTimer.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // End game after duration
    gameTimer.current = setTimeout(() => {
      endGame();
    }, TEST_DURATION);
  };

  const endGame = async () => {
    setGameState('finished');
    if (gameTimer.current) {
      clearTimeout(gameTimer.current);
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    
    // Save test result with graceful error handling
    const saveTestResult = async () => {
      try {
        console.log('🔄 REFLEXES TEST: Saving test result...');
        const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
        const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
        
        const rawData = {
          finalScore: score,
          testDuration: TEST_DURATION / 1000,
          bubblesHit: score > 0 ? score : 0,
          misses: score < 0 ? Math.abs(score) : 0
        };
        await saveCognitiveTestResult('reflexes', score, rawData, TEST_DURATION / 1000, studyId, supplementLogId);
        
        // Mark scheduled test as completed if this was for a study
        if (scheduledTest) {
          await completeScheduledTest(scheduledTest.id);
        }
        
        console.log('✅ REFLEXES TEST: Test result saved successfully');
      } catch (error) {
        console.log('❌ REFLEXES TEST: Failed to save test result:', error);
        
        // Show error alert with retry option
        handleTestSaveError(
          'Reflexes',
          error,
          saveTestResult, // Retry function
          handleBackToMenu // Return to menu function
        );
      }
    };
    
    await saveTestResult();
  };

  const handleBubbleTap = () => {
    if (gameState === 'playing') {
      setScore(prev => prev + 1);
      setBubblePosition(generateRandomPosition());
    }
  };

  const handleScreenTap = () => {
    if (gameState === 'playing') {
      // This is a miss - deduct point
      setScore(prev => prev - 1);
    }
  };

  const handleBackToMenu = () => {
    router.push('/cognitive-tests');
  };

  const handleExitTest = () => {
    if (gameState === 'playing') {
      Alert.alert(
        'Exit Test?',
        'Your progress will not be saved. Are you sure you want to exit?',
        [
          {
            text: 'No',
            style: 'cancel',
          },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => {
              // Clean up timers
              if (gameTimer.current) {
                clearTimeout(gameTimer.current);
              }
              if (countdownTimer.current) {
                clearInterval(countdownTimer.current);
              }
              
              // Handle sequence navigation
              if (params.sequence === 'all-nine') {
                router.push('/tests/all-nine');
              } else if (params.sequence === 'all-three') {
                router.push('/tests/all-three');
              } else {
                router.push('/cognitive-tests');
              }
            },
          },
        ]
      );
    } else {
      // Handle sequence navigation for non-playing states
      if (params.sequence === 'all-nine') {
        router.push('/tests/all-nine');
      } else if (params.sequence === 'all-three') {
        router.push('/tests/all-three');
      } else {
        router.push('/cognitive-tests');
      }
    }
  };

  const handlePlayAgain = () => {
    startGame();
  };

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/memory?sequence=all-nine');
    } else if (params.sequence === 'all-three') {
      router.push('/tests/memory?sequence=all-three');
    } else {
      router.push('/cognitive-tests');
    }
  };

  useEffect(() => {
    // Check for relevant scheduled test and active sessions on component mount
    const checkTestStatus = async () => {
      try {
        // Check for active test session that might overlap
        const activeSession = await isUserInActiveTestSession();
        if (activeSession.isActive && activeSession.activeTest?.test_type !== 'reflexes') {
          setActiveTestSession(activeSession);
        }
        
        // Check for relevant scheduled test
        const relevantTest = await getRelevantScheduledTest('reflexes');
        if (relevantTest) {
          setScheduledTest(relevantTest);
          const context = await getTestContext(relevantTest.id);
          setStudyContext(context);
        }
      } catch (error) {
        console.error('Failed to check for scheduled test:', error);
      }
    };
    
    checkTestStatus();
    
    return () => {
      if (gameTimer.current) {
        clearTimeout(gameTimer.current);
      }
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
    };
  }, []);

  // Navigation event logging
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 NAVIGATED TO: Reflexes Test');
      console.log('DB status on navigation:', checkDatabaseHealth());
      return () => {
        console.log('📱 NAVIGATING AWAY FROM: Reflexes Test');
      };
    }, [])
  );

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
          {(params.sequence === 'all-nine' || params.sequence === 'all-three') && (
            <ThemedView style={[styles.progressBanner, { backgroundColor: tintColor + '15', borderColor: tintColor }]}>
              <ThemedText style={[styles.progressText, { color: tintColor }]}>
                {params.sequence === 'all-nine' ? 'Test 1 of 9' : 'Test 1 of 3'} • Run All Tests Mode
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText type="title" style={styles.title}>Reflexes Test</ThemedText>
          {scheduledTest && studyContext?.supplement_name && (
            <ThemedView style={[styles.studyBanner, { backgroundColor: tintColor + '20', borderColor: tintColor }]}>
              <ThemedText style={[styles.studyText, { color: tintColor }]}>
                📊 Study Test for {studyContext.supplement_name}
              </ThemedText>
            </ThemedView>
          )}
          {activeTestSession && (
            <ThemedView style={[styles.warningBanner, { backgroundColor: '#FF3B30' + '20', borderColor: '#FF3B30' }]}>
              <ThemedText style={[styles.warningText, { color: '#FF3B30' }]}>
                ⚠️ Active {activeTestSession.activeTest?.test_type} test ({Math.ceil(activeTestSession.timeRemaining || 0)}s remaining)
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText style={styles.instructions}>
            Tap the bubbles as quickly as possible!{'\n\n'}
            • +1 point for each bubble tapped{'\n'}
            • -1 point for tapping empty space{'\n'}
            • Test duration: 10 seconds
          </ThemedText>
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: tintColor }]} 
            onPress={startGame}
          >
            <ThemedText style={styles.startButtonText}>Start Test</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
            <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
          </TouchableOpacity>
        </ThemedView>
        </ScrollView>
      </ThemedView>
    );
  }

  if (gameState === 'finished') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.resultsContainer}>
          <ThemedText type="title" style={styles.title}>Test Complete!</ThemedText>
          <ThemedText style={styles.finalScore}>Final Score: {score}</ThemedText>
          <ThemedText style={styles.metricText}>Bubbles Hit: {score > 0 ? score : 0}</ThemedText>
          <ThemedText style={styles.metricText}>Misses: {score < 0 ? Math.abs(score) : 0}</ThemedText>
          <ThemedText style={styles.metricText}>Test Duration: {TEST_DURATION / 1000}s</ThemedText>
          <ThemedText style={styles.metricText}>Accuracy: {score > 0 ? ((score / (score + Math.abs(score < 0 ? score : 0))) * 100).toFixed(1) : '0'}%</ThemedText>
          <ThemedText style={styles.resultMessage}>
            {score >= 15 ? 'Excellent reflexes!' : 
             score >= 10 ? 'Good performance!' : 
             score >= 5 ? 'Not bad!' : 'Keep practicing!'}
          </ThemedText>
          {(params.sequence === 'all-nine' || params.sequence === 'all-three') ? (
            <>
              <TouchableOpacity 
                style={[styles.startButton, { backgroundColor: tintColor }]} 
                onPress={handleNextTestOrFinish}
              >
                <ThemedText style={styles.startButtonText}>Next Test</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={handleExitTest}>
                <ThemedText style={styles.backButtonText}>Exit Test Battery</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.startButton, { backgroundColor: tintColor }]} 
                onPress={handlePlayAgain}
              >
                <ThemedText style={styles.startButtonText}>Play Again</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
                <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </ThemedView>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.gameContainer} 
      onPress={handleScreenTap}
      activeOpacity={1}
    >
      <ThemedView style={[styles.gameHeader, { paddingTop: insets.top + 60 }]}>
        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExitTest}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-outline" size={24} color={tintColor} />
        </TouchableOpacity>
        <View style={styles.gameStats}>
          <ThemedText style={styles.timer}>Time: {timeLeft}s</ThemedText>
          <ThemedText style={styles.scoreText}>Score: {score}</ThemedText>
        </View>
        <View style={styles.headerSpacer} />
      </ThemedView>
      
      <View style={styles.gameArea}>
        <TouchableOpacity
          style={[
            styles.bubble,
            {
              backgroundColor: tintColor,
              left: bubblePosition.x - BUBBLE_SIZE / 2,
              top: bubblePosition.y - BUBBLE_SIZE / 2,
            }
          ]}
          onPress={handleBubbleTap}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
    paddingBottom: 60,
    minHeight: screenHeight,
  },
  instructionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  resultsContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 32,
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    opacity: 0.7,
  },
  gameContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  exitButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  gameStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    marginHorizontal: 20,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  timer: {
    fontSize: 18,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '600',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  bubble: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  finalScore: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 32,
  },
  metricText: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 20,
    opacity: 0.8,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  progressBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  studyBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  studyText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});