import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';
import { useHierarchicalBack } from '@/hooks/use-hierarchical-back';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext } from '@/database/study-scheduler';

interface QuestionnaireAnswers {
  happyRating: number | null;
  focusRating: number | null;
  motivationRating: number | null;
  energyRating: number | null;
  hungerRating: number | null;
}

export default function QuestionnaireScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const tintColor = useThemeColor({}, 'tint');
  
  useHierarchicalBack('tests/questionnaire');
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'finished'>('ready');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    happyRating: null,
    focusRating: null,
    motivationRating: null,
    energyRating: null,
    hungerRating: null,
  });
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);

  React.useEffect(() => {
    const loadScheduledTest = async () => {
      try {
        const test = await getRelevantScheduledTest('questionnaire');
        if (test) {
          setScheduledTest(test);
          const context = await getTestContext(test.id);
          setStudyContext(context);
        }
      } catch (error) {
        console.error('Failed to load scheduled test:', error);
      }
    };
    loadScheduledTest();
  }, []);

  const handleExitTest = () => {
    if (gameState === 'playing') {
      Alert.alert(
        'Exit Mood Check?',
        'Your answers will not be saved.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleStart = () => {
    setGameState('playing');
    setCurrentQuestion(0);
  };

  const calculateScore = (): number => {
    let sum = 0;
    if (answers.happyRating !== null) sum += (answers.happyRating - 1);
    if (answers.focusRating !== null) sum += (answers.focusRating - 1);
    if (answers.motivationRating !== null) sum += (answers.motivationRating - 1);
    if (answers.energyRating !== null) sum += (answers.energyRating - 1);
    return Math.round(sum * 6.25);
  };

  const handleFinish = async () => {
    setGameState('finished');
    
    const score = calculateScore();
    const rawData = { ...answers };
    
    try {
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      await saveCognitiveTestResult('questionnaire', score, rawData, undefined, studyId, supplementLogId);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save questionnaire:', error);
    }
  };

  const handleRating = (rating: number) => {
    if (currentQuestion === 0) {
      setAnswers(prev => ({ ...prev, happyRating: rating }));
      setCurrentQuestion(1);
    } else if (currentQuestion === 1) {
      setAnswers(prev => ({ ...prev, focusRating: rating }));
      setCurrentQuestion(2);
    } else if (currentQuestion === 2) {
      setAnswers(prev => ({ ...prev, motivationRating: rating }));
      setCurrentQuestion(3);
    } else if (currentQuestion === 3) {
      setAnswers(prev => ({ ...prev, energyRating: rating }));
      setCurrentQuestion(4);
    } else if (currentQuestion === 4) {
      setAnswers(prev => ({ ...prev, hungerRating: rating }));
      handleFinish();
    }
  };

  const handleDone = () => {
    if (params.sequence === 'all-nine') {
      router.push('/tests/reflexes?sequence=all-nine');
    } else {
      router.back();
    }
  };

  const renderRatingQuestion = (question: string) => (
    <View style={styles.questionContainer}>
      <ThemedText style={styles.questionText}>{question}</ThemedText>
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map(rating => (
          <TouchableOpacity
            key={rating}
            style={[styles.ratingButton, { borderColor: tintColor }]}
            onPress={() => handleRating(rating)}
          >
            <ThemedText style={[styles.ratingText, { color: tintColor }]}>{rating}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.ratingLabels}>
        <ThemedText style={styles.ratingLabel}>Low</ThemedText>
        <ThemedText style={styles.ratingLabel}>High</ThemedText>
      </View>
    </View>
  );

  const renderQuestion = () => {
    switch (currentQuestion) {
      case 0:
        return renderRatingQuestion('How happy are you?');
      case 1:
        return renderRatingQuestion('How focused are you?');
      case 2:
        return renderRatingQuestion('How motivated are you?');
      case 3:
        return renderRatingQuestion('How much energy do you have?');
      case 4:
        return renderRatingQuestion('How hungry are you?');
      default:
        return null;
    }
  };

  const totalQuestions = 5;

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <View style={styles.readyContent}>
          {params.sequence === 'all-nine' && (
            <ThemedView style={[styles.progressBanner, { backgroundColor: tintColor + '15', borderColor: tintColor }]}>
              <ThemedText style={[styles.progressBannerText, { color: tintColor }]}>
                Test 1 of 9
              </ThemedText>
            </ThemedView>
          )}
          <Ionicons name="happy-outline" size={64} color={tintColor} />
          <ThemedText type="title" style={styles.readyTitle}>Mood Check</ThemedText>
          <ThemedText style={styles.readyDescription}>
            Track how you're feeling right now.
          </ThemedText>
          <ThemedText style={styles.readyInfo}>~10 seconds | 5 questions</ThemedText>
          
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: tintColor }]}
            onPress={handleStart}
          >
            <ThemedText style={styles.startButtonText}>Start</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleExitTest}>
            <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (gameState === 'finished') {
    const score = calculateScore();
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.finishedContent}>
          <Ionicons name="checkmark-circle" size={80} color="#34C759" />
          <ThemedText type="title" style={styles.finishedTitle}>Complete!</ThemedText>
          <ThemedText style={styles.finishedScore}>Well-being Score: {score}</ThemedText>
          
          <View style={styles.summaryContainer}>
            <ThemedText style={styles.summaryTitle}>Summary</ThemedText>
            {answers.happyRating !== null && (
              <ThemedText style={styles.summaryItem}>
                Happiness: {answers.happyRating}/5
              </ThemedText>
            )}
            {answers.focusRating !== null && (
              <ThemedText style={styles.summaryItem}>
                Focus: {answers.focusRating}/5
              </ThemedText>
            )}
            {answers.motivationRating !== null && (
              <ThemedText style={styles.summaryItem}>
                Motivation: {answers.motivationRating}/5
              </ThemedText>
            )}
            {answers.energyRating !== null && (
              <ThemedText style={styles.summaryItem}>
                Energy: {answers.energyRating}/5
              </ThemedText>
            )}
            {answers.hungerRating !== null && (
              <ThemedText style={styles.summaryItem}>
                Hunger: {answers.hungerRating}/5
              </ThemedText>
            )}
          </View>
          
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: tintColor }]}
            onPress={handleDone}
          >
            <ThemedText style={styles.doneButtonText}>
              {params.sequence === 'all-nine' ? 'Next Test' : 'Done'}
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} safeArea>
      <ThemedView style={[styles.infoBanner, { borderColor: tintColor }]}>
        <TouchableOpacity
          style={styles.bannerBackButton}
          onPress={handleExitTest}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={tintColor} />
        </TouchableOpacity>
        <View style={styles.bannerStats}>
          <ThemedText style={styles.bannerStatText}>
            Question {currentQuestion + 1} of {totalQuestions}
          </ThemedText>
        </View>
      </ThemedView>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentQuestion + 1) / totalQuestions) * 100}%`, backgroundColor: tintColor }
          ]}
        />
      </View>

      <View style={styles.playingContent}>
        {renderQuestion()}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
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
    justifyContent: 'center',
  },
  bannerStatText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  readyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  readyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  readyDescription: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 4,
  },
  readyInfo: {
    fontSize: 14,
    opacity: 0.5,
    marginBottom: 24,
  },
  startButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  backButtonText: {
    fontSize: 16,
    opacity: 0.7,
  },
  playingContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  questionContainer: {
    alignItems: 'center',
  },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 32,
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 20,
    fontWeight: '600',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginTop: 8,
  },
  ratingLabel: {
    fontSize: 12,
    opacity: 0.5,
  },
  finishedContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  finishedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  finishedScore: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 30,
  },
  summaryContainer: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 14,
    marginBottom: 6,
    opacity: 0.8,
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 12,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 18,
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
  progressBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
