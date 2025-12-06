import React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { Ionicons } from '@expo/vector-icons';

export default function AllTestsScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');

  const handleStartSequence = () => {
    router.push('/tests/reflexes?sequence=all-seven');
  };

  const handleBackToMenu = () => {
    router.push('/cognitive-tests');
  };

  const testSequence = [
    {
      id: 'reflexes',
      name: 'Reflexes Test',
      icon: 'flash-outline',
      duration: '10 seconds',
      description: 'Test reaction time',
    },
    {
      id: 'memory',
      name: 'Memory Test',
      icon: 'grid-outline',
      duration: '~60 seconds',
      description: 'Match card pairs',
    },
    {
      id: 'connections',
      name: 'Connections Test',
      icon: 'git-network-outline',
      duration: 'Until complete',
      description: 'Connect dots optimally',
    },
    {
      id: 'rock-dodger',
      name: 'Rock Dodger',
      icon: 'shield-outline',
      duration: 'Until failure',
      description: 'Test reflexes and coordination',
    },
    {
      id: 'pattern-matcher',
      name: 'Pattern Matcher',
      icon: 'shapes-outline',
      duration: 'Until complete',
      description: 'Working memory and logic',
    },
    {
      id: 'tile-puzzle',
      name: '8-Tile Puzzle',
      icon: 'apps-outline',
      duration: 'Until solved',
      description: 'Spatial reasoning test',
    },
    {
      id: 'n-back',
      name: 'N-Back',
      icon: 'layers-outline',
      duration: '20 trials',
      description: 'Scientific working memory test',
    },
  ];

  return (
    <ThemedView style={styles.container} safeArea>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleBackToMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back-outline" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>All 7 Tests</ThemedText>
        <View style={styles.headerPlaceholder} />
      </ThemedView>

      <ThemedView style={styles.content}>
        <ThemedText style={styles.description}>
          Complete the full cognitive test battery:{'\n'}
          All 7 tests measuring different cognitive abilities
        </ThemedText>

        <View style={styles.sequenceContainer}>
          {testSequence.map((test, index) => (
            <View key={test.id} style={styles.testItem}>
              <View style={styles.testInfo}>
                <Ionicons 
                  name={test.icon as any} 
                  size={20} 
                  color={tintColor} 
                  style={styles.testIcon} 
                />
                <View style={styles.testDetails}>
                  <ThemedText style={styles.testName}>{test.name}</ThemedText>
                  <ThemedText style={styles.testDuration}>{test.duration}</ThemedText>
                  <ThemedText style={styles.testDescription}>{test.description}</ThemedText>
                </View>
              </View>
              
              {index < testSequence.length - 1 && (
                <View style={styles.arrow}>
                  <Ionicons name="arrow-down" size={16} color={tintColor} />
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="time-outline" size={20} color={tintColor} style={styles.infoIcon} />
          <ThemedText style={styles.infoText}>
            Estimated total time: 10-20 minutes{'\n'}
            You can take breaks between tests if needed.
          </ThemedText>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={tintColor} style={styles.infoIcon} />
          <ThemedText style={styles.infoText}>
            Each test measures different cognitive abilities: reflexes, memory, attention, 
            spatial reasoning, and processing speed. Results are saved individually.
          </ThemedText>
        </View>

        <TouchableOpacity 
          style={[styles.startButton, { backgroundColor: tintColor }]} 
          onPress={handleStartSequence}
        >
          <ThemedText style={styles.startButtonText}>Start Full Test Battery</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={handleBackToMenu}>
          <ThemedText style={styles.backButtonText}>Back to Menu</ThemedText>
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
    paddingTop: 60,
    paddingBottom: 40,
    minHeight: screenHeight,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  content: {
    paddingHorizontal: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
    opacity: 0.8,
  },
  sequenceContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  testItem: {
    marginBottom: 12,
  },
  testInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testIcon: {
    marginRight: 10,
  },
  testDetails: {
    flex: 1,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 1,
  },
  testDuration: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
    marginBottom: 1,
  },
  testDescription: {
    fontSize: 12,
    opacity: 0.6,
  },
  arrow: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 6,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 48,
    width: '100%',
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
    minHeight: 44,
  },
  backButtonText: {
    fontSize: 16,
    opacity: 0.7,
  },
});
