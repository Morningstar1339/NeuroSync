import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext } from '@/database/study-scheduler';
import { validateTestPrerequisites, handleTestSaveError } from '@/utils/test-validation';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const CARD_COUNT = 18;
const GRID_CONFIG = { rows: 6, cols: 3 };
const SHAPES = ['square', 'circle', 'triangle'] as const;
const COLORS = ['#E53935', '#43A047', '#1E88E5'];
type ShapeType = typeof SHAPES[number];

interface Card {
  id: number;
  pairIndex: number;
  shape: ShapeType;
  color: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface DebugInfo {
  step: string;
  error: string | null;
  timestamp: string;
}

function MemoryTestContent() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([]);
  
  const addDebug = (step: string, error: Error | null = null) => {
    const info: DebugInfo = {
      step,
      error: error ? error.message : null,
      timestamp: new Date().toISOString(),
    };
    setDebugInfo(prev => [...prev.slice(-20), info]);
    console.log(`[MEMORY DEBUG] ${step}`, error ? error.message : '');
  };
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [cards, setCards] = useState<Card[]>([]);
  const [score, setScore] = useState(0);
  const [completionTime, setCompletionTime] = useState(0);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [mismatches, setMismatches] = useState(0);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  
  const flipBackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uniquePairs = CARD_COUNT / 2;

  useEffect(() => {
    addDebug('Component mounted');
  }, []);

  const renderShape = (shape: ShapeType, color: string, size: number) => {
    const halfSize = size / 2;
    
    switch (shape) {
      case 'square':
        return (
          <View style={{
            width: size,
            height: size,
            backgroundColor: color,
          }} />
        );
      case 'circle':
        return (
          <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          }} />
        );
      case 'triangle':
        return (
          <View style={{
            width: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderStyle: 'solid',
            borderLeftWidth: halfSize,
            borderRightWidth: halfSize,
            borderBottomWidth: size,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: color,
          }} />
        );
      default:
        return (
          <View style={{
            width: size,
            height: size,
            backgroundColor: color,
            borderRadius: size / 4,
          }} />
        );
    }
  };

  const generateCards = (): Card[] => {
    addDebug('generateCards starting');
    const cardPairs: Card[] = [];
    
    let pairIndex = 0;
    for (const shape of SHAPES) {
      for (const color of COLORS) {
        cardPairs.push(
          { id: pairIndex * 2, pairIndex, shape, color, isFlipped: false, isMatched: false },
          { id: pairIndex * 2 + 1, pairIndex, shape, color, isFlipped: false, isMatched: false }
        );
        pairIndex++;
      }
    }
    
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }
    
    addDebug('generateCards complete');
    return cardPairs;
  };

  const startGame = async () => {
    addDebug('startGame beginning');
    
    const canProceed = await validateTestPrerequisites('Memory');
    if (!canProceed) {
      addDebug('startGame aborted - validation failed');
      return;
    }
    
    const newCards = generateCards();
    setCards(newCards);
    setGameState('playing');
    setScore(0);
    setCompletionTime(0);
    setSelectedCards([]);
    setMatchedPairs(0);
    setMismatches(0);
    setGameStartTime(Date.now());
    addDebug('startGame complete');
  };

  const endGame = async (finalMatchedPairs: number, finalMismatches: number, finalScore: number) => {
    addDebug('endGame starting');
    const finalCompletionTime = (Date.now() - gameStartTime) / 1000;
    setCompletionTime(finalCompletionTime);
    setGameState('finished');
    if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
    
    try {
      const totalAttempts = finalMatchedPairs + finalMismatches;
      const accuracyDecimal = totalAttempts > 0 ? finalMatchedPairs / totalAttempts : 1;
      const accuracy = accuracyDecimal * 100;
      const speed = finalCompletionTime;
      
      const rawData = {
        flips: finalScore,
        matchedPairs: finalMatchedPairs,
        totalPairs: uniquePairs,
        cardCount: CARD_COUNT,
        completionTime: finalCompletionTime,
        mismatches: finalMismatches,
        accuracy: accuracyDecimal,
        speed
      };
      
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      const maxScore = 112;
      const calculatedScore = maxScore - finalScore;
      await saveCognitiveTestResult('memory', calculatedScore, rawData, finalCompletionTime, studyId, supplementLogId, accuracy, speed);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
      
      addDebug('saveTestResult complete');
    } catch (error) {
      addDebug('saveTestResult failed', error as Error);
      handleTestSaveError('Memory', error, () => endGame(finalMatchedPairs, finalMismatches, finalScore), handleBackToMenu);
    }
  };

  const handleCardPress = (cardId: number) => {
    if (gameState !== 'playing') return;

    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;

    if (selectedCards.length === 2) {
      const [firstId, secondId] = selectedCards;
      if (flipBackTimer.current) {
        clearTimeout(flipBackTimer.current);
        flipBackTimer.current = null;
      }
      setCards(prev => prev.map(c =>
        c.id === firstId || c.id === secondId ? { ...c, isFlipped: false } : c
      ));
      setSelectedCards([cardId]);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));
      setScore(prev => prev + 1);
      return;
    }

    const newScore = score + 1;
    setScore(newScore);
    
    if (selectedCards.length === 0) {
      setSelectedCards([cardId]);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));
    } else {
      const firstCardId = selectedCards[0];
      const firstCard = cards.find(c => c.id === firstCardId);
      const secondCard = card;

      setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));
      setSelectedCards([firstCardId, cardId]);

      if (firstCard && firstCard.pairIndex === secondCard.pairIndex) {
        const newMatchedPairs = matchedPairs + 1;
        setMatchedPairs(newMatchedPairs);
        setCards(prev => prev.map(c =>
          c.id === firstCardId || c.id === cardId ? { ...c, isMatched: true } : c
        ));
        setSelectedCards([]);

        if (newMatchedPairs === uniquePairs) {
          endGame(newMatchedPairs, mismatches, newScore);
        }
      } else {
        const newMismatches = mismatches + 1;
        setMismatches(newMismatches);
        flipBackTimer.current = setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === firstCardId || c.id === cardId ? { ...c, isFlipped: false } : c
          ));
          setSelectedCards([]);
        }, 1000);
      }
    }
  };

  const handleBackToMenu = () => {
    if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
    router.push('/cognitive-tests');
  };

  const handleExitTest = () => {
    if (gameState === 'playing') {
      Alert.alert(
        'Exit Test?',
        'Your progress will not be saved. Are you sure you want to exit?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: () => {
              if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
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
      router.push('/tests/connections?sequence=all-nine');
    } else {
      router.push('/cognitive-tests');
    }
  };

  const handlePlayAgain = () => {
    startGame();
  };

  useEffect(() => {
    const checkScheduledTest = async () => {
      try {
        addDebug('checkScheduledTest starting');
        const relevantTest = await getRelevantScheduledTest('memory');
        if (relevantTest) {
          setScheduledTest(relevantTest);
          const context = await getTestContext(relevantTest.id);
          setStudyContext(context);
        }
        addDebug('checkScheduledTest complete');
      } catch (error) {
        addDebug('checkScheduledTest failed', error as Error);
      }
    };
    checkScheduledTest();
    return () => {
      if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
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
                  Test 3 of 9
                </ThemedText>
              </ThemedView>
            )}
            <ThemedText type="title" style={styles.title}>Memory Test</ThemedText>
            {scheduledTest && studyContext?.supplement_name && (
              <ThemedView style={[styles.studyBanner, { backgroundColor: tintColor + '20', borderColor: tintColor }]}>
                <ThemedText style={[styles.studyText, { color: tintColor }]}>
                  Study Test for {studyContext.supplement_name}
                </ThemedText>
              </ThemedView>
            )}
            <ThemedText style={styles.instructions}>
              Flip cards to find pairs that match both in shape and color. Find all the pairs quickly with as few flips as possible.
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
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: 60 }]} 
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.resultsContainer}>
            <ThemedText type="title" style={styles.title}>Test Complete!</ThemedText>
            <ThemedText style={styles.finalScore}>Total Flips: {score}</ThemedText>
            <ThemedText style={styles.stats}>
              Accuracy: {((matchedPairs + mismatches) > 0 ? (matchedPairs / (matchedPairs + mismatches)) * 100 : 100).toFixed(1)}% | Speed: {completionTime.toFixed(1)}s
            </ThemedText>
            <ThemedText style={styles.stats}>
              Pairs Matched: {matchedPairs}/{uniquePairs} | Mismatches: {mismatches}
            </ThemedText>
            <ThemedText style={styles.resultMessage}>
              {score <= CARD_COUNT ? 'Perfect memory!' : 
               score <= CARD_COUNT * 1.25 ? 'Excellent performance!' : 
               score <= CARD_COUNT * 1.67 ? 'Good job!' : 
               score <= CARD_COUNT * 2.08 ? 'Not bad!' : 'Keep practicing!'}
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

  const { rows, cols } = GRID_CONFIG;
  const CARD_GAP = 6;
  const HORIZONTAL_PADDING = 20;
  const availableWidth = screenWidth - (HORIZONTAL_PADDING * 2);
  const availableHeight = screenHeight - 180;
  const cardSizeByWidth = (availableWidth - (cols - 1) * CARD_GAP) / cols;
  const cardSizeByHeight = (availableHeight - (rows - 1) * CARD_GAP) / rows;
  const cardSize = Math.floor(Math.min(cardSizeByWidth, cardSizeByHeight) * 0.78);

  return (
    <ThemedView style={styles.container} safeArea>
      <View style={styles.gameContainer}>
        <View style={[styles.infoBanner, { borderColor: tintColor }]}>
          <TouchableOpacity
            style={styles.bannerBackButton}
            onPress={handleExitTest}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={tintColor} />
          </TouchableOpacity>
          <View style={styles.bannerStats}>
            <ThemedText style={styles.bannerStatText}>Flips: {score}</ThemedText>
            <ThemedText style={styles.bannerStatText}>Pairs: {matchedPairs}/{uniquePairs}</ThemedText>
          </View>
        </View>
        
        <View style={styles.gridContainer}>
          {cards.map((card) => {
            const isCardFaceUp = card.isFlipped || card.isMatched;

            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.card,
                  {
                    width: cardSize,
                    height: cardSize,
                    margin: CARD_GAP / 2,
                    backgroundColor: isCardFaceUp ? '#f0f0f0' : tintColor,
                  }
                ]}
                onPress={() => handleCardPress(card.id)}
              >
                {isCardFaceUp && (
                  <View style={styles.cardContent}>
                    {renderShape(card.shape, card.color, cardSize * 0.5)}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ThemedView>
  );
}

export default function MemoryTestScreen() {
  const [fatalError, setFatalError] = useState<Error | null>(null);
  const tintColor = useThemeColor({}, 'tint');
  const router = useRouter();

  if (fatalError) {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView style={styles.errorContainer}>
          <ThemedText type="title" style={styles.errorTitle}>Memory Test Error</ThemedText>
          <ThemedText style={styles.errorMessage}>{fatalError.message}</ThemedText>
          <ThemedText style={styles.errorStack}>{fatalError.stack}</ThemedText>
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: tintColor }]}
            onPress={() => router.push('/cognitive-tests')}
          >
            <ThemedText style={styles.startButtonText}>Back to Menu</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  }

  try {
    return <MemoryTestContent />;
  } catch (error) {
    setFatalError(error as Error);
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  gameScrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  instructionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: screenHeight * 0.7,
  },
  resultsContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  cardCountInfo: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 24,
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
    paddingTop: 10,
    paddingHorizontal: 20,
    flex: 1,
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
  flipsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pairsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  card: {
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    minHeight: 44,
    minWidth: 44,
  },
  cardSide: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardBack: {},
  cardFront: {},
  cardContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  square: {},
  circle: {},
  quadrantBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 4,
  },
  finalScore: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  stats: {
    fontSize: 18,
    marginBottom: 20,
    opacity: 0.8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textFallback: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textFallbackLabel: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#ff4d4d',
  },
  errorMessage: {
    fontSize: 16,
    marginBottom: 16,
    color: '#ff6666',
  },
  errorStack: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 24,
    color: '#888',
  },
  cardLabel: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabelText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
