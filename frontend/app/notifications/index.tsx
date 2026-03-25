import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Badge from '@/components/Badge';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'appointment' | 'report' | 'reminder' | 'general';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'Appointment Reminder',
      message: 'Your appointment with Dr. Sarah Johnson is scheduled for tomorrow at 10:00 AM',
      time: '2 hours ago',
      read: false,
      type: 'appointment',
    },
    {
      id: '2',
      title: 'New Report Available',
      message: 'Your health assessment report is now available for review',
      time: '5 hours ago',
      read: false,
      type: 'report',
    },
    {
      id: '3',
      title: 'Appointment Confirmed',
      message: 'Your appointment with Dr. Michael Chen has been confirmed for March 15, 2024',
      time: '1 day ago',
      read: true,
      type: 'appointment',
    },
    {
      id: '4',
      title: 'Health Tips',
      message: 'Remember to stay hydrated and get at least 8 hours of sleep',
      time: '2 days ago',
      read: true,
      type: 'general',
    },
    {
      id: '5',
      title: 'Medication Reminder',
      message: 'Don\'t forget to take your prescribed medication',
      time: '3 days ago',
      read: true,
      type: 'reminder',
    },
  ]);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment':
        return '📅';
      case 'report':
        return '📄';
      case 'reminder':
        return '⏰';
      default:
        return '🔔';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Header title="Notifications" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Notification Settings */}
        <View className="px-6 pt-4 pb-2">
          <Card>
            <Text className="text-lg font-semibold text-text mb-4">
              Notification Settings
            </Text>
            
            <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-border">
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
                onValueChange={setPushEnabled}
                trackColor={{ false: '#E5E7EB', true: '#4A90E2' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-border">
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
                trackColor={{ false: '#E5E7EB', true: '#4A90E2' }}
                thumbColor="#FFFFFF"
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
                trackColor={{ false: '#E5E7EB', true: '#4A90E2' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>
        </View>

        {/* Notifications List Header */}
        <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-text">
            Recent Notifications
          </Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text className="text-sm text-primary font-medium">
                Mark all as read
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications List */}
        <View className="px-6 pt-2">
          {notifications.length === 0 ? (
            <Card className="py-8 items-center">
              <Text className="text-4xl mb-3">🔔</Text>
              <Text className="text-base text-text-secondary text-center">
                No notifications yet
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
                  className={`mb-3 ${
                    !notification.read ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                >
                  <View className="flex-row items-start">
                    <Text className="text-2xl mr-3 mt-1">
                      {getNotificationIcon(notification.type)}
                    </Text>
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
                        {notification.time}
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

