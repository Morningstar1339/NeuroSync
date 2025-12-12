import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';

const { height: screenHeight } = Dimensions.get('window');

const COLORS = ['#FF3B30', '#007AFF', '#34C759', '#FFCC00', '#AF52DE', '#FF9500'];
const SHAPES = ['●', '■', '▲', '◆', '★', '⬟'];

type PatternType = 'color_repeat' | 'shape_repeat' | 'alternating' | 'growing' | 'skip_one';

interface SequenceItem {
  colorIndex: number;
  shapeIndex: number;
}

interface PatternQuestion {
  sequence: SequenceItem[];
  correctAnswer: SequenceItem;
  options: SequenceItem[];
  patternType: PatternType;
}

export default function PatternMatcherTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentQuestion, setCurrentQuestion] = useState<PatternQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalQuestions] = useState(8);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  const [questionTimes, setQuestionTimes] = useState<number[]>([]);
  
  const startTime = useRef<number>(0);
  const questionStartTime = useRef<number>(0);

  const generatePattern = (): PatternQuestion => {
    const patternTypes: PatternType[] = ['color_repeat', 'shape_repeat', 'alternating', 'growing', 'skip_one'];
    const patternType = patternTypes[Math.floor(Math.random() * patternTypes.length)];
    
    let sequence: SequenceItem[] = [];
    let correctAnswer: SequenceItem;
    
    switch (patternType) {
      case 'color_repeat': {
        const baseColor = Math.floor(Math.random() * COLORS.length);
        const colorPattern = [baseColor, (baseColor + 1) % COLORS.length, (baseColor + 2) % COLORS.length];
        for (let i = 0; i < 5; i++) {
          sequence.push({
            colorIndex: colorPattern[i % 3],
            shapeIndex: 0
          });
        }
        correctAnswer = {
          colorIndex: colorPattern[5 % 3],
          shapeIndex: 0
        };
        break;
      }
      
      case 'shape_repeat': {
        const baseShape = Math.floor(Math.random() * SHAPES.length);
        const shapePattern = [baseShape, (baseShape + 1) % SHAPES.length];
        const fixedColor = Math.floor(Math.random() * COLORS.length);
        for (let i = 0; i < 5; i++) {
          sequence.push({
            colorIndex: fixedColor,
            shapeIndex: shapePattern[i % 2]
          });
        }
        correctAnswer = {
          colorIndex: fixedColor,
          shapeIndex: shapePattern[5 % 2]
        };
        break;
      }
      
      case 'alternating': {
        const color1 = Math.floor(Math.random() * COLORS.length);
        const color2 = (color1 + 2) % COLORS.length;
        const shape1 = Math.floor(Math.random() * SHAPES.length);
        const shape2 = (shape1 + 1) % SHAPES.length;
        for (let i = 0; i < 5; i++) {
          sequence.push({
            colorIndex: i % 2 === 0 ? color1 : color2,
            shapeIndex: i % 2 === 0 ? shape1 : shape2
          });
        }
        correctAnswer = {
          colorIndex: 5 % 2 === 0 ? color1 : color2,
          shapeIndex: 5 % 2 === 0 ? shape1 : shape2
        };
        break;
      }
      
      case 'growing': {
        const startColor = Math.floor(Math.random() * 3);
        const fixedShape = Math.floor(Math.random() * SHAPES.length);
        for (let i = 0; i < 5; i++) {
          sequence.push({
            colorIndex: (startColor + i) % COLORS.length,
            shapeIndex: fixedShape
          });
        }
        correctAnswer = {
          colorIndex: (startColor + 5) % COLORS.length,
          shapeIndex: fixedShape
        };
        break;
      }
      
      case 'skip_one': {
        const startShape = Math.floor(Math.random() * SHAPES.length);
        const fixedColor = Math.floor(Math.random() * COLORS.length);
        for (let i = 0; i < 5; i++) {
          sequence.push({
            colorIndex: fixedColor,
            shapeIndex: (startShape + i * 2) % SHAPES.length
          });
        }
        correctAnswer = {
          colorIndex: fixedColor,
          shapeIndex: (startShape + 5 * 2) % SHAPES.length
        };
        break;
      }
    }
    
    const options: SequenceItem[] = [correctAnswer];
    while (options.length < 4) {
      const wrongOption: SequenceItem = {
        colorIndex: Math.floor(Math.random() * COLORS.length),
        shapeIndex: Math.floor(Math.random() * SHAPES.length)
      };
      const isDuplicate = options.some(
        opt => opt.colorIndex === wrongOption.colorIndex && opt.shapeIndex === wrongOption.shapeIndex
      );
      if (!isDuplicate) {
        options.push(wrongOption);
      }
    }
    
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    
    return { sequence, correctAnswer, options, patternType };
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
    setGameState('playing');
    setQuestionNumber(1);
    setCorrectAnswers(0);
    setSelectedOption(null);
    setShowFeedback(false);
    setQuestionTimes([]);
    setCurrentQuestion(generatePattern());
    startTime.current = Date.now();
    questionStartTime.current = Date.now();
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (showFeedback) return;
    
    setSelectedOption(optionIndex);
    setShowFeedback(true);
    
    const questionTime = (Date.now() - questionStartTime.current) / 1000;
    setQuestionTimes(prev => [...prev, questionTime]);
    
    const selectedItem = currentQuestion!.options[optionIndex];
    const isCorrect = 
      selectedItem.colorIndex === currentQuestion!.correctAnswer.colorIndex &&
      selectedItem.shapeIndex === currentQuestion!.correctAnswer.shapeIndex;
    
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
    }
    
    setTimeout(() => {
      if (questionNumber >= totalQuestions) {
        endGame(isCorrect ? correctAnswers + 1 : correctAnswers);
      } else {
        setQuestionNumber(prev => prev + 1);
        setCurrentQuestion(generatePattern());
        setSelectedOption(null);
        setShowFeedback(false);
        questionStartTime.current = Date.now();
      }
    }, 1200);
  };

  const endGame = useCallback(async (finalCorrect: number) => {
    setGameState('finished');
    
    const completionTime = (Date.now() - startTime.current) / 1000;
    const accuracy = finalCorrect / totalQuestions;
    const avgSpeed = questionTimes.length > 0 
      ? questionTimes.reduce((a, b) => a + b, 0) / questionTimes.length 
      : completionTime / totalQuestions;
    
    const rawData = {
      completionTime,
      correctAnswers: finalCorrect,
      totalQuestions,
      accuracy,
      avgResponseTime: avgSpeed,
      questionTimes
    };
    
    try {
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      const score = Math.round(accuracy * 100);
      await saveCognitiveTestResult('pattern_matcher', score, rawData, completionTime, studyId, supplementLogId, accuracy, avgSpeed);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save pattern matcher test result:', error);
    }
  }, [scheduledTest, studyContext, totalQuestions, questionTimes]);

  const handleBackToMenu = () => {
    if (params.sequence === 'all-seven') {
      router.push('/tests/all-nine');
    } else {
      router.push('/cognitive-tests');
    }
  };

  const handleNextTestOrFinish = () => {
    if (params.sequence === 'all-seven') {
      router.push('/tests/tile-puzzle?sequence=all-seven');
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

  const renderSequenceItem = (item: SequenceItem, index: number, isOption: boolean = false, optionIndex?: number) => {
    const isSelected = isOption && selectedOption === optionIndex;
    const isCorrectAnswer = isOption && showFeedback && currentQuestion && 
      item.colorIndex === currentQuestion.correctAnswer.colorIndex &&
      item.shapeIndex === currentQuestion.correctAnswer.shapeIndex;
    const isWrongSelection = isOption && showFeedback && isSelected && !isCorrectAnswer;
    
    return (
      <View
        key={index}
        style={[
          styles.sequenceItem,
          isOption && styles.optionItem,
          isSelected && !showFeedback && styles.selectedOption,
          isCorrectAnswer && showFeedback && styles.correctOption,
          isWrongSelection && styles.wrongOption
        ]}
      >
        <ThemedText style={[styles.shapeText, { color: COLORS[item.colorIndex] }]}>
          {SHAPES[item.shapeIndex]}
        </ThemedText>
      </View>
    );
  };

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
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
              Find the hidden pattern!{'\n\n'}
              🔍 Study the sequence of shapes{'\n'}
              🧠 Figure out the underlying rule{'\n'}
              ❓ Select what comes next{'\n'}
              ⏱️ {totalQuestions} questions total
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
    const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
    
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.resultsContainer}>
            <ThemedText type="title" style={styles.title}>Test Complete!</ThemedText>
            <ThemedText style={styles.finalScore}>{correctAnswers} / {totalQuestions}</ThemedText>
            <ThemedText style={styles.metricText}>Accuracy: {accuracy}%</ThemedText>
            <ThemedText style={styles.metricText}>Time: {completionTime.toFixed(1)}s</ThemedText>
            <ThemedText style={styles.resultMessage}>
              {accuracy >= 90 ? 'Excellent pattern recognition!' : 
               accuracy >= 70 ? 'Good analytical thinking!' : 
               accuracy >= 50 ? 'Keep practicing!' : 'Try focusing on the sequence changes'}
            </ThemedText>
            {params.sequence === 'all-seven' ? (
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
        <ThemedView style={styles.gameHeader}>
          <ThemedText style={styles.questionCounter}>Question {questionNumber}/{totalQuestions}</ThemedText>
          <ThemedText style={styles.scoreText}>{correctAnswers} correct</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.patternSection}>
          <ThemedText style={styles.sectionTitle}>What comes next?</ThemedText>
          <View style={styles.sequenceContainer}>
            {currentQuestion?.sequence.map((item, index) => renderSequenceItem(item, index))}
            <View style={styles.questionMark}>
              <ThemedText style={styles.questionMarkText}>?</ThemedText>
            </View>
          </View>
        </ThemedView>

        <ThemedView style={styles.optionsSection}>
          <ThemedText style={styles.sectionTitle}>Select your answer:</ThemedText>
          <View style={styles.optionsGrid}>
            {currentQuestion?.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleOptionSelect(index)}
                disabled={showFeedback}
                style={styles.optionTouchable}
              >
                {renderSequenceItem(option, index, true, index)}
              </TouchableOpacity>
            ))}
          </View>
        </ThemedView>

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
    paddingTop: 40,
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
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 20,
    marginBottom: 20,
  },
  questionCounter: {
    fontSize: 18,
    fontWeight: '600',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '600',
  },
  patternSection: {
    marginBottom: 40,
    alignItems: 'center',
  },
  optionsSection: {
    marginBottom: 30,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  sequenceContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sequenceItem: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  optionItem: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },
  optionTouchable: {
    margin: 8,
  },
  selectedOption: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  correctOption: {
    borderWidth: 3,
    borderColor: '#34C759',
    backgroundColor: '#34C75920',
  },
  wrongOption: {
    borderWidth: 3,
    borderColor: '#FF3B30',
    backgroundColor: '#FF3B3020',
  },
  shapeText: {
    fontSize: 28,
  },
  questionMark: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#999',
    borderStyle: 'dashed',
  },
  questionMarkText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  finalScore: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center',
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
