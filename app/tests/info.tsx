import React from 'react';
import { StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';


export default function TestsInfoScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container} safeArea>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          About These Tests
        </ThemedText>
                <ThemedText style={styles.paragraph}>
          These cognitive tests measure different aspects of your attention,
          memory, and reaction time to help you track how your brain is
          performing over time.
        </ThemedText>
        <ThemedText style={styles.paragraph}>
          You can take individual tests from the menu, or run them all in
          sequence with the &quot;Run All Tests&quot; button.
        </ThemedText>


        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>{"Back to tests"}</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
