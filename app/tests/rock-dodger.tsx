import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PLAYER_SIZE = 40;
const ROCK_SIZE = 50; // Renamed and made larger for visibility
const OBSTACLE_SPEED_BASE = 3; // Increased speed for more noticeable movement
const OBSTACLE_SPAWN_RATE_BASE = 800; // Faster spawning

interface Obstacle {
  id: number;
  x: number;
  y: number;
  speed: number;
}

export default function RockDodgerTestScreen() {
  console.log('RockDodgerTestScreen component loaded successfully');
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [survivalTime, setSurvivalTime] = useState(0);
  const [dodgeCount, setDodgeCount] = useState(0);
  const [difficultyLevel, setDifficultyLevel] = useState(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [rocksSpawned, setRocksSpawned] = useState(0); // Debug counter
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  
  const playerX = useSharedValue(screenWidth / 2 - PLAYER_SIZE / 2);
  const gameTimer = useRef<NodeJS.Timeout | null>(null);
  const spawnTimer = useRef<NodeJS.Timeout | null>(null);
  const obstacleIdCounter = useRef(0);
  const startTime = useRef<number>(0);
  const totalDodgeDistance = useRef<number>(0);

  // Calculate safe game area dimensions
  const gameAreaHeight = screenHeight - insets.top - insets.bottom - 140; // 140px for header
  const playerY = insets.top + 140 + gameAreaHeight * 0.87; // Lowered player position to 87%

  const generateObstacle = (): Obstacle => {
    obstacleIdCounter.current++;
    const rockX = Math.random() * (screenWidth - ROCK_SIZE);
    const rockY = insets.top + 140 - ROCK_SIZE; // Start above visible area
    const rockSpeed = OBSTACLE_SPEED_BASE + (difficultyLevel - 1) * 0.5;
    
    console.log('🪨 Spawning rock:', {
      id: obstacleIdCounter.current,
      x: rockX,
      y: rockY,
      speed: rockSpeed,
      screenWidth,
      rockSize: ROCK_SIZE
    });
    
    return {
      id: obstacleIdCounter.current,
      x: rockX,
      y: rockY,
      speed: rockSpeed,
    };
  };

  const checkCollision = (playerX: number, obstacle: Obstacle): boolean => {
    const playerLeft = playerX;
    const playerRight = playerX + PLAYER_SIZE;
    const playerTop = playerY;
    const playerBottom = playerY + PLAYER_SIZE;
    
    const obstacleLeft = obstacle.x;
    const obstacleRight = obstacle.x + ROCK_SIZE;
    const obstacleTop = obstacle.y;
    const obstacleBottom = obstacle.y + ROCK_SIZE;
    
    return playerLeft < obstacleRight && 
           playerRight > obstacleLeft && 
           playerTop < obstacleBottom && 
           playerBottom > obstacleTop;
  };

  const updateGame = () => {
    if (gameState !== 'playing') return;
    
    const currentTime = Date.now();
    const survival = (currentTime - startTime.current) / 1000;
    setSurvivalTime(survival);
    
    setObstacles(prevObstacles => {
      const newObstacles = prevObstacles
        .map(obstacle => ({
          ...obstacle,
          y: obstacle.y + obstacle.speed
        }))
        .filter(obstacle => obstacle.y < screenHeight - insets.bottom);
      
      for (const obstacle of newObstacles) {
        if (checkCollision(playerX.value, obstacle)) {
          runOnJS(endGame)();
          return newObstacles;
        }
      }
      
      const passedObstacles = prevObstacles.filter(
        obstacle => obstacle.y > playerY + PLAYER_SIZE && 
        (newObstacles.find(newObs => newObs.id === obstacle.id)?.y || 0) <= playerY + PLAYER_SIZE
      );
      
      if (passedObstacles.length > 0) {
        runOnJS(setDodgeCount)(prev => prev + passedObstacles.length);
        
        const currentPlayerX = playerX.value;
        passedObstacles.forEach(obstacle => {
          const dodgeDistance = Math.abs(currentPlayerX + PLAYER_SIZE/2 - obstacle.x - ROCK_SIZE/2);
          totalDodgeDistance.current += dodgeDistance;
        });
      }
      
      const newDifficultyLevel = Math.floor(survival / 10) + 1;
      if (newDifficultyLevel !== difficultyLevel) {
        runOnJS(setDifficultyLevel)(newDifficultyLevel);
      }
      
      return newObstacles;
    });
  };

  const spawnObstacle = () => {
    if (gameState !== 'playing') {
      console.log('⚠️ Not spawning rock - game state:', gameState);
      return;
    }
    
    const newRock = generateObstacle();
    setObstacles(prev => {
      const newObstacles = [...prev, newRock];
      console.log('📊 Current rocks count:', newObstacles.length);
      console.log('📊 Rock velocities:', newObstacles.map(r => `${r.id}:${r.speed}`));
      return newObstacles;
    });
    
    setRocksSpawned(prev => {
      const newCount = prev + 1;
      console.log('🔢 Total rocks spawned:', newCount);
      return newCount;
    });
    
    const spawnRate = Math.max(300, OBSTACLE_SPAWN_RATE_BASE - (difficultyLevel - 1) * 100);
    console.log('⏰ Next rock in:', spawnRate + 'ms');
    spawnTimer.current = setTimeout(spawnObstacle, spawnRate) as any;
  };

  const startGame = async () => {
    try {
      const activeSession = await isUserInActiveTestSession();
      if (activeSession.isActive && activeSession.activeTest?.test_type !== 'rock_dodger') {
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
    setGameState('playing');
    setSurvivalTime(0);
    setDodgeCount(0);
    setDifficultyLevel(1);
    setObstacles([]);
    setRocksSpawned(0);
    playerX.value = screenWidth / 2 - PLAYER_SIZE / 2;
    startTime.current = Date.now();
    totalDodgeDistance.current = 0;
    
    console.log('🎮 Game started! Screen dimensions:', { screenWidth, screenHeight });
    console.log('🎮 Game area height:', gameAreaHeight);
    console.log('🎮 Player Y position:', playerY);
    
    gameTimer.current = setInterval(updateGame, 16) as any;
    // Start spawning rocks immediately
    setTimeout(spawnObstacle, 500) as any; // First rock after 500ms
  };

  const endGame = async () => {
    setGameState('finished');
    if (gameTimer.current) {
      clearInterval(gameTimer.current);
    }
    if (spawnTimer.current) {
      clearTimeout(spawnTimer.current);
    }
    
    const finalSurvivalTime = survivalTime;
    const averageDodgeDistance = dodgeCount > 0 ? totalDodgeDistance.current / dodgeCount : 0;
    
    const rawData = {
      survivalTime: finalSurvivalTime,
      dodgeCount,
      averageDodgeDistance,
      difficultyLevel,
    };
    
    try {
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      await saveCognitiveTestResult('rock_dodger', Math.floor(finalSurvivalTime), rawData, finalSurvivalTime, studyId, supplementLogId);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save rock dodger test result:', error);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (gameState === 'playing') {
        const newX = Math.max(0, Math.min(screenWidth - PLAYER_SIZE, event.absoluteX - PLAYER_SIZE / 2));
        playerX.value = newX;
      }
    });

  const playerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: playerX.value }],
    };
  });

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
              if (gameTimer.current) clearInterval(gameTimer.current);
              if (spawnTimer.current) clearInterval(spawnTimer.current);
              
              // Handle sequence navigation
              if (params.sequence === 'all-nine') {
                router.push('/tests/all-nine');
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
      } else {
        router.push('/cognitive-tests');
      }
    }
  };

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/pattern-matcher?sequence=all-nine');
    } else {
      router.push('/cognitive-tests');
    }
  };

  const handlePlayAgain = () => {
    startGame();
  };

  useEffect(() => {
    const checkTestStatus = async () => {
      try {
        const activeSession = await isUserInActiveTestSession();
        if (activeSession.isActive && activeSession.activeTest?.test_type !== 'rock_dodger') {
          setActiveTestSession(activeSession);
        }
        
        const relevantTest = await getRelevantScheduledTest('rock_dodger');
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
        clearInterval(gameTimer.current);
      }
      if (spawnTimer.current) {
        clearTimeout(spawnTimer.current);
      }
    };
  }, []);

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
            <ThemedText type="title" style={styles.title}>Rock Dodger</ThemedText>
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
              Move the red circle to dodge falling blue circles!{'\n\n'}
              • Drag left/right to move{'\n'}
              • Avoid all blue obstacles{'\n'}
              • Game ends when you hit an obstacle{'\n'}
              • Difficulty increases over time
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
            <ThemedText style={styles.finalScore}>Survival Time: {survivalTime.toFixed(1)}s</ThemedText>
            <ThemedText style={styles.metricText}>Dodges: {dodgeCount}</ThemedText>
            <ThemedText style={styles.metricText}>Difficulty Reached: Level {difficultyLevel}</ThemedText>
            <ThemedText style={styles.metricText}>
              Avg Dodge Distance: {dodgeCount > 0 ? (totalDodgeDistance.current / dodgeCount).toFixed(1) : '0'}px
            </ThemedText>
            <ThemedText style={styles.resultMessage}>
              {survivalTime >= 30 ? 'Excellent reflexes!' : 
               survivalTime >= 20 ? 'Good performance!' : 
               survivalTime >= 10 ? 'Not bad!' : 'Keep practicing!'}
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
      <GestureHandlerRootView style={styles.gameContainer}>
        <GestureDetector gesture={panGesture}>
          <ThemedView style={styles.gameContainer}>
            <ThemedView style={styles.gameHeader}>
              <ThemedText style={styles.timer}>Time: {survivalTime.toFixed(1)}s</ThemedText>
              <ThemedText style={styles.scoreText}>Dodges: {dodgeCount}</ThemedText>
              <ThemedText style={styles.levelText}>Level: {difficultyLevel}</ThemedText>
              <ThemedText style={styles.debugText}>Rocks: {obstacles.length}/{rocksSpawned}</ThemedText>
            </ThemedView>
            
            <View style={styles.gameArea}>
              <Animated.View
                style={[
                  styles.player,
                  { backgroundColor: '#FF3B30', top: playerY - insets.top - 140 },
                  playerAnimatedStyle
                ]}
              />
              
              {obstacles.map(obstacle => (
                <View
                  key={obstacle.id}
                  style={[
                    styles.obstacle,
                    {
                      backgroundColor: '#2196F3', // Fixed blue color for rocks
                      left: obstacle.x,
                      top: obstacle.y - insets.top - 140,
                      width: ROCK_SIZE,
                      height: ROCK_SIZE,
                      borderRadius: ROCK_SIZE / 2,
                    }
                  ]}
                />
              ))}
            </View>
          </ThemedView>
        </GestureDetector>
      </GestureHandlerRootView>
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
  },
  backButtonText: {
    fontSize: 16,
    opacity: 0.7,
  },
  gameContainer: {
    flex: 1,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    height: 60,
  },
  timer: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '600',
  },
  levelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  player: {
    position: 'absolute',
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  obstacle: {
    position: 'absolute',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  debugText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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