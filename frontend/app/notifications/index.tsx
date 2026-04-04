import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AppDialog from '@/components/AppDialog';
import Card from '@/components/Card';
import Header from '@/components/Header';
import { colors } from '@/constants/colors';
import {
  notificationsService,
  type AppNotificationItem,
} from '@/services/notifications';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { useFocusedPolling } from '@/src/shared/hooks/useFocusedPolling';
import { useAppDialog } from '@/src/shared/hooks/useAppDialog';
import {
  emitNotificationStateChanged,
  subscribeNotificationState,
} from '@/src/shared/services/notificationEvents';

const NOTIFICATION_REFRESH_MS = 12_000;

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
  const { dialog, hideDialog } = useAppDialog();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [items, setItems] = useState<AppNotificationItem[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLastError(null);
      }
      const response = await notificationsService.list({ page: 1, limit: 50 });
      setItems(response.items);
      setLastError(null);
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Unable to load notifications';
      setLastError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    return subscribeNotificationState(() => {
      void loadNotifications(true);
    });
  }, [loadNotifications]);

  useFocusEffect(
    React.useCallback(() => {
      void loadNotifications(true);
    }, [loadNotifications]),
  );

  useFocusedPolling(() => loadNotifications(true), NOTIFICATION_REFRESH_MS, !loading);

  const onPressNotification = useCallback(async (item: AppNotificationItem) => {
    try {
      if (!item.read) {
        await notificationsService.markRead(item.id);
      }
      emitNotificationStateChanged();
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Unable to mark notification as read';
      setLastError(message);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      setMarkingAllRead(true);
      await notificationsService.markAllRead();
      await loadNotifications(true);
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: string }).message)
          : 'Unable to mark notifications as read';
      setLastError(message);
    } finally {
      setMarkingAllRead(false);
    }
  }, [loadNotifications]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header variant="coral" title="Notifications" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  const allRead = items.length === 0 || items.every((item) => item.read);

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <AppDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
        onClose={hideDialog}
      />
      <Header variant="coral" title="Notifications" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadNotifications(true);
            }}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
          />
        }
      >
        <View className="px-6 pt-8">
          <Card className="border-border/80 shadow-sm p-6 mb-6">
            <Text className="text-base text-text-secondary mb-4 leading-6">
              Real events appear here as they happen: patient requests, appointment changes, shared reports, and account alerts.
            </Text>
            <Card
              onPress={allRead || markingAllRead ? undefined : () => void markAllRead()}
              className={`rounded-2xl py-4 items-center justify-center min-h-[52px] ${
                allRead || markingAllRead ? 'bg-primary/40' : 'bg-primary'
              }`}
            >
              {markingAllRead ? (
                <ActivityIndicator color={colors.primary.contrast} />
              ) : (
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.primary.contrast }}
                >
                  Mark all as read
                </Text>
              )}
            </Card>
            {lastError ? (
              <Text className="text-sm text-error mt-4 leading-5">{lastError}</Text>
            ) : null}
          </Card>

          <Text className="text-lg font-semibold text-text mb-3 px-1 tracking-tight">
            Recent activity
          </Text>
          {items.length === 0 ? (
            <Card className="py-10 items-center border-border/80 bg-bg-card">
              <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center mb-4 border border-primary/10">
                <Ionicons name="notifications-outline" size={28} color={colors.primary.main} />
              </View>
              <Text className="text-base font-semibold text-text mb-1">Nothing yet</Text>
              <Text className="text-sm text-text-secondary text-center px-4 leading-5">
                New patient requests, appointment updates, and report alerts will show up here.
              </Text>
            </Card>
          ) : (
            items.map((item) => (
              <Card
                key={`${item.id}-${item.createdAt}`}
                onPress={() => void onPressNotification(item)}
                className={`mb-3 border-border/80 ${
                  item.read ? 'bg-bg-card' : 'bg-primary border-primary/60'
                }`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text
                      className={`text-base font-semibold mb-1 ${
                        item.read ? 'text-text-secondary' : 'text-white'
                      }`}
                    >
                      {item.title}
                    </Text>
                    <Text
                      className={`text-sm leading-5 mb-2 ${
                        item.read ? 'text-text-secondary' : 'text-primary-contrast'
                      }`}
                    >
                      {item.message}
                    </Text>
                    <Text
                      className={`text-xs ${
                        item.read ? 'text-text-tertiary' : 'text-white/80'
                      }`}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </View>
                  {!item.read ? (
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
