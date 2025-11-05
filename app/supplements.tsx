import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getAllSupplements, Supplement, getSupplementExclusions, isExclusionActive } from '@/database/supplements';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter, useFocusEffect } from 'expo-router';

const getContrastingTextColor = (backgroundColor: string): string => {
  // Remove # and convert to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

export default function SupplementsScreen() {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [exclusionStatuses, setExclusionStatuses] = useState<Record<number, {hasTimeExclusion: boolean, hasActiveTimeExclusion: boolean, hasDosageWarning: boolean}>>({});
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const router = useRouter();

  useFocusEffect(
    React.useCallback(() => {
      loadSupplements();
    }, [])
  );

  const loadSupplements = async () => {
    try {
      const data = await getAllSupplements();
      setSupplements(data);
      
      // Load exclusion statuses asynchronously for better performance
      loadExclusionStatuses(data);
    } catch (error) {
      console.error('Failed to load supplements:', error);
    }
  };

  const loadExclusionStatuses = async (supplements: Supplement[]) => {
    try {
      // Use Promise.all for parallel processing instead of sequential loop
      const statusPromises = supplements.map(async (supplement) => {
        const exclusions = await getSupplementExclusions(supplement.id);
        const hasTimeExclusion = exclusions.some(e => e.exclusion_type === 'time_window');
        
        // Check if any time exclusion is currently active
        const exclusionCheck = await isExclusionActive(supplement.id, supplement.default_dosage);
        const hasActiveTimeExclusion = exclusionCheck.active && exclusionCheck.type === 'time_window';
        
        // Check for potential dosage warnings
        const hasDosageWarning = exclusionCheck.active && exclusionCheck.type === 'dosage_limit';
        
        return {
          id: supplement.id,
          status: {
            hasTimeExclusion,
            hasActiveTimeExclusion,
            hasDosageWarning
          }
        };
      });
      
      const results = await Promise.all(statusPromises);
      
      const statuses: Record<number, {hasTimeExclusion: boolean, hasActiveTimeExclusion: boolean, hasDosageWarning: boolean}> = {};
      results.forEach(result => {
        statuses[result.id] = result.status;
      });
      
      setExclusionStatuses(statuses);
    } catch (error) {
      console.error('Failed to load exclusion statuses:', error);
    }
  };

  const handleSupplementPress = (supplement: Supplement) => {
    router.push({
      pathname: '/log-supplement',
      params: {
        id: supplement.id.toString(),
        name: supplement.name,
        default_dosage: supplement.default_dosage.toString(),
        dosage_unit: supplement.dosage_unit,
        icon_id: supplement.icon_id || 'medical',
        color: supplement.color || '#007AFF',
        schedule_enabled: supplement.schedule_enabled.toString(),
        study_enabled: supplement.study_enabled.toString()
      }
    });
  };

  const handleAddSupplement = () => {
    router.push('/add-supplement');
  };

  const handleHomePress = () => {
    router.push('/');
  };

  const handleEditSupplement = (supplement: Supplement, event?: any) => {
    if (event) {
      event.stopPropagation();
    }
    router.push({
      pathname: '/edit-supplement',
      params: {
        id: supplement.id.toString(),
        name: supplement.name,
        default_dosage: supplement.default_dosage.toString(),
        dosage_unit: supplement.dosage_unit,
        icon_id: supplement.icon_id || 'medical',
        color: supplement.color || '#007AFF',
        schedule_enabled: supplement.schedule_enabled.toString(),
        study_enabled: supplement.study_enabled.toString()
      }
    });
  };

  const getClockIconColor = useCallback((supplement: Supplement) => {
    const status = exclusionStatuses[supplement.id];
    
    // Red if time exclusion is currently active
    if (status?.hasActiveTimeExclusion) {
      return '#FF3B30';
    }
    
    // Default scheduling color
    return supplement.schedule_enabled ? '#007AFF' : '#8E8E93';
  }, [exclusionStatuses]);

  const renderSupplement = useCallback(({ item: supplement }: { item: Supplement }) => {
    const itemBackgroundColor = supplement.color || '#007AFF';
    const textColor = getContrastingTextColor(itemBackgroundColor);
    
    return (
      <TouchableOpacity
        style={[styles.supplementButton, { backgroundColor: itemBackgroundColor }]}
        onPress={() => handleSupplementPress(supplement)}
      >
        <View style={styles.supplementContent}>
          <View style={styles.leftSection}>
            <Ionicons
              name={getSupplementIcon(supplement.icon_id) as any}
              size={24}
              color={textColor}
              style={styles.supplementIcon}
            />
            <View style={styles.textSection}>
              <ThemedText type="subtitle" style={[styles.supplementName, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
                {supplement.name}
              </ThemedText>
              <ThemedText style={[styles.dosageText, { color: textColor, opacity: 0.8 }]}>
                {supplement.default_dosage} {supplement.dosage_unit}
              </ThemedText>
            </View>
          </View>

          <View style={styles.rightSection}>
            <Ionicons
              name="time-outline"
              size={20}
              color={getClockIconColor(supplement)}
              style={styles.clockIcon}
            />
            {exclusionStatuses[supplement.id]?.hasDosageWarning && (
              <Ionicons
                name="warning"
                size={18}
                color="#FF9500"
                style={styles.warningIcon}
              />
            )}
            {supplement.study_enabled && (
              <Ionicons
                name="analytics-outline"
                size={16}
                color={textColor}
                style={styles.studyIcon}
              />
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={(event) => handleEditSupplement(supplement, event)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="pencil-outline" size={16} color={textColor} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [exclusionStatuses, getClockIconColor]);

  const renderAddButton = useCallback(() => (
    <TouchableOpacity style={styles.addButton} onPress={handleAddSupplement}>
      <Ionicons name="add" size={32} color={tintColor} />
      <ThemedText style={[styles.addButtonText, { color: tintColor }]}>
        Add Supplement
      </ThemedText>
    </TouchableOpacity>
  ), [tintColor]);

  const keyExtractor = useCallback((item: Supplement) => item.id.toString(), []);

  const listData = useMemo(() => [...supplements], [supplements]);

  const getSupplementIcon = (iconId?: string) => {
    // Default to pill icon if no icon specified
    return iconId || 'medical';
  };

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
        <ThemedText type="title" style={styles.title}>Supplements</ThemedText>
        <View style={styles.headerPlaceholder} />
      </ThemedView>

      <FlatList
        data={listData}
        renderItem={renderSupplement}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={21}
        removeClippedSubviews={true}
        ListFooterComponent={renderAddButton}
        getItemLayout={(data, index) => ({
          length: 80, // Fixed height for each supplement item
          offset: 80 * index,
          index,
        })}
      />
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  supplementButton: {
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 80,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  supplementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  supplementIcon: {
    marginRight: 12,
  },
  textSection: {
    flex: 1,
  },
  supplementName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  dosageText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockIcon: {
    marginRight: 4,
  },
  studyIcon: {
    marginRight: 4,
  },
  warningIcon: {
    marginRight: 4,
  },
  editButton: {
    padding: 4,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    marginTop: 20,
    minHeight: 80,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});