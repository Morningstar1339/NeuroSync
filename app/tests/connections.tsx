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
import { useHierarchicalBack } from '@/hooks/use-hierarchical-back';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const DOT_COUNT = 24;
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
  
  useHierarchicalBack('tests/connections');
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [dots, setDots] = useState<Dot[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedDot, setSelectedDot] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [score, setScore] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [optimalLength, setOptimalLength] = useState(0);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  
  const elapsedTimer = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const generateDots = (): Dot[] => {
    const dots: Dot[] = [];
    const minDistance = screenWidth / 6; // Minimum 1/6 screen width apart
    
    // Proper bounds calculation with safe area
    const playAreaTop = insets.top + 80; // header + buffer
    const playAreaBottom = screenHeight - insets.bottom - 150;
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
    setElapsedTime(0);
    setScore(0);
    setIsConnected(false);
    
    const optimal = calculateMST(newDots);
    setOptimalLength(optimal);
    
    startTimeRef.current = Date.now();
    
    elapsedTimer.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const endGame = async () => {
    setGameState('finished');
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
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
    
    const completionTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const userLength = connections.reduce((sum, conn) => sum + conn.length, 0);
    const efficiencyPercent = optimalLength > 0 ? (optimalLength / userLength) * 100 : 0;
    let finalScore = Math.round((efficiencyPercent - 90) * 10);
    
    setScore(finalScore);
    setElapsedTime(completionTime);
    
    try {
      const accuracyDecimal = optimalLength > 0 ? Math.min(1, optimalLength / userLength) : 0;
      const accuracy = accuracyDecimal * 100;
      const speed = completionTime;
      
      const rawData = {
        userLength,
        optimalLength,
        connections: connections.length,
        efficiency: efficiencyPercent,
        completionTime,
        accuracy: accuracyDecimal,
        speed
      };
      
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      await saveCognitiveTestResult('judgment', finalScore, rawData, completionTime, studyId, supplementLogId, accuracy, speed);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save judgment test result:', error);
    }
    
    endGame();
  };

  const handleBackToMenu = () => {
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
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
              if (elapsedTimer.current) clearInterval(elapsedTimer.current);
              
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
      if (params.sequence === 'all-nine') {
        router.push('/tests/all-nine');
      } else {
        router.push('/cognitive-tests');
      }
    }
  };

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/rock-dodger?sequence=all-nine');
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
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, []);

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
          {params.sequence === 'all-nine' && (
            <ThemedView style={[styles.progressBanner, { backgroundColor: tintColor + '15', borderColor: tintColor }]}>
              <ThemedText style={[styles.progressText, { color: tintColor }]}>
                Test 4 of 9
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
            Tap two dots to connect/disconnect{'\n'}
            Keep lines short - efficiency matters{'\n'}
            Avoid loops - they waste distance{'\n'}
          </ThemedText>
          
          <ThemedView style={styles.exampleContainer}>
            <ThemedView style={styles.exampleRow}>
              <ThemedView style={styles.exampleColumn}>
                <ThemedText style={styles.exampleLabel}>Good Tree</ThemedText>
                <ThemedText style={styles.exampleSubLabel}>Short Lines</ThemedText>
                <ThemedText style={styles.exampleSubLabel}>No Loops</ThemedText>
                <Svg width={100} height={60} style={styles.exampleSvg}>
                  <Circle cx={25} cy={15} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={45} cy={10} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={35} cy={25} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={55} cy={30} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={20} cy={40} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  <Circle cx={70} cy={45} r={4} fill={tintColor} stroke="white" strokeWidth="1" />
                  
                  <Line x1={25} y1={15} x2={45} y2={10} stroke={tintColor} strokeWidth="2" />
                  <Line x1={25} y1={15} x2={35} y2={25} stroke={tintColor} strokeWidth="2" />
                  <Line x1={35} y1={25} x2={55} y2={30} stroke={tintColor} strokeWidth="2" />
                  <Line x1={35} y1={25} x2={20} y2={40} stroke={tintColor} strokeWidth="2" />
                  <Line x1={55} y1={30} x2={70} y2={45} stroke={tintColor} strokeWidth="2" />
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
            Accuracy: {efficiency}% | Speed: {elapsedTime}s{'\n'}
            Your length: {userLength.toFixed(1)}{'\n'}
            Optimal length: {optimalLength.toFixed(1)}
          </ThemedText>
          <ThemedText style={styles.resultMessage}>
            {score >= 95 ? 'Excellent spatial reasoning!' : 
             score >= 85 ? 'Good optimization!' : 
             score >= 70 ? 'Not bad!' : 'Keep practicing!'}
          </ThemedText>
          {params.sequence === 'all-nine' ? (
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
    <GestureHandlerRootView style={styles.gameContainer}>
      <ThemedView style={[styles.infoBanner, { borderColor: tintColor }]}>
        <TouchableOpacity
          style={styles.bannerBackButton}
          onPress={handleExitTest}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={tintColor} />
        </TouchableOpacity>
        <View style={styles.bannerStats}>
          <ThemedText style={styles.bannerStatText}>Time: {elapsedTime}s</ThemedText>
          <ThemedText style={styles.bannerStatText}>
            {isConnected ? 'Tree Complete ✓' : 'Tree Incomplete'}
          </ThemedText>
        </View>
      </ThemedView>
      
      <View style={styles.gameArea}>
        <Svg width={screenWidth} height={screenHeight - (insets.top + 80) - (insets.bottom + 100)} style={styles.svg}>
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
          style={[styles.submitButton, { backgroundColor: tintColor, marginBottom: insets.bottom + 20 }]} 
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
    justifyContent: 'flex-start',
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 20,
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
    paddingTop: 60,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  bannerBackButton: {
    padding: 4,
    marginRight: 12,
  },
  bannerStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bannerStatText: {
    fontSize: 14,
    fontWeight: '600',
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