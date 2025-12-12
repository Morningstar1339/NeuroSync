// DISABLED FOR V1 - Re-enable for Mk II
/*
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Dimensions, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { BodyRegion } from '@/database/symptoms';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
// Calculate responsive diagram dimensions
const DIAGRAM_WIDTH = Math.min(screenWidth * 0.9, 350);
const DIAGRAM_HEIGHT = Math.min(screenHeight * 0.6, DIAGRAM_WIDTH * 1.8);

export default function BodyDiagramScreen() {
  const router = useRouter();

  const handleRegionPress = (region: BodyRegion) => {
    router.push({
      pathname: '/symptom-selection',
      params: { region }
    });
  };

  return (
    <ThemedView style={styles.container} safeArea>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>{"Select Body Region"}</ThemedText>
        <ThemedText style={styles.subtitle}>{"Tap the area where you&apos;re experiencing symptoms"}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.diagramContainer}>
        <View style={[styles.bodyDiagram, { width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT }]}>
          <TouchableOpacity 
            style={[styles.bodyRegion, styles.head]} 
            onPress={() => handleRegionPress('head')}
          >
            <ThemedText style={styles.regionText}>{"Head"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.thorax]} 
            onPress={() => handleRegionPress('thorax')}
          >
            <ThemedText style={styles.regionText}>{"Thorax"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.leftArm]} 
            onPress={() => handleRegionPress('arms')}
          >
            <ThemedText style={styles.regionText}>{"Arms"}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bodyRegion, styles.rightArm]} 
            onPress={() => handleRegionPress('arms')}
          >
            <ThemedText style={styles.regionText}>{"Arms"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.leftHand]} 
            onPress={() => handleRegionPress('hands')}
          >
            <ThemedText style={styles.regionTextSmall}>{"Hands"}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bodyRegion, styles.rightHand]} 
            onPress={() => handleRegionPress('hands')}
          >
            <ThemedText style={styles.regionTextSmall}>{"Hands"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.abdomen]} 
            onPress={() => handleRegionPress('abdomen')}
          >
            <ThemedText style={styles.regionText}>{"Abdomen"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.pelvis]} 
            onPress={() => handleRegionPress('pelvis')}
          >
            <ThemedText style={styles.regionText}>{"Pelvis"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.leftLeg]} 
            onPress={() => handleRegionPress('legs')}
          >
            <ThemedText style={styles.regionText}>{"Legs"}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bodyRegion, styles.rightLeg]} 
            onPress={() => handleRegionPress('legs')}
          >
            <ThemedText style={styles.regionText}>{"Legs"}</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.bodyRegion, styles.leftFoot]} 
            onPress={() => handleRegionPress('feet')}
          >
            <ThemedText style={styles.regionTextSmall}>{"Feet"}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bodyRegion, styles.rightFoot]} 
            onPress={() => handleRegionPress('feet')}
          >
            <ThemedText style={styles.regionTextSmall}>{"Feet"}</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>{"Back to Home"}</ThemedText>
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
    minHeight: screenHeight * 0.9,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  diagramContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 30,
    paddingHorizontal: 20,
  },
  bodyDiagram: {
    position: 'relative',
    backgroundColor: 'rgba(240, 240, 240, 0.1)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  bodyRegion: {
    position: 'absolute',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#005BBB',
    minHeight: 44,
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  regionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  regionTextSmall: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  head: {
    top: '5%',
    left: '35%',
    width: '30%',
    height: '12%',
    borderRadius: 25,
  },
  thorax: {
    top: '20%',
    left: '30%',
    width: '40%',
    height: '18%',
    borderRadius: 16,
  },
  leftArm: {
    top: '22%',
    left: '10%',
    width: '15%',
    height: '20%',
    borderRadius: 18,
  },
  rightArm: {
    top: '22%',
    right: '10%',
    width: '15%',
    height: '20%',
    borderRadius: 18,
  },
  leftHand: {
    top: '42%',
    left: '8%',
    width: '12%',
    height: '8%',
    borderRadius: 14,
  },
  rightHand: {
    top: '42%',
    right: '8%',
    width: '12%',
    height: '8%',
    borderRadius: 14,
  },
  abdomen: {
    top: '40%',
    left: '32%',
    width: '36%',
    height: '15%',
    borderRadius: 14,
  },
  pelvis: {
    top: '57%',
    left: '35%',
    width: '30%',
    height: '12%',
    borderRadius: 14,
  },
  leftLeg: {
    top: '70%',
    left: '28%',
    width: '18%',
    height: '25%',
    borderRadius: 16,
  },
  rightLeg: {
    top: '70%',
    right: '28%',
    width: '18%',
    height: '25%',
    borderRadius: 16,
  },
  leftFoot: {
    top: '93%',
    left: '26%',
    width: '15%',
    height: '6%',
    borderRadius: 12,
  },
  rightFoot: {
    top: '93%',
    right: '26%',
    width: '15%',
    height: '6%',
    borderRadius: 12,
  },
  backButton: {
    backgroundColor: '#8E8E93',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    minHeight: 48,
    minWidth: '60%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});
*/

export default function BodyDiagramScreen() {
  return null;
}