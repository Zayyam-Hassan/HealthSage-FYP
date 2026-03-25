import React from 'react';
import { View, ScrollView, Text, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';

export default function SettingsScreen() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(true);

  const settingsSections = [
      {
        title: 'Account',
        items: [
          { id: '1', title: 'Edit Profile', icon: '👤', route: '/settings/edit-profile' },
          { id: '2', title: 'Change Password', icon: '🔑', route: '/settings/change-password' },
          { id: '3', title: 'Privacy Settings', icon: '🔒', route: '/settings/privacy' },
        ],
      },
    {
      title: 'Notifications',
      items: [
        {
          id: '4',
          title: 'Push Notifications',
          icon: '🔔',
          toggle: true,
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        {
          id: '5',
          title: 'Email Notifications',
          icon: '📧',
          toggle: true,
          value: emailNotifications,
          onToggle: setEmailNotifications,
        },
      ],
    },
      {
        title: 'Support',
        items: [
          { id: '6', title: 'Help & Support', icon: '❓', route: '/help-support' },
          { id: '7', title: 'About', icon: 'ℹ️', route: '/settings/about' },
        ],
      },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Header title="Settings" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View className="px-6 py-4">
          <Card>
            <View className="flex-row items-center">
              <Avatar name="John Doe" size="lg" className="mr-4" />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-text mb-1">
                  John Doe
                </Text>
                <Text className="text-sm text-text-secondary">
                  john.doe@example.com
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <View key={section.title} className="px-6 mb-6">
            <Text className="text-sm font-semibold text-text-secondary mb-3 uppercase">
              {section.title}
            </Text>
            {section.items.map((item) => {
              const hasRoute = 'route' in item;
              const hasToggle = 'toggle' in item;
              
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => hasRoute && item.route && router.push(item.route as any)}
                  disabled={hasToggle}
                >
                  <Card className="mb-3 border border-border/50">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mr-4">
                          <Text className="text-xl">{item.icon}</Text>
                        </View>
                        <Text className="text-base font-semibold text-text flex-1">
                          {item.title}
                        </Text>
                      </View>
                      {hasToggle && item.toggle ? (
                        <Switch
                          value={item.value}
                          onValueChange={item.onToggle}
                          trackColor={{ false: '#D1D5DB', true: '#faad9e' }}
                          thumbColor={item.value ? '#FFFFFF' : '#F3F4F6'}
                        />
                      ) : (
                        <Text className="text-text-tertiary text-xl">›</Text>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

