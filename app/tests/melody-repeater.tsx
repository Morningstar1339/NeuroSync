import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, Alert, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveCognitiveTestResult } from '@/database/cognitive-tests';
import { getRelevantScheduledTest, completeScheduledTest, getTestContext, isUserInActiveTestSession } from '@/database/study-scheduler';
import { Audio } from 'expo-av';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const KEY_WIDTH = screenWidth * 0.12;
const KEY_HEIGHT = 120;

// Piano keys C through B with ROYGBIV colors and solfege names
const PIANO_KEYS = [
  { id: 0, note: 'C', solfege: 'Do', color: '#FF3B30', frequency: 261.63 }, // Red
  { id: 1, note: 'D', solfege: 'Re', color: '#FF8C00', frequency: 293.66 }, // Orange
  { id: 2, note: 'E', solfege: 'Mi', color: '#FFD700', frequency: 329.63 }, // Yellow
  { id: 3, note: 'F', solfege: 'Fa', color: '#32CD32', frequency: 349.23 }, // Green
  { id: 4, note: 'G', solfege: 'So', color: '#1E90FF', frequency: 392.00 }, // Blue
  { id: 5, note: 'A', solfege: 'La', color: '#8A2BE2', frequency: 440.00 }, // Indigo/Purple
  { id: 6, note: 'B', solfege: 'Ti', color: '#9400D3', frequency: 493.88 }, // Violet
];

// Sequence lengths: 3, 6, 9, 12, 15, 18, 21, 24
const SEQUENCE_LENGTHS = [3, 6, 9, 12, 15, 18, 21, 24];

// Removed unused PianoKey interface - using direct object structure

export default function MelodyRepeaterTestScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'showing' | 'input' | 'retry' | 'finished'>('ready');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInput, setPlayerInput] = useState<number[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0); // Index into SEQUENCE_LENGTHS
  const [retryCount, setRetryCount] = useState(0);
  const [totalRetries, setTotalRetries] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  // Removed currentStreak state - only tracking longestStreak
  const [sequenceStartTime, setSequenceStartTime] = useState(0);
  const [sequenceTimes, setSequenceTimes] = useState<number[]>([]);
  const [noteAccuracy, setNoteAccuracy] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const [scheduledTest, setScheduledTest] = useState<any>(null);
  const [studyContext, setStudyContext] = useState<any>(null);
  const [activeTestSession, setActiveTestSession] = useState<any>(null);
  const [highlightedKey, setHighlightedKey] = useState<number | null>(null);
  
  const sounds = useRef<{ [key: number]: Audio.Sound }>({});
  const sequenceIndex = useRef(0);
  const gameStartTime = useRef<number>(0);
  const currentOscillator = useRef<any>(null);
  const lastNoteTime = useRef<number>(0);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const initializeSounds = async () => {
      // Initialize Web Audio API context for better control
      try {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error('Failed to create AudioContext:', error);
      }
      await loadSounds();
    };
    
    initializeSounds();
    
    return () => {
      unloadSounds();
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  const loadSounds = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        shouldDuckAndroid: true,
      });

      for (const key of PIANO_KEYS) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: generateSawtoothToneUri(key.frequency, 0.333) }, // ~333ms for 3 notes per second
          { shouldPlay: false }
        );
        sounds.current[key.id] = sound;
      }
    } catch (error) {
      console.error('Failed to load sounds:', error);
    }
  };

  const unloadSounds = async () => {
    for (const sound of Object.values(sounds.current)) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.error('Failed to unload sound:', error);
      }
    }
  };

  const generateSawtoothToneUri = (frequency: number, duration: number): string => {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);
    
    // Generate sawtooth wave with exponential fade out
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      
      // Exponential fade out over 100ms at the end
      const fadeOutStart = duration - 0.1; // Last 100ms
      let envelope = 1;
      if (t > fadeOutStart) {
        const fadeProgress = (t - fadeOutStart) / 0.1;
        envelope = Math.exp(-fadeProgress * 5); // Exponential fade
      }
      
      // Generate sawtooth wave (sharper, more electronic sound)
      const phase = (frequency * t) % 1;
      const sawtooth = 2 * phase - 1; // Sawtooth from -1 to 1
      
      buffer[i] = envelope * sawtooth * 0.4; // Reduced volume to prevent clipping
    }
    
    const wavBuffer = encodeWAV(buffer, sampleRate);
    const base64 = arrayBufferToBase64(wavBuffer);
    return `data:audio/wav;base64,${base64}`;
  };

  const encodeWAV = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    
    return buffer;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const playNote = async (keyId: number, duration = 333) => {
    try {
      // Cancel any playing note first
      if (currentOscillator.current) {
        try {
          currentOscillator.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        currentOscillator.current = null;
      }
      
      // Check cooldown to prevent rapid tapping glitches
      if (Date.now() - lastNoteTime.current < 100) {
        console.log('Note cooldown active, skipping');
        return;
      }
      lastNoteTime.current = Date.now();
      
      // Use Web Audio API for better control
      if (audioContext.current && audioContext.current.state === 'running') {
        const frequency = PIANO_KEYS[keyId].frequency;
        const oscillator = audioContext.current.createOscillator();
        const gainNode = audioContext.current.createGain();
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = frequency;
        
        // Amplitude envelope with exponential decay
        gainNode.gain.value = 0.3;
        gainNode.gain.exponentialRampToValueAtTime(
          0.01, 
          audioContext.current.currentTime + (duration / 1000) - 0.1
        );
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.current.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.current.currentTime + duration / 1000);
        
        currentOscillator.current = oscillator;
      } else {
        // Fallback to Expo Audio
        const sound = sounds.current[keyId];
        if (sound) {
          await sound.replayAsync();
        }
      }
    } catch (error) {
      console.error('Failed to play note:', error);
    }
  };

  const generateSequence = (length: number): number[] => {
    const newSequence: number[] = [];
    for (let i = 0; i < length; i++) {
      newSequence.push(Math.floor(Math.random() * PIANO_KEYS.length));
    }
    return newSequence;
  };

  const playSequence = async () => {
    console.log('🎵 Starting sequence playback, length:', sequence.length);
    setGameState('showing');
    sequenceIndex.current = 0;
    
    // Ensure audio context is running
    if (audioContext.current && audioContext.current.state === 'suspended') {
      try {
        await audioContext.current.resume();
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
    
    const playNextNote = async () => {
      if (sequenceIndex.current < sequence.length) {
        const keyId = sequence[sequenceIndex.current];
        console.log(`🎵 Playing note ${sequenceIndex.current + 1}/${sequence.length}: ${PIANO_KEYS[keyId].note}`);
        
        setHighlightedKey(keyId);
        await playNote(keyId, 333); // Fixed 333ms duration
        
        setTimeout(() => {
          setHighlightedKey(null);
          sequenceIndex.current++;
          setTimeout(playNextNote, 50) as any; // 50ms gap between notes
        }, 333) as any; // Note duration
      } else {
        // Add extra buffer after final note
        setTimeout(() => {
          console.log('🎵 Sequence complete, ready for input');
          setGameState('input');
          setPlayerInput([]);
          setSequenceStartTime(Date.now());
        }, 50) as any; // Buffer after final note
      }
    };
    
    // Start immediately after state change
    setTimeout(playNextNote, 100) as any;
  };

  const handleKeyPress = async (keyId: number) => {
    if (gameState !== 'input') return;
    
    console.log(`🎹 Key pressed: ${PIANO_KEYS[keyId].note}`);
    
    await playNote(keyId, 200); // Shorter duration for user input
    setHighlightedKey(keyId);
    setTimeout(() => setHighlightedKey(null), 200) as any;
    
    const newPlayerInput = [...playerInput, keyId];
    setPlayerInput(newPlayerInput);
    
    // Track note accuracy
    const isCorrectNote = keyId === sequence[newPlayerInput.length - 1];
    setNoteAccuracy(prev => ({
      correct: prev.correct + (isCorrectNote ? 1 : 0),
      total: prev.total + 1
    }));
    
    if (newPlayerInput.length === sequence.length) {
      checkSequence(newPlayerInput);
    }
  };

  const checkSequence = (input: number[]) => {
    const isCorrect = input.every((note, index) => note === sequence[index]);
    const sequenceTime = Date.now() - sequenceStartTime;
    
    if (isCorrect) {
      // Success - move to next level
      setSequenceTimes(prev => [...prev, sequenceTime]);
      setLongestStreak(current => current + 1);
      setRetryCount(0);
      
      if (currentLevel < SEQUENCE_LENGTHS.length - 1) {
        // Next level
        const nextLevel = currentLevel + 1;
        setCurrentLevel(nextLevel);
        const newSequence = generateSequence(SEQUENCE_LENGTHS[nextLevel]);
        setSequence(newSequence);
        
        // Auto-play next sequence after success
        setTimeout(() => {
          console.log('🎮 Advancing to level', nextLevel + 1);
          playSequence();
        }, 800) as any; // Shorter delay between levels
      } else {
        // Game complete!
        endGame();
      }
    } else {
      // Failure - retry system
      // Reset streak on failure (handled by longestStreak tracking)
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);
      setTotalRetries(prev => prev + 1);
      
      setGameState('retry');
    }
  };

  const handleRetry = () => {
    console.log('🔄 Retrying sequence');
    // Auto-replay the same sequence on retry
    setTimeout(() => {
      playSequence();
    }, 300) as any; // Quick retry
  };

  const startGame = async () => {
    try {
      const activeSession = await isUserInActiveTestSession();
      if (activeSession.isActive && activeSession.activeTest?.test_type !== 'melody_repeater') {
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
    const initialSequence = generateSequence(SEQUENCE_LENGTHS[0]); // Start with 3 notes
    
    setGameState('playing');
    setSequence(initialSequence);
    setPlayerInput([]);
    setCurrentLevel(0);
    setRetryCount(0);
    setTotalRetries(0);
    setLongestStreak(0);
    setSequenceTimes([]);
    setNoteAccuracy({ correct: 0, total: 0 });
    gameStartTime.current = Date.now();
    
    console.log('🎮 Game started with sequence:', initialSequence.map(id => PIANO_KEYS[id].note));
    
    // Auto-play the sequence with minimal delay
    setTimeout(() => {
      playSequence();
    }, 200) as any; // Very short delay to ensure state is set
  };

  const endGame = async () => {
    setGameState('finished');
    
    const totalTime = (Date.now() - gameStartTime.current) / 1000;
    const averageSequenceTime = sequenceTimes.length > 0 
      ? sequenceTimes.reduce((a, b) => a + b, 0) / sequenceTimes.length 
      : 0;
    const noteAccuracyPercent = noteAccuracy.total > 0 ? (noteAccuracy.correct / noteAccuracy.total) * 100 : 0;
    
    const rawData = {
      totalRetries,
      longestStreak,
      sequencesCompleted: sequenceTimes.length,
      averageSequenceTime,
      noteAccuracy: noteAccuracyPercent,
      finalLevel: currentLevel + 1,
      maxNotesReached: SEQUENCE_LENGTHS[currentLevel],
      totalTime
    };
    
    try {
      const studyId = scheduledTest ? studyContext?.study_protocol_id : undefined;
      const supplementLogId = scheduledTest ? studyContext?.supplement_log_id : undefined;
      
      // Score based on progress (higher is better)
      const progressScore = Math.min(100, (currentLevel + 1) * 12.5); // 8 levels max
      const retryPenalty = Math.max(0, 100 - (totalRetries * 5));
      const finalScore = Math.floor((progressScore + retryPenalty) / 2);
      
      await saveCognitiveTestResult('melody_repeater', finalScore, rawData, totalTime, studyId, supplementLogId);
      
      if (scheduledTest) {
        await completeScheduledTest(scheduledTest.id);
      }
    } catch (error) {
      console.error('Failed to save melody repeater test result:', error);
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
        if (activeSession.isActive && activeSession.activeTest?.test_type !== 'melody_repeater') {
          setActiveTestSession(activeSession);
        }
        
        const relevantTest = await getRelevantScheduledTest('melody_repeater');
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

  if (gameState === 'ready') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.instructionsContainer}>
            <ThemedText type="title" style={styles.title}>Melody Repeater</ThemedText>
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
              Listen and repeat melodies on the keyboard!{'\n\n'}
              🎵 Sequences automatically play when you start{'\n'}
              • Listen to sequences of 3, 6, 9... up to 24 notes{'\n'}
              • Each key plays a sawtooth wave (C through B){'\n'}
              • Get retries after mistakes (replays same sequence){'\n'}
              • Goal: Complete the 24-note sequence{'\n'}
              • ROYGBIV colors help you remember
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
    // Calculate final metrics
    const averageSequenceTime = sequenceTimes.length > 0 
      ? sequenceTimes.reduce((a, b) => a + b, 0) / sequenceTimes.length / 1000
      : 0;
    const noteAccuracyPercent = noteAccuracy.total > 0 ? (noteAccuracy.correct / noteAccuracy.total) * 100 : 0;
    
    return (
      <ThemedView style={styles.container} safeArea>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedView style={styles.resultsContainer}>
            <ThemedText type="title" style={styles.title}>
              {currentLevel === SEQUENCE_LENGTHS.length - 1 ? 'Completed!' : 'Game Over!'}
            </ThemedText>
            <ThemedText style={styles.finalScore}>Max Notes: {SEQUENCE_LENGTHS[currentLevel]}</ThemedText>
            <ThemedText style={styles.metricText}>Total Retries: {totalRetries}</ThemedText>
            <ThemedText style={styles.metricText}>Longest Streak: {longestStreak}</ThemedText>
            <ThemedText style={styles.metricText}>Note Accuracy: {noteAccuracyPercent.toFixed(1)}%</ThemedText>
            <ThemedText style={styles.metricText}>Avg Time/Sequence: {averageSequenceTime.toFixed(1)}s</ThemedText>
            <ThemedText style={styles.resultMessage}>
              {currentLevel >= 7 ? 'Incredible musical memory!' : 
               currentLevel >= 5 ? 'Outstanding performance!' : 
               currentLevel >= 3 ? 'Great musical skills!' : 
               currentLevel >= 1 ? 'Good progress!' : 'Keep practicing!'}
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

  if (gameState === 'retry') {
    return (
      <ThemedView style={styles.container} safeArea>
        <ThemedView style={styles.retryContainer}>
          <ThemedText style={styles.retryTitle}>Try Again</ThemedText>
          <ThemedText style={styles.retryText}>
            Retry #{retryCount} for {SEQUENCE_LENGTHS[currentLevel]}-note sequence
          </ThemedText>
          <ThemedText style={styles.retrySubtext}>
            Listen carefully to the melody...
          </ThemedText>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: tintColor }]} 
            onPress={handleRetry}
          >
            <ThemedText style={styles.retryButtonText}>Replay Sequence</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} safeArea>
      <ThemedView style={styles.gameHeader}>
        <ThemedText style={styles.levelText}>Level: {currentLevel + 1}/8</ThemedText>
        <ThemedText style={styles.notesText}>Notes: {SEQUENCE_LENGTHS[currentLevel]}</ThemedText>
        <ThemedText style={styles.retriesText}>Retries: {totalRetries}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.statusContainer}>
        <ThemedText style={styles.statusText}>
          {gameState === 'showing' ? 'Listen and watch...' :
           gameState === 'input' ? `Play the melody (${playerInput.length}/${sequence.length})` :
           'Get ready...'}
        </ThemedText>
      </ThemedView>

      <View style={styles.pianoContainer}>
        <ThemedText style={styles.pianoLabel}>Melody Keyboard</ThemedText>
        <View style={styles.keysContainer}>
          {PIANO_KEYS.map((key) => (
            <TouchableOpacity
              key={key.id}
              style={[
                styles.pianoKey,
                { 
                  backgroundColor: 'white',
                  borderColor: highlightedKey === key.id ? '#000' : '#ccc',
                  borderWidth: highlightedKey === key.id ? 3 : 1,
                  transform: [{ scale: highlightedKey === key.id ? 1.05 : 1 }]
                }
              ]}
              onPress={() => handleKeyPress(key.id)}
              disabled={gameState !== 'input'}
            >
              <View style={[styles.colorOverlay, { backgroundColor: key.color }]} />
              <ThemedText style={styles.keyNote}>{key.note}</ThemedText>
              <ThemedText style={styles.keySolfege}>{key.solfege}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
  retryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
  levelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 16,
    fontWeight: '600',
  },
  retriesText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  pianoContainer: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  pianoLabel: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  keysContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  pianoKey: {
    width: KEY_WIDTH,
    height: KEY_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    position: 'relative',
  },
  colorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    opacity: 0.7,
  },
  keyNote: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  keySolfege: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  retryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  retrySubtext: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 40,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 18,
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