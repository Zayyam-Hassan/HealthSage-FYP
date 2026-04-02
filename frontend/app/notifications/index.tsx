import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { colors } from '@/constants/colors';
import { sendTestNotification } from '@/services/notifications';
import { presentTestNotificationOnDevice } from '@/src/shared/services/localNotifications';
import {
  loadCachedNotifications,
  prependNotification,
  markCachedNotificationRead,
  subscribeInbox,
  type CachedNotificationItem,
} from '@/src/shared/services/notificationInboxStorage';

function formatRelativeTime(iso: string) {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function NotificationsScreen() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CachedNotificationItem[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const reloadFromStorage = useCallback(async () => {
    setItems(await loadCachedNotifications());
  }, []);

  useEffect(() => {
    void reloadFromStorage();
    return subscribeInbox(() => {
      void reloadFromStorage();
    });
  }, [reloadFromStorage]);

  const onPressNotification = useCallback(
    async (id: string) => {
      await markCachedNotificationRead(id);
      await reloadFromStorage();
    },
    [reloadFromStorage],
  );

  const onSendTest = async () => {
    setLoading(true);
    setLastError(null);
    try {
      const item = await sendTestNotification();
      const next = await prependNotification(item);
      setItems(next);
      await presentTestNotificationOnDevice({
        title: item.title,
        body: item.message,
        notificationId: item.id,
      });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Request failed';
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header variant="coral" title="Notifications" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-6 pt-8">
          <Card className="border-border/80 shadow-sm p-6 mb-6">
            <Text className="text-base text-text-secondary mb-4 leading-6">
              The server creates a notification record; we save a copy on this device (AsyncStorage)
              and show the same content as a system notification — no remote push required.
            </Text>
            <TouchableOpacity
              onPress={() => void onSendTest()}
              disabled={loading}
              activeOpacity={0.85}
              className="rounded-2xl bg-primary py-4 items-center justify-center min-h-[52px]"
            >
              {loading ? (
                <ActivityIndicator color={colors.primary.contrast} />
              ) : (
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.primary.contrast }}
                >
                  Send test notification
                </Text>
              )}
            </TouchableOpacity>
            {lastError ? (
              <Text className="text-sm text-error mt-4 leading-5">{lastError}</Text>
            ) : null}
          </Card>

          <Text className="text-lg font-semibold text-text mb-3 px-1 tracking-tight">
            On this device
          </Text>
          {items.length === 0 ? (
            <Card className="py-10 items-center border-border/80 bg-bg-card">
              <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center mb-4 border border-primary/10">
                <Ionicons name="notifications-outline" size={28} color={colors.primary.main} />
              </View>
              <Text className="text-base font-semibold text-text mb-1">Nothing cached yet</Text>
              <Text className="text-sm text-text-secondary text-center px-4 leading-5">
                Send a test to store one here and trigger the OS banner.
              </Text>
            </Card>
          ) : (
            items.map((n) => (
              <Card
                key={`${n.id}-${n.createdAt}`}
                onPress={() => void onPressNotification(n.id)}
                className={`mb-3 border-border/80 ${
                  n.read ? 'bg-bg-card' : 'bg-primary border-primary/60'
                }`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text
                      className={`text-base font-semibold mb-1 ${
                        n.read ? 'text-text-secondary' : 'text-white'
                      }`}
                    >
                      {n.title}
                    </Text>
                    <Text
                      className={`text-sm leading-5 mb-2 ${
                        n.read ? 'text-text-secondary' : 'text-primary-contrast'
                      }`}
                    >
                      {n.message}
                    </Text>
                    <Text
                      className={`text-xs ${
                        n.read ? 'text-text-tertiary' : 'text-white/80'
                      }`}
                    >
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                  </View>
                  {!n.read ? (
                    <View className="mt-1 ml-2 w-2 h-2 rounded-full bg-white/85" />
                  ) : null}
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
