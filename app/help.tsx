import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HelpScreen() {
  const router = useRouter();
  const tintColor = useThemeColor({}, 'tint');

  const handleHomePress = () => {
    router.push('/');
  };

  const sections = [
    {
      title: "Getting Started",
      icon: "rocket-outline",
      content: [
        "NeuroSync helps you track how supplements affect your cognitive performance and symptoms.",
        "The core philosophy is frictionless logging - every interaction should be instant.",
        "Start by adding your supplements, then log when you take them. Run cognitive tests to measure effects."
      ]
    },
    {
      title: "Supplement Logging",
      icon: "medical-outline",
      content: [
        "• Tap 'Log Supplement' to see your supplement list",
        "• Tap a supplement to log it instantly with current timestamp",
        "• Use the pencil icon to edit dosage or timing after logging",
        "• Clock icon shows if supplement is on schedule (blue) or has active exclusions (red)",
        "• Set up schedules and exclusions in Settings > Edit Supplements"
      ]
    },
    {
      title: "Symptom Tracking",
      icon: "body-outline",
      content: [
        "• Tap 'Log Symptom' to open the body diagram",
        "• Tap any body region to see symptoms for that area",
        "• Rate severity from 1-5 and add optional notes",
        "• Previously logged symptoms appear first for quick selection",
        "• Create custom symptoms for any region"
      ]
    },
    {
      title: "Cognitive Tests",
      icon: "flash-outline",
      content: [
        "• Reflexes: Tap bubbles as fast as possible (10 seconds)",
        "• Memory: Match card pairs within 60 seconds",
        "• Connections: Connect dots optimally within 30 seconds",
        "• Results are delayed 24 hours to prevent gaming the system",
        "• Run 'All 3' to complete the full test battery"
      ]
    },
    {
      title: "Study Protocols",
      icon: "analytics-outline",
      content: [
        "Study protocols automatically schedule cognitive tests to measure supplement effects:",
        "• Event-based: Tests triggered when you log a supplement",
        "• Schedule-based: Tests at specific daily times",
        "• Configure in Settings > Edit Supplements > Study Protocol",
        "• Results are automatically linked to your supplement logs",
        "• System prevents test overlaps and suggests better timing"
      ]
    },
    {
      title: "Exclusions & Safety",
      icon: "warning-outline",
      content: [
        "Set safety rules to prevent unsafe supplement timing:",
        "• Time-based: 'Don't take between 10 PM and 6 AM'",
        "• Dosage-based: 'Don't exceed 200mg in 24 hours'",
        "• Clock icon turns red when exclusions are active",
        "• System warns you but allows override if needed",
        "• Configure in Settings > Edit Supplements > Exclusions"
      ]
    },
    {
      title: "Data Export",
      icon: "download-outline",
      content: [
        "Export your data for analysis in spreadsheets or other tools:",
        "• Menu > Export Data opens the export screen",
        "• Choose specific tables or date ranges",
        "• CSV files include both Unix timestamps and readable dates",
        "• Share directly to email, cloud storage, or save locally",
        "• All your data remains on your device - no cloud sync"
      ]
    },
    {
      title: "Tips for Effective Tracking",
      icon: "bulb-outline",
      content: [
        "• Log supplements immediately when taking them",
        "• Take cognitive tests at consistent times for better data",
        "• Use exclusions to prevent unsafe supplement timing",
        "• Run regular exports to back up your data",
        "• Be consistent with symptom severity ratings",
        "• Take baseline cognitive tests before starting new supplements"
      ]
    },
    {
      title: "Study Protocol Guidance",
      icon: "school-outline",
      content: [
        "For meaningful self-experimentation:",
        "• Test cognitive performance before starting a new supplement",
        "• Set up event-based protocols to test at multiple intervals",
        "• Consider testing: 30min, 1hr, 2hr, 4hr after taking supplement",
        "• Use longer study periods (weeks) for accurate assessment",
        "• Track multiple metrics: cognition, sleep, symptoms",
        "• Export data regularly for analysis in spreadsheets"
      ]
    },
    {
      title: "Sleep Tracking",
      icon: "moon-outline",
      content: [
        "• Sleep is tracked automatically when your phone is idle",
        "• Set your normal sleep time in settings to prevent false positives",
        "• Manual editing available in Menu > Sleep Logs",
        "• Sleep data correlates with cognitive performance",
        "• Duration and timing both affect supplement metabolism"
      ]
    }
  ];

  return (
    <ThemedView style={styles.container} safeArea>
      <ThemedView style={styles.header}>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={handleHomePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="home-outline" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Help & Documentation</ThemedText>
        <View style={styles.headerPlaceholder} />
      </ThemedView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.intro}>
          <ThemedText style={styles.introText}>
            NeuroSync is a self-experimentation app for tracking how supplements affect your 
            cognitive performance and physical symptoms. This guide covers all features and 
            best practices for effective tracking.
          </ThemedText>
        </ThemedView>

        {sections.map((section, index) => (
          <ThemedView key={index} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={24} color={tintColor} />
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                {section.title}
              </ThemedText>
            </View>
            
            {section.content.map((paragraph, pIndex) => (
              <ThemedText key={pIndex} style={styles.sectionContent}>
                {paragraph}
              </ThemedText>
            ))}
          </ThemedView>
        ))}

        <ThemedView style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Having trouble? Check that your data is being saved properly by running a test export. 
            All your data stays on your device - there's no cloud sync or external dependencies.
          </ThemedText>
          
          <View style={styles.versionInfo}>
            <ThemedText style={styles.versionText}>NeuroSync v1.0</ThemedText>
            <ThemedText style={styles.versionText}>Built for self-experimentation</ThemedText>
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
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
    flex: 1,
    paddingHorizontal: 20,
  },
  intro: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  introText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    marginLeft: 34, // Align with icon
  },
  footer: {
    marginTop: 30,
    marginBottom: 40,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 15,
  },
  versionInfo: {
    alignItems: 'center',
    gap: 4,
  },
  versionText: {
    fontSize: 12,
    opacity: 0.6,
  },
});