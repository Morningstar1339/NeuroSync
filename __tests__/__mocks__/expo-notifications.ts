export const getPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
export const requestPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
export const setNotificationHandler = jest.fn();
export const scheduleNotificationAsync = jest.fn(async () => 'mock-notification-id');
export const cancelScheduledNotificationAsync = jest.fn(async () => {});
export const cancelAllScheduledNotificationsAsync = jest.fn(async () => {});

export const SchedulableTriggerInputTypes = {
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
};
