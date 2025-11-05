import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, ScrollView, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext } from '@/database/study-scheduler';
import Svg, { Line, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const DOT_COUNT = 24;
const TEST_DURATION = 60000; // 60 seconds
const DOT_SIZE = 20;

interface Dot {
  id: number;
  x: number;
  y: number;
}

interface Connection {
  from: number;
  to: number;
  length: number;
}

export default function ConnectionsTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [dots, setDots] = useState<Dot[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedDot, setSelectedDot] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION / 1000);
  const [score, setScore] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [optimalLength, setOptimalLength] = useState(0);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  
  const gameTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownTimer = useRef<NodeJS.Timeout | null>(null);

  const generateDots = (): Dot[] => {
    const dots: Dot[] = [];
    const minDistance = screenWidth / 6; // Minimum 1/6 screen width apart
    
    // Proper bounds calculation with safe area
    const playAreaTop = insets.top + 80; // header + buffer
    const playAreaBottom = screenHeight - insets.bottom - 50;
    const playAreaLeft = insets.left + 30;
    const playAreaRight = screenWidth - insets.right - 30;
    
    // For dot placement with radius padding
    const dotRadius = DOT_SIZE / 2;
    const minX = playAreaLeft + dotRadius + 10;
    const maxX = playAreaRight - dotRadius - 10;
    const minY = playAreaTop + dotRadius + 10;
    const maxY = playAreaBottom - dotRadius - 10;
    
    const attempts = 1000; // Prevent infinite loops
    
    for (let i = 0; i < DOT_COUNT; i++) {
      let validPosition = false;
      let attemptCount = 0;
      let newDot: Dot;
      
      do {
        newDot = {
          id: i,
          x: Math.random() * (maxX - minX) + minX,
          y: Math.random() * (maxY - minY) + minY,
        };
        
        validPosition = dots.every(existingDot => {
          const distance = Math.sqrt(
            Math.pow(newDot.x - existingDot.x, 2) + 
            Math.pow(newDot.y - existingDot.y, 2)
          );
          return distance >= minDistance;
        });
        
        attemptCount++;
      } while (!validPosition && attemptCount < attempts);
      
      dots.push(newDot);
    }
    
    return dots;
  };

  const calculateDistance = (dot1: Dot, dot2: Dot): number => {
    return Math.sqrt(Math.pow(dot1.x - dot2.x, 2) + Math.pow(dot1.y - dot2.y, 2));
  };

  const calculateMST = (dots: Dot[]): number => {
    // Kruskal's algorithm to find minimum spanning tree
    const edges: { from: number; to: number; weight: number }[] = [];
    
    // Generate all possible edges
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        edges.push({
          from: i,
          to: j,
          weight: calculateDistance(dots[i], dots[j])
        });
      }
    }
    
    // Sort edges by weight
    edges.sort((a, b) => a.weight - b.weight);
    
    // Union-Find data structure
    const parent = Array.from({ length: dots.length }, (_, i) => i);
    const rank = new Array(dots.length).fill(0);
    
    const find = (x: number): number => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };
    
    const union = (x: number, y: number): boolean => {
      const rootX = find(x);
      const rootY = find(y);
      
      if (rootX === rootY) return false;
      
      if (rank[rootX] < rank[rootY]) {
        parent[rootX] = rootY;
      } else if (rank[rootX] > rank[rootY]) {
        parent[rootY] = rootX;
      } else {
        parent[rootY] = rootX;
        rank[rootX]++;
      }
      
      return true;
    };
    
    let mstWeight = 0;
    let edgeCount = 0;
    
    for (const edge of edges) {
      if (union(edge.from, edge.to)) {
        mstWeight += edge.weight;
        edgeCount++;
        if (edgeCount === dots.length - 1) break;
      }
    }
    
    return mstWeight;
  };

  const isTreeConnected = (dots: Dot[], connections: Connection[]): boolean => {
    if (!connections || !Array.isArray(connections) || connections.length < dots.length - 1) return false;
    if (!dots || !Array.isArray(dots) || dots.length === 0) return false;
    
    // Build adjacency list
    const adj: number[][] = Array.from({ length: dots.length }, () => []);
    connections.forEach(conn => {
      if (conn && typeof conn.from === 'number' && typeof conn.to === 'number') {
        adj[conn.from]?.push(conn.to);
        adj[conn.to]?.push(conn.from);
      }
    });
    
    // DFS to check connectivity
    const visited = new Array(dots.length).fill(false);
    const dfs = (node: number) => {
      if (visited[node]) return;
      visited[node] = true;
      if (adj[node] && Array.isArray(adj[node])) {
        adj[node].forEach(neighbor => {
          if (typeof neighbor === 'number' && !visited[neighbor]) {
            dfs(neighbor);
          }
        });
      }
    };
    
    dfs(0);
    return visited.every(v => v);
  };

  const startGame = () => {
    const newDots = generateDots();
    setDots(newDots);
    setConnections([]);
    setSelectedDot(null);
    setGameState('playing');
    setTimeLeft(TEST_DURATION / 1000);
    setScore(0);
    setIsConnected(false);
    
    const optimal = calculateMST(newDots);
    setOptimalLength(optimal);
    
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
    if (gameTimer.current) clearTimeout(gameTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    
    // Save test result if user submitted a solution
    if (score > 0) {
      try {
        const userLength = connections.reduce((sum, conn) => sum + conn.length, 0);
        const rawData = {
          userLength,
          optimalLength,
          connections: connections.length,
          efficiency: optimalLength > 0 ? (optimalLength / userLength) * 100 : 0,
          timeRemaining: timeLeft
        };
        
        const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
        const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
        
        await saveCognitiveTestResult('judgment', score, rawData, undefined, studyId, supplementLogId);
        
        // Mark scheduled test as completed if this was for a study
        if (scheduledTest) {
          await completeScheduledTest(scheduledTest.id);
        }
      } catch (error) {
        console.error('Failed to save connections test result:', error);
      }
    }
  };

  const handleDotPress = (dotId: number) => {
    if (gameState !== 'playing') return;
    
    if (selectedDot === null) {
      setSelectedDot(dotId);
    } else if (selectedDot === dotId) {
      setSelectedDot(null);
    } else {
      // Check if connection already exists
      const existingConnection = connections.find(conn => 
        (conn.from === selectedDot && conn.to === dotId) ||
        (conn.from === dotId && conn.to === selectedDot)
      );
      
      if (existingConnection) {
        // Remove connection
        setConnections(connections.filter(conn => conn !== existingConnection));
      } else {
        // Add connection
        const distance = calculateDistance(dots[selectedDot], dots[dotId]);
        setConnections([...connections, {
          from: selectedDot,
          to: dotId,
          length: distance
        }]);
      }
      
      setSelectedDot(null);
    }
  };

  const handleSubmit = async () => {
    if (!isConnected) return;
    
    const userLength = connections.reduce((sum, conn) => sum + conn.length, 0);
    const baseScore = Math.round((optimalLength / userLength) * 100);
    
    let finalScore = baseScore;
    
    // Time bonus if score >= 91
    if (baseScore >= 91) {
      const bonus = Math.round(((baseScore - 90) * timeLeft) / 5);
      finalScore += bonus;
    }
    
    setScore(finalScore);
    
    // Save result immediately when submitted
    try {
      const rawData = {
        userLength,
        optimalLength,
        connections: connections.length,
        efficiency: optimalLength > 0 ? (optimalLength / userLength) * 100 : 0,
        timeRemaining: timeLeft,
        baseScore,
        timeBonus: finalScore - baseScore
      };
      
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      await saveCognitiveTestResult('judgment', finalScore, rawData, undefined, studyId, supplementLogId);
      
      // Mark scheduled test as completed if this was for a study
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save judgment test result:', error);
    }
    
    endGame();
  };

  const handleBackToMenu = () => {
    if (gameTimer.current) clearTimeout(gameTimer.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
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
              if (gameTimer.current) clearTimeout(gameTimer.current);
              if (countdownTimer.current) clearInterval(countdownTimer.current);
              
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

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/rock-dodger?sequence=all-nine');
    } else if (params.sequence === 'all-three') {
      router.push('/cognitive-tests'); // End of 3-test sequence
    } else {
      router.push('/cognitive-tests');
    }
  };

  const handlePlayAgain = () => {
    startGame();
  };

  useEffect(() => {
    const connected = isTreeConnected(dots, connections);
    setIsConnected(connected);
  }, [connections, dots]);

  useEffect(() => {
    // Check for relevant scheduled test on component mount
    const checkScheduledTest = async () => {
      try {
        const relevantTest = await getRelevantScheduledTest('judgment');
        if (relevantTest) {
          setScheduledTest(relevantTest);
          const context = await getTestContext(relevantTest.id);
          setStudyContext(context);
        }
      } catch (error) {
        console.error('Failed to check for scheduled test:', error);
      }
    };
    
    checkScheduledTest();
    
    return () => {
      if (gameTimer.current) clearTimeout(gameTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, []);

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
          {(params.sequence === 'all-nine' || params.sequence === 'all-three') && (
            <ThemedView style={[styles.progressBanner, { backgroundColor: tintColor + '15', borderColor: tintColor }]}>
              <ThemedText style={[styles.progressText, { color: tintColor }]}>
                {params.sequence === 'all-nine' ? 'Test 3 of 9' : 'Test 3 of 3'} • Run All Tests Mode
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText type="title" style={styles.title}>Connections Test</ThemedText>
          {scheduledTest && studyContext?.supplement_name && (
            <ThemedView style={[styles.studyBanner, { backgroundColor: tintColor + '20', borderColor: tintColor }]}>
              <ThemedText style={[styles.studyText, { color: tintColor }]}>
                📊 Study Test for {studyContext.supplement_name}
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText style={styles.instructions}>
            Connect all dots into shortest tree (no loops!){'\n\n'}
            • Tap two dots to connect/disconnect{'\n'}
            • Keep lines short - efficiency matters{'\n'}
            • Avoid loops - they waste distance{'\n'}
            • Score = (Optimal ÷ Your Length) × 100{'\n'}
            • Time bonus if score ≥ 91
          </ThemedText>
          
          <ThemedView style={styles.exampleContainer}>
            <ThemedView style={styles.exampleRow}>
              <ThemedView style={styles.exampleColumn}>
                <ThemedText style={styles.exampleLabel}>Good Tree</ThemedText>
                <ThemedText style={styles.exampleSubLabel}>Short Lines</ThemedText>
                <ThemedText style={styles.exampleSubLabel}>No Loops</ThemedText>
                <Svg width={100} height={60} style={styles.exampleSvg}>
                  <Circle cx={20} cy={10} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={70} cy={15} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={35} cy={25} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={60} cy={40} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={15} cy={50} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={80} cy={50} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  
                  <Line x1={20} y1={10} x2={35} y2={25} stroke={tintColor} strokeWidth="2" />
                  <Line x1={35} y1={25} x2={70} y2={15} stroke={tintColor} strokeWidth="2" />
                  <Line x1={35} y1={25} x2={60} y2={40} stroke={tintColor} strokeWidth="2" />
                  <Line x1={35} y1={25} x2={15} y2={50} stroke={tintColor} strokeWidth="2" />
                  <Line x1={60} y1={40} x2={80} y2={50} stroke={tintColor} strokeWidth="2" />
                </Svg>
              </ThemedView>
              
              <ThemedView style={styles.exampleColumn}>
                <ThemedText style={styles.exampleLabel}>Bad Tree</ThemedText>
                <ThemedText style={styles.exampleSubLabel}>Long Lines + Loop</ThemedText>
                <ThemedText style={styles.exampleSubLabel}>Wastes Distance</ThemedText>
                <Svg width={100} height={60} style={styles.exampleSvg}>
                  <Circle cx={20} cy={10} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={70} cy={15} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={35} cy={25} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={60} cy={40} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={15} cy={50} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={80} cy={50} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  
                  <Line x1={20} y1={10} x2={70} y2={15} stroke="#FF6B6B" strokeWidth="2" />
                  <Line x1={70} y1={15} x2={60} y2={40} stroke="#FF6B6B" strokeWidth="2" />
                  <Line x1={60} y1={40} x2={35} y2={25} stroke="#FF6B6B" strokeWidth="2" />
                  <Line x1={35} y1={25} x2={20} y2={10} stroke="#FF6B6B" strokeWidth="2" />
                  <Line x1={15} y1={50} x2={20} y2={10} stroke="#FF6B6B" strokeWidth="2" />
                  <Line x1={80} y1={50} x2={60} y2={40} stroke="#FF6B6B" strokeWidth="2" />
                </Svg>
              </ThemedView>
            </ThemedView>
          </ThemedView>
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
    const userLength = connections.reduce((sum, conn) => sum + conn.length, 0);
    const efficiency = optimalLength > 0 ? ((optimalLength / userLength) * 100).toFixed(1) : '0';
    
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.resultsContainer}>
          <ThemedText type="title" style={styles.title}>Test Complete!</ThemedText>
          <ThemedText style={styles.finalScore}>Final Score: {score}</ThemedText>
          <ThemedText style={styles.stats}>
            Efficiency: {efficiency}%{'\n'}
            Your length: {userLength.toFixed(1)}{'\n'}
            Optimal length: {optimalLength.toFixed(1)}
          </ThemedText>
          <ThemedText style={styles.resultMessage}>
            {score >= 95 ? 'Excellent spatial reasoning!' : 
             score >= 85 ? 'Good optimization!' : 
             score >= 70 ? 'Not bad!' : 'Keep practicing!'}
          </ThemedText>
          {(params.sequence === 'all-nine' || params.sequence === 'all-three') ? (
            <>
              <TouchableOpacity 
                style={[styles.startButton, { backgroundColor: tintColor }]} 
                onPress={handleNextTestOrFinish}
              >
                <ThemedText style={styles.startButtonText}>
                  {params.sequence === 'all-three' ? 'Complete Test Battery' : 'Next Test'}
                </ThemedText>
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
    <GestureHandlerRootView style={styles.gameContainer}>
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
          <ThemedText style={styles.connectionStatus}>
            {isConnected ? 'Tree Complete ✓' : 'Tree Incomplete'}
          </ThemedText>
        </View>
        <View style={styles.headerSpacer} />
      </ThemedView>
      
      <View style={styles.gameArea}>
        <Svg width={screenWidth} height={screenHeight - (insets.top + 80)} style={styles.svg}>
          {connections.map((connection, index) => (
            <Line
              key={index}
              x1={dots[connection.from]?.x || 0}
              y1={(dots[connection.from]?.y || 0) - (insets.top + 80)}
              x2={dots[connection.to]?.x || 0}
              y2={(dots[connection.to]?.y || 0) - (insets.top + 80)}
              stroke={tintColor}
              strokeWidth="2"
            />
          ))}
          
          {dots.map((dot) => (
            <Circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y - (insets.top + 80)}
              r={DOT_SIZE / 2}
              fill={selectedDot === dot.id ? '#FF6B6B' : tintColor}
              stroke="white"
              strokeWidth="2"
            />
          ))}
        </Svg>
        
        {dots.map((dot) => (
          <TouchableOpacity
            key={dot.id}
            style={[
              styles.dotTouchArea,
              {
                left: dot.x - DOT_SIZE,
                top: dot.y - DOT_SIZE - (insets.top + 80),
              }
            ]}
            onPress={() => handleDotPress(dot.id)}
          />
        ))}
      </View>
      
      {isConnected && (
        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: tintColor }]} 
          onPress={handleSubmit}
        >
          <ThemedText style={styles.submitButtonText}>Submit Solution</ThemedText>
        </TouchableOpacity>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 15,
    paddingVertical: 10,
  },
  instructionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  resultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: screenHeight * 0.7,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 20,
    minHeight: 48,
    minWidth: '70%',
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
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
    alignItems: 'center',
    paddingHorizontal: 20,
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
  timer: {
    fontSize: 18,
    fontWeight: '600',
  },
  connectionStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  dotTouchArea: {
    position: 'absolute',
    width: DOT_SIZE * 2,
    height: DOT_SIZE * 2,
  },
  submitButton: {
    margin: 20,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  finalScore: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  stats: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
    lineHeight: 24,
  },
  resultMessage: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.8,
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
  exampleContainer: {
    marginVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  exampleRow: {
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'space-around',
    width: '100%',
  },
  exampleColumn: {
    flex: 1,
    alignItems: 'center',
  },
  exampleLabel: {
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  exampleSubLabel: {
    fontSize: 11,
    marginBottom: 2,
    textAlign: 'center',
    opacity: 0.8,
  },
  exampleSvg: {
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});