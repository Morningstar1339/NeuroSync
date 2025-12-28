import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';
import { useHierarchicalBack } from '@/hooks/use-hierarchical-back';
import { Ionicons } from '@expo/vector-icons';

const { height: screenHeight } = Dimensions.get('window');
const BALL_SIZE = 50;
// Removed RACK_POSITIONS as it's no longer needed - always 5 slots

const COLORS = ['#FF3B30', '#007AFF', '#34C759', '#FFCC00', '#AF52DE'];
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];

interface Ball {
  id: number;
  color: string;
  colorName: string;
  colorIndex: number;
}

interface GuessRecord {
  pattern: Ball[];
  matches: number;
}

export default function PatternMatcherTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  
  useHierarchicalBack('tests/pattern-matcher');
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [targetPattern, setTargetPattern] = useState<Ball[]>([]);
  const [playerRack, setPlayerRack] = useState<Ball[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [swapCount, setSwapCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  const [guessHistory, setGuessHistory] = useState<GuessRecord[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  
  const startTime = useRef<number>(0);

  const generatePattern = (): Ball[] => {
    // Always use all 5 colors in random order
    const shuffledIndices = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
    return shuffledIndices.map((colorIndex, i) => ({
      id: i,
      color: COLORS[colorIndex],
      colorName: COLOR_NAMES[colorIndex],
      colorIndex
    }));
  };

  const createScrambledRack = (pattern: Ball[]): Ball[] => {
    // Create all 5 colors, scrambled to ensure 0 initial matches
    let scrambled: Ball[];
    do {
      const shuffledIndices = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
      scrambled = shuffledIndices.map((colorIndex, i) => ({
        id: i,
        color: COLORS[colorIndex],
        colorName: COLOR_NAMES[colorIndex],
        colorIndex
      }));
    } while (checkMatches(scrambled, pattern) > 0); // Ensure 0 initial matches
    
    return scrambled;
  };

  const checkMatches = (rack: Ball[], pattern: Ball[]): number => {
    let matches = 0;
    for (let i = 0; i < 5; i++) {
      if (rack[i]?.colorIndex === pattern[i]?.colorIndex) {
        matches++;
      }
    }
    return matches;
  };

  // Removed isPatternComplete as it's now handled directly in updateMatchCount

  const handleBallPress = (position: number) => {
    if (selectedPosition === null) {
      // First tap - select the ball
      setSelectedPosition(position);
    } else if (selectedPosition === position) {
      // Tap same ball - deselect
      setSelectedPosition(null);
    } else {
      // Second tap - swap balls
      const newRack = [...playerRack];
      [newRack[selectedPosition], newRack[position]] = [newRack[position], newRack[selectedPosition]];
      setPlayerRack(newRack);
      setSelectedPosition(null);
      setSwapCount(prev => prev + 1);
      
      // Update match count with new rack
      const newMatches = checkMatches(newRack, targetPattern);
      setMatchCount(newMatches);
      
      // Record this guess in history
      setGuessHistory(prev => [{ pattern: [...newRack], matches: newMatches }, ...prev]);
      
      if (newMatches === 5) {
        endGame();
      }
    }
  };

  const startGame = async () => {
    try {
      const activeSession = await isUserInActiveTestSession();
if (activeSession.isActive && String(activeSession.activeTest?.test_type) !== 'pattern_matcher') {
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
    const pattern = generatePattern();
    const initialRack = createScrambledRack(pattern);
    
    setGameState('playing');
    setTargetPattern(pattern);
    setPlayerRack(initialRack);
    setSelectedPosition(null);
    setSwapCount(0);
    setMatchCount(0);
    const initialMatches = initialRack.filter((ball, i) => ball.colorName === pattern[i].colorName).length;
    setGuessHistory([{ pattern: initialRack, matches: initialMatches }]);
    startTime.current = Date.now();
  };

const endGame = useCallback(async () => {
    setGameState('finished');
    
    const completionTime = (Date.now() - startTime.current) / 1000;
    
    const accuracy = 100;
    const speed = completionTime;
    
    const rawData = {
      completionTime,
      swapCount,
      patternColors: targetPattern.map(ball => ball.colorName),
      finalMatches: 5,
      accuracy,
      speed
    };
    
    try {
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      const score = Math.max(0, Math.floor(100 - (swapCount * 2) - (completionTime / 2)));
      await saveCognitiveTestResult('pattern_matcher', score, rawData, completionTime, studyId, supplementLogId, accuracy, speed);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save pattern matcher test result:', error);
    }
}, [scheduledTest, studyContext, swapCount, targetPattern]);

  const handleBackToMenu = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/all-nine');
    } else {
      router.push('/cognitive-tests');
    }
  };

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/tile-puzzle?sequence=all-nine');
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
        if (activeSession.isActive && String(activeSession.activeTest?.test_type) !== 'pattern_matcher') {
          setActiveTestSession(activeSession);
        }
        
        const relevantTest = await getRelevantScheduledTest('pattern_matcher');
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

  // Initialize match count when rack or pattern changes
  useEffect(() => {
    if (playerRack.length > 0 && targetPattern.length > 0) {
      const matches = checkMatches(playerRack, targetPattern);
      setMatchCount(matches);
      
      if (matches === 5) {
        endGame();
      }
    }
  }, [endGame, playerRack, targetPattern]);

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
            {params.sequence === 'all-nine' && (
              <ThemedView style={[styles.progressBanner, { backgroundColor: tintColor + '15', borderColor: tintColor }]}>
                <ThemedText style={[styles.progressText, { color: tintColor }]}>
                  Test 6 of 9
                </ThemedText>
              </ThemedView>
            )}
            <ThemedText type="title" style={styles.title}>Pattern Matcher</ThemedText>
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
              Change the order of balls to match a hidden sequence.{'\n\n'}
              A secret pattern of 5 colors is hidden{'\n'}
              Tap a ball to select it (highlighted){'\n'}
              Tap another ball to swap their positions{'\n'}
              See how many match after each swap{'\n'}
              Use logic to deduce the correct order{'\n'}
              Complete when all 5 colors match!
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
    const completionTime = (Date.now() - startTime.current) / 1000;
    
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.resultsContainer}>
            <ThemedText type="title" style={styles.title}>Pattern Solved!</ThemedText>
            <ThemedText style={styles.finalScore}>Pattern Matched!</ThemedText>
            <ThemedText style={styles.metricText}>Speed: {completionTime.toFixed(1)}s</ThemedText>
            <ThemedText style={styles.metricText}>Total Swaps: {swapCount}</ThemedText>
            <ThemedText style={styles.metricText}>Pattern: {targetPattern.map(b => b.colorName).join(', ')}</ThemedText>
            <ThemedText style={styles.resultMessage}>
              {swapCount <= 8 ? 'Excellent problem solving!' : 
               swapCount <= 15 ? 'Good logical thinking!' : 
               swapCount <= 25 ? 'Nice work!' : 'Keep practicing!'}
            </ThemedText>
            {params.sequence === 'all-nine' ? (
              <>
                <TouchableOpacity 
                  style={[styles.startButton, { backgroundColor: tintColor }]} 
                  onPress={handleNextTestOrFinish}
                >
                  <ThemedText style={styles.startButtonText}>Next Test</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
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
    <ThemedView style={styles.container} safeArea>
      <ScrollView contentContainerStyle={styles.gameScrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={[styles.infoBanner, { borderColor: tintColor }]}>
          <TouchableOpacity
            style={styles.bannerBackButton}
            onPress={handleBackToMenu}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={tintColor} />
          </TouchableOpacity>
          <View style={styles.bannerStats}>
            <ThemedText style={styles.bannerStatText}>Swaps: {swapCount}</ThemedText>
            <ThemedText style={[styles.bannerStatText, matchCount === 5 ? styles.completeText : {}]}>
              {matchCount} matches{matchCount === 5 ? ' ✓' : ''}
            </ThemedText>
          </View>
        </ThemedView>
        
        <ThemedView style={styles.rackSection}>
          <ThemedText style={styles.sectionTitle}>Your Pattern (tap to swap):</ThemedText>
          <View style={styles.playerRack}>
            {playerRack.map((ball, index) => {
              const isSelected = selectedPosition === index;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.rackPosition,
                    { 
                      backgroundColor: ball.color,
                      borderColor: isSelected ? '#FFD700' : '#ccc',
                      borderWidth: isSelected ? 5 : 1,
                      transform: isSelected ? [{scale: 1.1}] : [{scale: 1}],
                      shadowOpacity: isSelected ? 0.4 : 0.2,
                      elevation: isSelected ? 8 : 2,
                    }
                  ]}
                  onPress={() => handleBallPress(index)}
                />
              );
            })}
          </View>
          <ThemedText style={styles.rackHint}>
            {selectedPosition !== null ? 'Now tap another ball to swap' : 'Tap a ball to select it'}
          </ThemedText>
        </ThemedView>

        {guessHistory.length > 0 && (
          <ThemedView style={styles.historySection}>
            <TouchableOpacity 
              style={styles.historyHeader} 
              onPress={() => setHistoryExpanded(!historyExpanded)}
            >
              <ThemedText style={styles.historyTitle}>
                History ({guessHistory.length}) {historyExpanded ? '▼' : '▶'}
              </ThemedText>
            </TouchableOpacity>
            {historyExpanded && (
              <ScrollView style={styles.historyList} nestedScrollEnabled>
                {guessHistory.map((guess, idx) => (
                  <View key={idx} style={styles.historyRow}>
                    <View style={styles.historyDots}>
                      {guess.pattern.map((ball, i) => (
                        <View
                          key={i}
                          style={[styles.historyDot, { backgroundColor: ball.color }]}
                        />
                      ))}
                    </View>
                    <ThemedText style={styles.historyMatches}>
                      {guess.matches}/5
                    </ThemedText>
                  </View>
                ))}
              </ScrollView>
            )}
          </ThemedView>
        )}

        <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
          <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
        </TouchableOpacity>
      </ScrollView>
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
  gameScrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 20,
    paddingBottom: 60,
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
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
  timer: {
    fontSize: 18,
    fontWeight: '600',
  },
  matchInfo: {
    fontSize: 18,
    fontWeight: '600',
  },
  completeText: {
    color: '#34C759',
  },
  patternSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  rackSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  targetPattern: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  playerRack: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    borderWidth: 1,
    borderColor: '#ccc',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  rackPosition: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  rackHint: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 10,
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
  historySection: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    overflow: 'hidden',
  },
  historyHeader: {
    padding: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyList: {
    maxHeight: 360,
    paddingHorizontal: 10,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  historyDots: {
    flexDirection: 'row',
    gap: 4,
  },
  historyDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  historyMatches: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 30,
    textAlign: 'right',
  },
});