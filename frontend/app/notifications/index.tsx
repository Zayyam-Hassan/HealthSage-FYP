import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { colors } from '@/constants/colors';
import { useAuth } from '@/src/features/auth/hooks/useAuth';
import {
  addAppNotification,
  getPushEnabled,
  getStoredNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setPushEnabled,
  type AppNotificationItem,
} from '@/src/shared/services/notificationService';

type IonIcon = React.ComponentProps<typeof Ionicons>['name'];

export default function NotificationsScreen() {
  useAuth();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [pushEnabled, setPushEnabledState] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const reloadNotifications = async () => {
    setNotifications(await getStoredNotifications());
  };

  useEffect(() => {
    (async () => {
      setPushEnabledState(await getPushEnabled());
      await reloadNotifications();
    })();
  }, []);

  const formatRelativeTime = (createdAt: string) => {
    const deltaMs = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(deltaMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  };

  const markAsRead = async (id: string) => {
    await markNotificationRead(id);
    await reloadNotifications();
  };

  const markAllAsRead = async () => {
    await markAllNotificationsRead();
    await reloadNotifications();
  };

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const getNotificationIconName = (type: string): IonIcon => {
    switch (type) {
      case 'appointment':
        return 'calendar-outline';
      case 'report':
        return 'document-text-outline';
      case 'reminder':
        return 'alarm-outline';
      default:
        return 'notifications-outline';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header
        variant="coral"
        title="Notifications"
        showBack
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Notification Settings */}
        <View className="px-6 pt-6 pb-2">
          <Card className="border-border/80 shadow-sm">
            <Text className="text-lg font-semibold text-text mb-4 tracking-tight">
              Notification settings
            </Text>

            <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-border/80">
              <View className="flex-1">
                <Text className="text-base font-medium text-text mb-1">
                  Push Notifications
                </Text>
                <Text className="text-sm text-text-secondary">
                  Receive notifications on your device
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={(v) => {
                  setPushEnabledState(v);
                  setPushEnabled(v).catch(() => undefined);
                }}
                trackColor={{ false: colors.border.light, true: colors.primary.light }}
                thumbColor={colors.background.primary}
              />
            </View>

            <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-border/80">
              <View className="flex-1">
                <Text className="text-base font-medium text-text mb-1">
                  Email Notifications
                </Text>
                <Text className="text-sm text-text-secondary">
                  Receive notifications via email
                </Text>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: colors.border.light, true: colors.primary.light }}
                thumbColor={colors.background.primary}
              />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-medium text-text mb-1">
                  SMS Notifications
                </Text>
                <Text className="text-sm text-text-secondary">
                  Receive notifications via SMS
                </Text>
              </View>
              <Switch
                value={smsEnabled}
                onValueChange={setSmsEnabled}
                trackColor={{ false: colors.border.light, true: colors.primary.light }}
                thumbColor={colors.background.primary}
              />
            </View>
          </Card>
        </View>

        {/* Notifications List Header */}
        <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-text tracking-tight">
            Recent notifications
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={() => void markAllAsRead()}>
              <Text className="text-sm text-primary font-medium">
                Mark all as read
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              void addAppNotification({
                title: 'HealthSage test notification',
                message: 'Push notifications are enabled and working on this device.',
                type: 'general',
                triggerPhoneNotification: true,
              }).then(reloadNotifications);
            }}
          >
            <Text className="text-sm text-primary font-medium">Send test</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications List */}
        <View className="px-6 pt-2">
          {notifications.length === 0 ? (
            <Card className="py-10 items-center border-border/80 bg-bg-card">
              <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center mb-4 border border-primary/10">
                <Ionicons name="notifications-outline" size={28} color={colors.primary.main} />
              </View>
              <Text className="text-base font-semibold text-text mb-1">No notifications yet</Text>
              <Text className="text-sm text-text-secondary text-center px-4 leading-5">
                Alerts for appointments and reports will appear here.
              </Text>
            </Card>
          ) : (
            notifications.map((notification, index) => (
              <TouchableOpacity
                key={notification.id}
                onPress={() => markAsRead(notification.id)}
                activeOpacity={0.7}
              >
                <Card
                  className={`mb-3 border-border/80 ${
                    !notification.read ? 'bg-primary/5 border-primary/15' : ''
                  }`}
                >
                  <View className="flex-row items-start">
                    <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center mr-3 border border-primary/10">
                      <Ionicons
                        name={getNotificationIconName(notification.type)}
                        size={20}
                        color={colors.primary.main}
                      />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-start justify-between mb-1">
                        <Text
                          className={`text-base font-semibold flex-1 ${
                            !notification.read ? 'text-text' : 'text-text-secondary'
                          }`}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && (
                          <View className="w-2 h-2 bg-primary rounded-full ml-2 mt-2" />
                        )}
                      </View>
                      <Text className="text-sm text-text-secondary mb-2 leading-5">
                        {notification.message}
                      </Text>
                      <Text className="text-xs text-text-tertiary">
                        {formatRelativeTime(notification.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

