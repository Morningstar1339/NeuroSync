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
  const [gameAreaSize, setGameAreaSize] = useState({ width: 0, height: 0 });
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [totalTargets, setTotalTargets] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const lastBubbleTime = useRef<number>(0);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION / 1000);
  const [bubblePosition, setBubblePosition] = useState<BubblePosition>({ x: 0, y: 0 });
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  
  const gameTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

const generateRandomPosition = (): BubblePosition => {
  // If we don't know the layout yet, just center the bubble as a fallback
  if (!gameAreaSize.width || !gameAreaSize.height) {
    return {
      x: screenWidth / 2,
      y: screenHeight / 2,
    };
  }

  // Margins *within the game area* (not the whole screen)
  const SIDE_MARGIN = 40;
  const TOP_MARGIN = 20;
  const BOTTOM_MARGIN = insets.bottom + 32; // keep clear of gesture/nav area

  const minX = SIDE_MARGIN + BUBBLE_SIZE / 2;
  const maxX = gameAreaSize.width - SIDE_MARGIN - BUBBLE_SIZE / 2;

  const minY = TOP_MARGIN + BUBBLE_SIZE / 2;
  const maxY = gameAreaSize.height - BOTTOM_MARGIN - BUBBLE_SIZE / 2;

  // If layout is too tight for our margins, fall back to center
  if (minX >= maxX || minY >= maxY) {
    return {
      x: gameAreaSize.width / 2,
      y: gameAreaSize.height / 2,
    };
  }

  return {
    x: Math.random() * (maxX - minX) + minX,
    y: Math.random() * (maxY - minY) + minY,
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
    setHits(0);
    setMisses(0);
    setTotalTargets(1);
    setReactionTimes([]);
    setTimeLeft(TEST_DURATION / 1000);
    lastBubbleTime.current = Date.now();
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
        
        const accuracy = totalTargets > 0 ? hits / totalTargets : 0;
        const avgReactionTime = reactionTimes.length > 0 
          ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length 
          : 0;
        
        const rawData = {
          finalScore: score,
          testDuration: TEST_DURATION / 1000,
          bubblesHit: hits,
          misses: misses,
          totalTargets,
          accuracy,
          speed: avgReactionTime
        };
        await saveCognitiveTestResult('reflexes', score, rawData, TEST_DURATION / 1000, studyId, supplementLogId, accuracy, avgReactionTime);
        
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
      const reactionTime = Date.now() - lastBubbleTime.current;
      setReactionTimes(prev => [...prev, reactionTime]);
      setHits(prev => prev + 1);
      setScore(prev => prev + 1);
      setTotalTargets(prev => prev + 1);
      lastBubbleTime.current = Date.now();
      setBubblePosition(generateRandomPosition());
    }
  };

  const handleScreenTap = () => {
    if (gameState === 'playing') {
      setMisses(prev => prev + 1);
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
              
              if (params.sequence === 'all-seven') {
                router.push('/tests/all-nine');
              } else {
                router.push('/cognitive-tests');
              }
            },
          },
        ]
      );
    } else {
      if (params.sequence === 'all-seven') {
        router.push('/tests/all-nine');
      } else {
        router.push('/cognitive-tests');
      }
    }
  };

  const handlePlayAgain = () => {
    startGame();
  };

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-seven') {
      router.push('/tests/memory?sequence=all-seven');
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
          {params.sequence === 'all-seven' && (
            <ThemedView style={[styles.progressBanner, { backgroundColor: tintColor + '15', borderColor: tintColor }]}>
              <ThemedText style={[styles.progressText, { color: tintColor }]}>
                Test 1 of 7 • Run All Tests Mode
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
          <ThemedText style={styles.metricText}>Accuracy: {totalTargets > 0 ? ((hits / totalTargets) * 100).toFixed(1) : '0'}% | Speed: {reactionTimes.length > 0 ? (reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0) : '0'}ms</ThemedText>
          <ThemedText style={styles.metricText}>Bubbles Hit: {hits}</ThemedText>
          <ThemedText style={styles.metricText}>Misses: {misses}</ThemedText>
          <ThemedText style={styles.metricText}>Test Duration: {TEST_DURATION / 1000}s</ThemedText>
          <ThemedText style={styles.resultMessage}>
            {score >= 15 ? 'Excellent reflexes!' : 
             score >= 10 ? 'Good performance!' : 
             score >= 5 ? 'Not bad!' : 'Keep practicing!'}
          </ThemedText>
          {params.sequence === 'all-seven' ? (
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
      
      <View
  style={styles.gameArea}
  onLayout={(event) => {
    const { width, height } = event.nativeEvent.layout;
    setGameAreaSize({ width, height });
  }}
>

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