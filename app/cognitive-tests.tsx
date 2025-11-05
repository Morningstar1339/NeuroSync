import React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CognitiveTestsScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const handleHomePress = () => {
    router.push('/');
  };

  const handleReflexesTest = () => {
    router.push('/tests/reflexes');
  };

  const handleMemoryTest = () => {
    router.push('/tests/memory');
  };

  const handleConnectionsTest = () => {
    router.push('/tests/connections');
  };

  const handleRockDodgerTest = () => {
    router.push('/tests/rock-dodger');
  };

  const handlePatternMatcherTest = () => {
    router.push('/tests/pattern-matcher');
  };

  const handleMelodyRepeaterTest = () => {
    router.push('/tests/melody-repeater');
  };

  const handleTilePuzzleTest = () => {
    router.push('/tests/tile-puzzle');
  };

  const handleBallCountingTest = () => {
    router.push('/tests/trail-maker');
  };

  const handleNBackTest = () => {
    router.push('/tests/n-back');
  };

  const handleAllNineTests = () => {
    router.push('/tests/all-nine');
  };

  return (
    <ThemedView style={styles.container} safeArea>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleHomePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="home-outline" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Cognitive Tests</ThemedText>
        <View style={styles.headerPlaceholder} />
      </ThemedView>

      <ThemedView style={styles.buttonContainer}>
        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleReflexesTest}>
          <Ionicons name="flash-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Reflexes</ThemedText>
          <ThemedText style={styles.buttonDescription}>10 seconds • Test reaction time</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleMemoryTest}>
          <Ionicons name="grid-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Memory</ThemedText>
          <ThemedText style={styles.buttonDescription}>60 seconds • Match pairs</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleConnectionsTest}>
          <Ionicons name="git-network-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Connections</ThemedText>
          <ThemedText style={styles.buttonDescription}>60 seconds • Connect dots optimally</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleRockDodgerTest}>
          <Ionicons name="shield-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Rock Dodger</ThemedText>
          <ThemedText style={styles.buttonDescription}>Until failure • Test reflexes and coordination</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handlePatternMatcherTest}>
          <Ionicons name="shapes-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Pattern Matcher</ThemedText>
          <ThemedText style={styles.buttonDescription}>Until complete • Working memory and logic</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleMelodyRepeaterTest}>
          <Ionicons name="musical-notes-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Melody Repeater</ThemedText>
          <ThemedText style={styles.buttonDescription}>Until failure • Auditory memory test</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleTilePuzzleTest}>
          <Ionicons name="grid-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>8-Tile Puzzle</ThemedText>
          <ThemedText style={styles.buttonDescription}>Until solved • Spatial reasoning test</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleBallCountingTest}>
          <Ionicons name="basketball-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>Ball Counting</ThemedText>
          <ThemedText style={styles.buttonDescription}>15 seconds • Count bouncing balls</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testButton, { borderColor: tintColor }]} onPress={handleNBackTest}>
          <Ionicons name="layers-outline" size={48} color={tintColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={styles.buttonText}>N-Back</ThemedText>
          <ThemedText style={styles.buttonDescription}>20 trials • Scientific working memory test</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.allTestsButton, { backgroundColor: tintColor }]} onPress={handleAllNineTests}>
          <Ionicons name="checkmark-done-outline" size={48} color={backgroundColor} style={styles.buttonIcon} />
          <ThemedText type="subtitle" style={[styles.buttonText, { color: backgroundColor }]}>All 9 Tests</ThemedText>
          <ThemedText style={[styles.buttonDescription, { color: backgroundColor, opacity: 0.9 }]}>Complete full test battery</ThemedText>
        </TouchableOpacity>
      </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 50,
    minHeight: screenHeight * 0.9,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  homeButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerPlaceholder: {
    width: 40,
    height: 40,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: 'flex-start',
    gap: 16,
    marginTop: 20,
  },
  testButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    width: '100%',
  },
  allTestsButton: {
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
    width: '100%',
  },
  buttonIcon: {
    marginBottom: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 1,
  },
  buttonDescription: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
});