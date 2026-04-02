import './global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Loader from '@/components/Loader';
import { initializeApiConfig } from '@/services/config';
import { AuthProvider } from '@/src/features/auth/context/AuthProvider';
import { initializeLocalNotifications } from '@/src/shared/services/localNotifications';
import { NotificationResponseListener } from '@/src/shared/components/NotificationResponseListener';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await initializeApiConfig().catch(() => undefined);
      await initializeLocalNotifications().catch(() => undefined);
      if (!cancelled) {
        setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {isReady ? (
          <AuthProvider>
            <NotificationResponseListener />
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
          </AuthProvider>
        ) : (
          <Loader fullScreen text="Detecting your backend connection..." />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
