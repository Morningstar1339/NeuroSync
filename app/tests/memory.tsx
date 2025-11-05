import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Animated, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const ROWS = 6;
const COLS = 4;
const TOTAL_CARDS = ROWS * COLS; // 24 cards
const UNIQUE_PAIRS = TOTAL_CARDS / 2; // 12 pairs
// Removed timer - no time pressure!
const FLASH_DURATION = 1000; // 1 second
const PRE_FLASH_DELAY = 1500; // 1.5 second delay before flash

const SHAPES = ['triangle', 'square', 'circle'] as const;
const COLORS = ['#FF4444', '#00CC88', '#0088FF', '#FF8800'] as const;

type Shape = typeof SHAPES[number];
type Color = typeof COLORS[number];

interface Card {
  id: number;
  shape: Shape;
  color: Color;
  isFlipped: boolean;
  isMatched: boolean;
  flipAnimation: Animated.Value;
}

export default function MemoryTestScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [cards, setCards] = useState<Card[]>([]);
  const [score, setScore] = useState(0);
  const [completionTime, setCompletionTime] = useState(0);
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [consecutiveMatches, setConsecutiveMatches] = useState(0);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  
  // Removed game and countdown timers
  const flashTimer = useRef<NodeJS.Timeout | null>(null);
  const flipBackTimer = useRef<NodeJS.Timeout | null>(null);

  const animateCardFlip = (cardId: number, toValue: number, duration: number = 250) => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      Animated.timing(card.flipAnimation, {
        toValue,
        duration,
        useNativeDriver: true,
      }).start();
    }
  };

  const animateMultipleCards = (cardIds: number[], toValue: number, duration: number = 250) => {
    const animations = cardIds.map(cardId => {
      const card = cards.find(c => c.id === cardId);
      if (card) {
        return Animated.timing(card.flipAnimation, {
          toValue,
          duration,
          useNativeDriver: true,
        });
      }
      return null;
    }).filter(Boolean);
    
    if (animations.length > 0) {
      Animated.parallel(animations as Animated.CompositeAnimation[]).start();
    }
  };

  const generateCards = (): Card[] => {
    const pairs: { shape: Shape; color: Color }[] = [];
    
    // Generate 12 unique pairs
    for (let i = 0; i < UNIQUE_PAIRS; i++) {
      const shape = SHAPES[i % SHAPES.length];
      const colorIndex = Math.floor(i / SHAPES.length);
      const color = COLORS[colorIndex % COLORS.length];
      pairs.push({ shape, color });
    }
    
    // Create two cards for each pair
    const cardPairs: Card[] = [];
    if (pairs && Array.isArray(pairs)) {
      pairs.forEach((pair, index) => {
        if (pair && pair.shape && pair.color) {
          cardPairs.push(
            { id: index * 2, shape: pair.shape, color: pair.color, isFlipped: false, isMatched: false, flipAnimation: new Animated.Value(0) },
            { id: index * 2 + 1, shape: pair.shape, color: pair.color, isFlipped: false, isMatched: false, flipAnimation: new Animated.Value(0) }
          );
        }
      });
    }
    
    // Shuffle cards
    for (let i = cardPairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardPairs[i], cardPairs[j]] = [cardPairs[j], cardPairs[i]];
    }
    
    return cardPairs;
  };

  const startGame = () => {
    const newCards = generateCards();
    setCards(newCards);
    setGameState('playing');
    setScore(0);
    setCompletionTime(0);
    setSelectedCards([]);
    setMatchedPairs(0);
    setConsecutiveMatches(0);
    setGameStartTime(Date.now());
  };

  // Removed timer functions - no time pressure!

  const endGame = async () => {
    // Calculate completion time
    const finalCompletionTime = (Date.now() - gameStartTime) / 1000;
    setCompletionTime(finalCompletionTime);
    
    setGameState('finished');
    clearTimers();
    
    // Save test result with study context if available
    try {
      const rawData = {
        flips: score, // Total number of flips made
        matchedPairs,
        totalPairs: UNIQUE_PAIRS,
        completionTime: finalCompletionTime
      };
      
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      // Use flips as score - lower is better (like golf scoring)
      await saveCognitiveTestResult('memory', score, rawData, finalCompletionTime, studyId, supplementLogId);
      
      // Mark scheduled test as completed if this was for a study
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save memory test result:', error);
    }
  };

  const clearTimers = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (flipBackTimer.current) clearTimeout(flipBackTimer.current);
  };

  const handleCardPress = (cardId: number) => {
    if (gameState !== 'playing') return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;
    
    if (selectedCards.length === 0) {
      // First card selection
      setSelectedCards([cardId]);
      setCards(cards => cards.map(c => 
        c.id === cardId ? { ...c, isFlipped: true } : c
      ));
      animateCardFlip(cardId, 1);
      // Count each flip
      setScore(prev => prev + 1);
    } else if (selectedCards.length === 1) {
      // Second card selection
      setSelectedCards([...selectedCards, cardId]);
      setCards(cards => cards.map(c => 
        c.id === cardId ? { ...c, isFlipped: true } : c
      ));
      animateCardFlip(cardId, 1);
      // Count each flip
      setScore(prev => prev + 1);
      
      // Check for match
      const firstCard = cards.find(c => c.id === selectedCards[0]);
      const secondCard = cards.find(c => c.id === cardId);
      
      if (firstCard && secondCard && firstCard.shape === secondCard.shape && firstCard.color === secondCard.color) {
        // Match found
        setMatchedPairs(prev => prev + 1);
        setConsecutiveMatches(prev => prev + 1);
        setCards(cards => cards.map(c => 
          (c.id === selectedCards[0] || c.id === cardId) 
            ? { ...c, isMatched: true } 
            : c
        ));
        setSelectedCards([]);
        
        // Check if all pairs are matched
        if (matchedPairs + 1 === UNIQUE_PAIRS) {
          endGame();
        }
      } else {
        // No match - reset consecutive matches
        setConsecutiveMatches(0);
        
        // Flip cards back after a short delay
        flipBackTimer.current = setTimeout(() => {
          setCards(cards => cards.map(c => 
            (c.id === selectedCards[0] || c.id === cardId) 
              ? { ...c, isFlipped: false } 
              : c
          ));
          animateMultipleCards([selectedCards[0], cardId], 0);
          setSelectedCards([]);
        }, 1000);
      }
    }
  };

  const renderShape = (shape: Shape, color: Color) => {
    if (!shape || !color) {
      return <View style={styles.square} />;
    }
    
    const size = 20;
    switch (shape) {
      case 'triangle':
        return (
          <View style={[styles.triangle, { borderBottomColor: color, borderBottomWidth: size }]} />
        );
      case 'square':
        return (
          <View style={[styles.square, { backgroundColor: color, width: size, height: size }]} />
        );
      case 'circle':
        return (
          <View style={[styles.circle, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]} />
        );
      default:
        return <View style={[styles.square, { backgroundColor: color || '#ccc', width: size, height: size }]} />;
    }
  };

  const handleBackToMenu = () => {
    clearTimers();
    router.push('/cognitive-tests');
  };

  const handlePlayAgain = () => {
    startGame();
  };

  useEffect(() => {
    // Check for relevant scheduled test on component mount
    const checkScheduledTest = async () => {
      try {
        const relevantTest = await getRelevantScheduledTest('memory');
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
      clearTimers();
    };
  }, []);

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
          <ThemedText type="title" style={styles.title}>Memory Test</ThemedText>
          {scheduledTest && studyContext?.supplement_name && (
            <ThemedView style={[styles.studyBanner, { backgroundColor: tintColor + '20', borderColor: tintColor }]}>
              <ThemedText style={[styles.studyText, { color: tintColor }]}>
                📊 Study Test for {studyContext.supplement_name}
              </ThemedText>
            </ThemedView>
          )}
          <ThemedText style={styles.instructions}>
            🎯 NEW SIMPLIFIED SCORING:{'\n'}
            • Each card flip counts as +1{'\n'}
            • Goal: Complete with fewest flips possible{'\n'}
            • Perfect score: 24 flips (flip each card once){'\n'}
            • Your completion time is tracked (but no time limit!){'\n'}
            • Grid: 4×6 cards (12 pairs to find){'\n\n'}
            💡 Tip: Balance speed and accuracy for best results!
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
          <ThemedText style={styles.finalScore}>Total Flips: {score}</ThemedText>
          <ThemedText style={styles.stats}>
            Completion Time: {completionTime.toFixed(1)}s
          </ThemedText>
          <ThemedText style={styles.stats}>
            Pairs Matched: {matchedPairs}/{UNIQUE_PAIRS}
          </ThemedText>
          <ThemedText style={styles.resultMessage}>
            {score <= 24 ? 'Perfect memory!' : 
             score <= 30 ? 'Excellent performance!' : 
             score <= 40 ? 'Good job!' : 
             score <= 50 ? 'Not bad!' : 'Keep practicing!'}
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

  // Calculate responsive card dimensions
  const availableWidth = screenWidth - 40; // Account for padding
  const availableHeight = screenHeight - 140; // Account for header and safe areas (reduced from 200)
  const cardWidth = Math.min((availableWidth - (COLS + 1) * 4) / COLS, 80); // Max 80dp width
  const cardHeight = Math.min((availableHeight - (ROWS + 1) * 4) / ROWS, cardWidth * 1.4); // Maintain aspect ratio

  return (
    <ScrollView contentContainerStyle={styles.gameScrollContent} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.gameContainer}>
      <ThemedView style={styles.gameHeader}>
        <ThemedText style={styles.flipsText}>Flips: {score}</ThemedText>
        <ThemedText style={styles.pairsText}>Pairs: {matchedPairs}/{UNIQUE_PAIRS}</ThemedText>
      </ThemedView>
      
      <View style={styles.gridContainer}>
        {cards && Array.isArray(cards) ? cards.map((card, index) => {
          if (!card || !card.flipAnimation) {
            return null;
          }
          
          const row = Math.floor(index / COLS);
          const col = index % COLS;
          const quadrantRow = Math.floor(row / (ROWS / 2));
          const quadrantCol = Math.floor(col / (COLS / 2));
          const quadrantIndex = quadrantRow * 2 + quadrantCol;
          
          const quadrantColors = [
            'rgba(255, 107, 107, 0.05)', // Top-left: light red
            'rgba(78, 205, 196, 0.05)',  // Top-right: light teal
            'rgba(69, 183, 209, 0.05)',  // Bottom-left: light blue
            'rgba(150, 206, 180, 0.05)'  // Bottom-right: light green
          ];
          
          const frontInterpolate = card.flipAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '180deg'],
          });
          
          const backInterpolate = card.flipAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: ['180deg', '360deg'],
          });

          return (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.card,
                {
                  width: cardWidth - 4,
                  height: cardHeight - 4,
                }
              ]}
              onPress={() => handleCardPress(card.id)}
            >
              <View style={[styles.quadrantBackground, { backgroundColor: quadrantColors[quadrantIndex] }]} />
              
              {/* Back side of card (face down) */}
              <Animated.View 
                style={[
                  styles.cardSide,
                  styles.cardBack,
                  { backgroundColor: tintColor },
                  { transform: [{ rotateY: frontInterpolate }] }
                ]}
              />
              
              {/* Front side of card (face up) */}
              <Animated.View 
                style={[
                  styles.cardSide,
                  styles.cardFront,
                  { backgroundColor: '#f0f0f0' },
                  { transform: [{ rotateY: backInterpolate }] }
                ]}
              >
                <View style={styles.cardContent}>
                  {renderShape(card.shape, card.color)}
                </View>
              </Animated.View>
            </TouchableOpacity>
          );
        }) : null}
      </View>
    </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    minHeight: screenHeight * 0.9,
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
    justifyContent: 'center',
    minHeight: screenHeight * 0.7,
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
    marginBottom: 40,
    lineHeight: 24,
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
    paddingTop: 60,
    paddingHorizontal: 20,
    flex: 1,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    marginBottom: 10,
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
    margin: 2,
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
  cardBack: {
    // Back side styling
  },
  cardFront: {
    // Front side styling
  },
  cardContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  square: {
    // Dynamic styles applied inline
  },
  circle: {
    // Dynamic styles applied inline
  },
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
});