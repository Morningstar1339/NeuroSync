import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { logSleep } from '@/database/sleep';

interface SleepDetectionConfig {
  bedtimeHour: number; // 1-12
  bedtimeMinute: number; // 0, 5, 10, etc.
  bedtimeAmPm: 'AM' | 'PM';
}

interface PhoneUsageEvent {
  timestamp: number;
  duration: number; // seconds of usage
}

export const useSleepDetection = (config: SleepDetectionConfig) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentSleepStart, setCurrentSleepStart] = useState<number | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastActiveTimeRef = useRef<number>(Date.now());
  const usageEventsRef = useRef<PhoneUsageEvent[]>([]);
  
  // Convert 12-hour format to 24-hour format
  const convertTo24Hour = (): number => {
    let hour = config.bedtimeHour;
    if (config.bedtimeAmPm === 'AM' && hour === 12) hour = 0;
    if (config.bedtimeAmPm === 'PM' && hour !== 12) hour += 12;
    return hour;
  };

  const getBedtimeTimestamp = (date: Date): number => {
    const bedtime = new Date(date);
    bedtime.setHours(convertTo24Hour(), config.bedtimeMinute, 0, 0);
    return Math.floor(bedtime.getTime() / 1000);
  };

  // Check if current time is within sleep detection window
  // 30 minutes before bedtime to 7 hours after bedtime
  const isWithinSleepWindow = (timestamp: number): boolean => {
    const date = new Date(timestamp * 1000);
    const bedtime = getBedtimeTimestamp(date);
    const windowStart = bedtime - (30 * 60); // 30 minutes before
    const windowEnd = bedtime + (7 * 60 * 60); // 7 hours after
    
    return timestamp >= windowStart && timestamp <= windowEnd;
  };

  // Check if we should end sleep based on usage patterns
  const shouldEndSleep = (currentTime: number): boolean => {
    if (!currentSleepStart) return false;
    
    const sleepDuration = (currentTime - currentSleepStart) / 3600; // hours
    
    // Only check for wake up between 7-9 hours after bedtime
    if (sleepDuration < 7 || sleepDuration > 9) return false;
    
    // Filter usage events to last 30 minutes
    const thirtyMinAgo = currentTime - (30 * 60);
    const recentUsage = usageEventsRef.current.filter(event => event.timestamp >= thirtyMinAgo);
    
    // End sleep if: 3+ uses in 30 min OR 5+ minutes total usage in 30 min
    const totalUsage = recentUsage.reduce((sum, event) => sum + event.duration, 0);
    
    return recentUsage.length >= 3 || totalUsage >= 300; // 300 seconds = 5 minutes
  };

  const addUsageEvent = (timestamp: number, duration: number) => {
    // Only track usage events that are longer than 1 minute (to ignore incidental interruptions)
    if (duration >= 60) {
      usageEventsRef.current.push({ timestamp, duration });
      
      // Keep only last 24 hours of events
      const oneDayAgo = timestamp - (24 * 60 * 60);
      usageEventsRef.current = usageEventsRef.current.filter(event => event.timestamp >= oneDayAgo);
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (appStateRef.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App going to background
      const usageDuration = Math.floor((Date.now() - lastActiveTimeRef.current) / 1000);
      addUsageEvent(currentTime, usageDuration);
      
      // Check if we should start sleep detection
      if (isWithinSleepWindow(currentTime) && !isTracking) {
        // Wait 10 minutes after phone use ends to presume sleep began
        setTimeout(async () => {
          const checkTime = Math.floor(Date.now() / 1000);
          // Only start sleep if phone is still inactive and at least 30 minutes have passed
          if (appStateRef.current.match(/inactive|background/) && 
              (checkTime - currentTime) >= (30 * 60)) {
            setCurrentSleepStart(checkTime - (10 * 60)); // Sleep started 10 min after last use
            setIsTracking(true);
            console.log('Sleep detection: Sleep presumed to have begun');
          }
        }, 10 * 60 * 1000); // 10 minutes
      }
    } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      // App coming to foreground
      lastActiveTimeRef.current = Date.now();
      
      if (isTracking && currentSleepStart) {
        // Check if we should end sleep
        if (shouldEndSleep(currentTime)) {
          try {
            const sleepDurationHours = (currentTime - currentSleepStart) / 3600;
            
            // Only log if sleep was at least 4 hours (reasonable minimum)
            if (sleepDurationHours >= 4) {
              await logSleep(currentSleepStart, currentTime, false);
              console.log(`Sleep logged: ${sleepDurationHours.toFixed(1)} hours`);
            }
          } catch (error) {
            console.error('Error logging sleep:', error);
          }
          
          setCurrentSleepStart(null);
          setIsTracking(false);
          usageEventsRef.current = []; // Reset usage tracking
        } else {
          // Track this as a brief interruption, don't end sleep yet
          console.log('Brief sleep interruption detected, continuing sleep tracking');
        }
      }
    }
    
    appStateRef.current = nextAppState;
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    lastActiveTimeRef.current = Date.now();
    
    return () => {
      subscription?.remove();
    };
  }, [config.bedtimeHour, config.bedtimeMinute, config.bedtimeAmPm]);

  return {
    isTracking,
    currentSleepStart
  };
};