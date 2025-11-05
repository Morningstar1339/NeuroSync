import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Alert, ScrollView, Animated } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const BALL_SIZES = [15, 20, 25]; // small, medium, large balls for difficulty
const TEST_DURATION = 15000; // 15 seconds
const PHYSICS_INTERVAL = 16; // 60fps physics simulation
const MIN_BALLS = 20;
const MAX_BALLS = 30;
const BALL_SPEED_MULTIPLIER = 2;

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  animatedX: Animated.Value;
  animatedY: Animated.Value;
}

export default function BallCountingTestScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'counting' | 'finished'>('ready');
  const [balls, setBalls] = useState<Ball[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION / 1000);
  const [actualBallCount, setActualBallCount] = useState(0);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  const [gameAreaBounds, setGameAreaBounds] = useState<{top: number, bottom: number, left: number, right: number} | null>(null);
  
  const startTime = useRef<number>(0);
  const physicsInterval = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  const calculateGameAreaBounds = () => {
    // Calculate proper safe area bounds for ball movement
    const headerHeight = 100; // Space for timer and instruction
    const footerHeight = 180; // Space for number buttons
    const sideMargin = 20;
    
    return {
      top: insets.top + headerHeight,
      bottom: screenHeight - insets.bottom - footerHeight,
      left: sideMargin,
      right: screenWidth - sideMargin
    };
  };

  const generateBalls = (): Ball[] => {
    const ballCount = Math.floor(Math.random() * (MAX_BALLS - MIN_BALLS + 1)) + MIN_BALLS;
    const newBalls: Ball[] = [];
    const bounds = calculateGameAreaBounds();
    setGameAreaBounds(bounds);
    
    // More varied colors to make tracking harder
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF9FF3', '#54A0FF'];
    
    for (let i = 0; i < ballCount; i++) {
      const size = BALL_SIZES[Math.floor(Math.random() * BALL_SIZES.length)];
      const x = Math.random() * (bounds.right - bounds.left - size) + bounds.left;
      const y = Math.random() * (bounds.bottom - bounds.top - size) + bounds.top;
      
      newBalls.push({
        id: i,
        x,
        y,
        vx: (Math.random() - 0.5) * 8 * BALL_SPEED_MULTIPLIER, // Random velocity -8 to 8
        vy: (Math.random() - 0.5) * 8 * BALL_SPEED_MULTIPLIER,
        size,
        color: colors[i % colors.length],
        animatedX: new Animated.Value(x),
        animatedY: new Animated.Value(y)
      });
    }
    
    setActualBallCount(ballCount);
    return newBalls;
  };

  const checkBallCollision = (ball1: Ball, ball2: Ball): boolean => {
    const dx = ball1.x - ball2.x;
    const dy = ball1.y - ball2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (ball1.size + ball2.size) / 2;
  };

  const handleBallCollision = (ball1: Ball, ball2: Ball) => {
    // Calculate collision angle
    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return; // Prevent division by zero
    
    // Normalize collision vector
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Relative velocity in collision normal direction
    const dvx = ball2.vx - ball1.vx;
    const dvy = ball2.vy - ball1.vy;
    const dvn = dvx * nx + dvy * ny;
    
    // Do not resolve if velocities are separating
    if (dvn > 0) return;
    
    // Collision impulse (simplified elastic collision)
    const impulse = 2 * dvn / 2; // Assuming equal masses
    
    // Update velocities
    ball1.vx += impulse * nx;
    ball1.vy += impulse * ny;
    ball2.vx -= impulse * nx;
    ball2.vy -= impulse * ny;
    
    // Add slight randomness to prevent sticking
    ball1.vx += (Math.random() - 0.5) * 0.5;
    ball1.vy += (Math.random() - 0.5) * 0.5;
    ball2.vx += (Math.random() - 0.5) * 0.5;
    ball2.vy += (Math.random() - 0.5) * 0.5;
    
    // Separate overlapping balls
    const overlap = (ball1.size + ball2.size) / 2 - distance;
    if (overlap > 0) {
      const separationX = nx * overlap * 0.5;
      const separationY = ny * overlap * 0.5;
      ball1.x -= separationX;
      ball1.y -= separationY;
      ball2.x += separationX;
      ball2.y += separationY;
    }
  };

  const updatePhysics = () => {
    if (!gameAreaBounds) return;
    
    setBalls(currentBalls => {
      const updatedBalls = currentBalls.map(ball => ({ ...ball }));
      
      // Update positions
      updatedBalls.forEach(ball => {
        ball.x += ball.vx;
        ball.y += ball.vy;
        
        // Wall collision detection
        if (ball.x <= gameAreaBounds.left || ball.x >= gameAreaBounds.right - ball.size) {
          ball.vx = -ball.vx;
          ball.x = Math.max(gameAreaBounds.left, Math.min(ball.x, gameAreaBounds.right - ball.size));
        }
        
        if (ball.y <= gameAreaBounds.top || ball.y >= gameAreaBounds.bottom - ball.size) {
          ball.vy = -ball.vy;
          ball.y = Math.max(gameAreaBounds.top, Math.min(ball.y, gameAreaBounds.bottom - ball.size));
        }
        
        // Apply slight speed randomization to prevent perfect patterns
        ball.vx += (Math.random() - 0.5) * 0.1;
        ball.vy += (Math.random() - 0.5) * 0.1;
        
        // Limit max speed
        const maxSpeed = 12;
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > maxSpeed) {
          ball.vx = (ball.vx / speed) * maxSpeed;
          ball.vy = (ball.vy / speed) * maxSpeed;
        }
      });
      
      // Ball-to-ball collision detection
      for (let i = 0; i < updatedBalls.length; i++) {
        for (let j = i + 1; j < updatedBalls.length; j++) {
          if (checkBallCollision(updatedBalls[i], updatedBalls[j])) {
            handleBallCollision(updatedBalls[i], updatedBalls[j]);
          }
        }
      }
      
      // Update animated values
      updatedBalls.forEach(ball => {
        ball.animatedX.setValue(ball.x);
        ball.animatedY.setValue(ball.y);
      });
      
      return updatedBalls;
    });
  };

  const handleCountSubmit = (count: number) => {
    if (gameState !== 'counting') return;
    
    setUserCount(count);
    endGame();
  };

  const handleNumberPress = (number: number) => {
    if (gameState !== 'counting') return;
    handleCountSubmit(number);
  };

  const startGame = async () => {
    try {
      const activeSession = await isUserInActiveTestSession();
      if (activeSession.isActive && activeSession.activeTest?.test_type !== 'ball_counting') {
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
    
    startGameNow();
  };

  const startGameNow = () => {
    const newBalls = generateBalls();
    
    setGameState('playing');
    setBalls(newBalls);
    setUserCount(null);
    setTimeLeft(3); // 3 seconds observation time
    startTime.current = Date.now();
    
    // Start 60fps physics simulation
    physicsInterval.current = setInterval(updatePhysics, PHYSICS_INTERVAL) as any;
    
    // Start countdown timer
    countdownTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // After 3 seconds, freeze balls and show counting interface
          if (physicsInterval.current) {
            clearInterval(physicsInterval.current);
          }
          setGameState('counting');
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as any;
  };

  const endGame = async () => {
    setGameState('finished');
    
    // Clear timers and physics simulation
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
    }
    if (physicsInterval.current) {
      clearInterval(physicsInterval.current);
    }
    
    const completionTime = (Date.now() - startTime.current) / 1000;
    const countingAccuracy = userCount !== null ? Math.abs(actualBallCount - userCount) : actualBallCount;
    const isCorrect = userCount === actualBallCount;
    
    const rawData = {
      actualBallCount,
      userCount: userCount || 0,
      countingAccuracy,
      isCorrect,
      completionTime,
      timeUsed: TEST_DURATION / 1000 - timeLeft
    };
    
    try {
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      // Score based on accuracy and time
      const baseScore = isCorrect ? 1000 : Math.max(0, 1000 - (countingAccuracy * 200));
      const timeBonus = Math.max(0, (TEST_DURATION / 1000 - completionTime) * 10);
      const score = Math.floor(baseScore + timeBonus);
      
      await saveCognitiveTestResult('trail_maker', score, rawData, completionTime, studyId, supplementLogId);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save ball counting test result:', error);
    }
  };

  const handleBackToMenu = () => {
    router.push('/cognitive-tests');
  };

  const handlePlayAgain = () => {
    startGame();
  };

  useEffect(() => {
    const checkTestStatus = async () => {
      try {
        const activeSession = await isUserInActiveTestSession();
        if (activeSession.isActive && activeSession.activeTest?.test_type !== 'trail_maker') {
          setActiveTestSession(activeSession);
        }
        
        const relevantTest = await getRelevantScheduledTest('trail_maker');
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
  }, []);

  useEffect(() => {
    return () => {
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
      }
      if (physicsInterval.current) {
        clearInterval(physicsInterval.current);
      }
    };
  }, []);

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
            <ThemedText type="title" style={styles.title}>Ball Counting</ThemedText>
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
              Count the bouncing balls on screen!{'\n\n'}
              • Watch the balls bounce around for 3 seconds{'\n'}
              • 20-30 balls of different sizes and colors{'\n'}
              • Balls collide and change direction{'\n'}
              • After 3 seconds, balls freeze and you select your count{'\n'}
              • Test your visual attention and working memory!
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
    const isCorrect = userCount === actualBallCount;
    const accuracy = userCount !== null ? Math.abs(actualBallCount - userCount) : actualBallCount;
    
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.resultsContainer}>
            <ThemedText type="title" style={styles.title}>Counting Complete!</ThemedText>
            <ThemedText style={styles.finalScore}>
              {isCorrect ? '✅ Correct!' : `❌ Close! Off by ${accuracy}`}
            </ThemedText>
            <ThemedText style={styles.metricText}>Actual Count: {actualBallCount}</ThemedText>
            <ThemedText style={styles.metricText}>Your Count: {userCount || 0}</ThemedText>
            <ThemedText style={styles.metricText}>Time Used: {(TEST_DURATION / 1000 - timeLeft).toFixed(1)}s</ThemedText>
            <ThemedText style={styles.resultMessage}>
              {isCorrect ? 'Perfect attention and counting!' : 
               accuracy <= 1 ? 'Great visual tracking!' : 
               accuracy <= 2 ? 'Good concentration!' : 'Keep practicing your focus!'}
            </ThemedText>
            <TouchableOpacity 
              style={[styles.startButton, { backgroundColor: tintColor }]} 
              onPress={handlePlayAgain}
            >
              <ThemedText style={styles.startButtonText}>Play Again</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
              <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} safeArea>
      <ThemedView style={styles.gameHeader}>
        {gameState === 'playing' ? (
          <>
            <ThemedText style={styles.timerText}>Observe: {timeLeft}s</ThemedText>
            <ThemedText style={styles.instructionText}>Count the balls!</ThemedText>
          </>
        ) : (
          <>
            <ThemedText style={styles.timerText}>Balls Frozen</ThemedText>
            <ThemedText style={styles.instructionText}>Select your count</ThemedText>
          </>
        )}
      </ThemedView>

      <View style={styles.gameArea}>
        {balls.map((ball) => (
          <Animated.View
            key={ball.id}
            style={[
              styles.ball,
              {
                left: ball.animatedX,
                top: ball.animatedY,
                width: ball.size,
                height: ball.size,
                borderRadius: ball.size / 2,
                backgroundColor: ball.color,
              }
            ]}
          />
        ))}
      </View>

      {gameState === 'counting' && (
        <ThemedView style={styles.numberPadContainer}>
          <ThemedText style={styles.countPrompt}>How many balls did you count?</ThemedText>
          <View style={styles.numberPad}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((number) => (
              <TouchableOpacity
                key={number}
                style={[styles.numberButton, { backgroundColor: tintColor }]}
                onPress={() => handleNumberPress(number)}
              >
                <ThemedText style={styles.numberButtonText}>{number}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>
      )}

      <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
        <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
      </TouchableOpacity>
    </ThemedView>
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
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    opacity: 0.7,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  timerText: {
    fontSize: 18,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  ball: {
    position: 'absolute',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  numberPadContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  countPrompt: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  numberPad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: screenWidth - 40,
    maxHeight: 120,
  },
  numberButton: {
    width: 45,
    height: 35,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  numberButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  finalScore: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center',
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
    lineHeight: 24,
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