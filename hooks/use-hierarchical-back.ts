import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useRouter } from 'expo-router';

type ParentRoute = '/' | '/supplements' | '/cognitive-tests' | '/settings' | '/my-schedules';

const ROUTE_HIERARCHY: Record<string, ParentRoute> = {
  'add-supplement': '/supplements',
  'edit-supplement': '/supplements',
  'log-supplement': '/supplements',
  'supplements': '/',
  'cognitive-tests': '/',
  'tests/reflexes': '/cognitive-tests',
  'tests/memory': '/cognitive-tests',
  'tests/connections': '/cognitive-tests',
  'tests/rock-dodger': '/cognitive-tests',
  'tests/pattern-matcher': '/cognitive-tests',
  'tests/tile-puzzle': '/cognitive-tests',
  'tests/n-back': '/cognitive-tests',
  'tests/all-nine': '/cognitive-tests',
  'export': '/',
  'help': '/',
  'insights': '/',
  'my-schedules': '/',
  'supplement-reminders': '/my-schedules',
  'cognitive-test-reminders': '/my-schedules',
  'settings': '/',
  'database-debug': '/settings',
  'invariant-test': '/settings',
};

export function useHierarchicalBack(currentRoute: string) {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const parentRoute = ROUTE_HIERARCHY[currentRoute];

    const onBackPress = () => {
      if (parentRoute) {
        router.replace(parentRoute);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => subscription.remove();
  }, [currentRoute, router]);
}
