import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSleepDetection } from '@/hooks/use-sleep-detection';

interface SleepSettings {
  bedtimeHour: number; // 1-12
  bedtimeMinute: number; // 0, 5, 10, 15, etc.
  bedtimeAmPm: 'AM' | 'PM';
}

const SETTINGS_KEY = 'sleep_settings';

const defaultSettings: SleepSettings = {
  bedtimeHour: 10,
  bedtimeMinute: 0,
  bedtimeAmPm: 'PM',
};

export const SleepTracker: React.FC = () => {
  const [settings, setSettings] = useState<SleepSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Error loading sleep settings:', error);
    }
  };

  // Initialize sleep detection with current settings
  const { isTracking } = useSleepDetection(settings);

  // This component doesn't render anything visible
  return null;
};