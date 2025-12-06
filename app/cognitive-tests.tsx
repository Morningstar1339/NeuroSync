import React from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

const { width: screenWidth } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(80, (screenWidth - 100) / 3);
const GAP = 15;

const TESTS = [
  { key: 'reflexes',        label: 'Reflexes',   icon: 'flash-outline',         route: '/tests/reflexes' },
  { key: 'memory',          label: 'Memory',     icon: 'grid-outline',          route: '/tests/memory' },
  { key: 'connections',     label: 'Connects',   icon: 'git-network-outline',   route: '/tests/connections' },
  { key: 'rock-dodger',     label: 'Dodger',     icon: 'shield-outline',        route: '/tests/rock-dodger' },
  { key: 'pattern-matcher', label: 'Pattern',    icon: 'shapes-outline',        route: '/tests/pattern-matcher' },
  { key: 'tile-puzzle',     label: '8-Tile',     icon: 'apps-outline',          route: '/tests/tile-puzzle' },
  { key: 'n-back',          label: 'N-Back',     icon: 'layers-outline',        route: '/tests/n-back' },
] as const;

export default function CognitiveTestsScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');

  const handleHomePress = () => {
    router.push('/');
  };

  const startTest = (route: any) => {
    router.push(route);
  };

  const handleAllTests = () => {
    router.push('/tests/all-nine');
  };

  const handleInfoPress = () => {
    router.push('/tests/info');
  };

  const hexOffset = (CIRCLE_SIZE + GAP) / 2;
  const verticalSpacing = (CIRCLE_SIZE + GAP) * 0.866;

  return (
    <ThemedView style={styles.container} safeArea>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.header}>
          <TouchableOpacity
            style={styles.homeButton}
            onPress={handleHomePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="home-outline" size={24} color={tintColor} />
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>
            Cognitive Tests
          </ThemedText>
          <View style={styles.headerPlaceholder} />
        </ThemedView>

        <View style={styles.hexContainer}>
          <View style={styles.hexRow}>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor }]}
              onPress={() => startTest(TESTS[0].route)}
            >
              <Ionicons name={TESTS[0].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[0].label}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor }]}
              onPress={() => startTest(TESTS[1].route)}
            >
              <Ionicons name={TESTS[1].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[1].label}</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={[styles.hexRow, { marginTop: verticalSpacing - CIRCLE_SIZE }]}>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor }]}
              onPress={() => startTest(TESTS[2].route)}
            >
              <Ionicons name={TESTS[2].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[2].label}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor, backgroundColor: tintColor + '15' }]}
              onPress={() => startTest(TESTS[3].route)}
            >
              <Ionicons name={TESTS[3].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[3].label}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor }]}
              onPress={() => startTest(TESTS[4].route)}
            >
              <Ionicons name={TESTS[4].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[4].label}</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={[styles.hexRow, { marginTop: verticalSpacing - CIRCLE_SIZE }]}>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor }]}
              onPress={() => startTest(TESTS[5].route)}
            >
              <Ionicons name={TESTS[5].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[5].label}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circle, { borderColor: tintColor }]}
              onPress={() => startTest(TESTS[6].route)}
            >
              <Ionicons name={TESTS[6].icon as any} size={28} color={tintColor} />
              <ThemedText style={styles.circleLabel}>{TESTS[6].label}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <ThemedView style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.runAllButton, { backgroundColor: tintColor }]}
            onPress={handleAllTests}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={24}
              color={backgroundColor}
              style={styles.runAllIcon}
            />
            <ThemedText
              type="subtitle"
              style={[styles.runAllText, { color: backgroundColor }]}
            >
              Run All 7 Tests
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.infoButton}
            onPress={handleInfoPress}
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={tintColor}
              style={styles.infoIcon}
            />
            <ThemedText style={styles.infoText}>
              Info about these tests
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    paddingBottom: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeButton: {
    padding: 4,
  },
  headerPlaceholder: {
    width: 24,
    height: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  hexContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  hexRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: GAP,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  bottomButtons: {
    marginTop: 30,
    gap: 12,
  },
  runAllButton: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  runAllIcon: {
    marginRight: 8,
  },
  runAllText: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  infoIcon: {
    marginRight: 6,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
