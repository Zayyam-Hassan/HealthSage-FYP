import React, { useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Header from '@/components/Header';
import Card from '@/components/Card';
import Avatar from '@/components/Avatar';
import { CenteredScreenLoader } from '@/src/shared/components/CenteredScreenLoader';
import { colors } from '@/constants/colors';
import { useAuth } from '@/src/features/auth/hooks/useAuth';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type RouteItem = {
  id: string;
  title: string;
  icon: IconName;
  route: string;
};

type ToggleItem = {
  id: string;
  title: string;
  icon: IconName;
  toggle: true;
  value: boolean;
  onToggle: (v: boolean) => void;
};

type Section =
  | { title: string; items: RouteItem[] }
  | { title: string; items: ToggleItem[] };

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isLoading: loading } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const settingsSections: Section[] = [
    {
      title: 'Account',
      items: [
        { id: '1', title: 'Edit profile', icon: 'person-outline', route: '/settings/edit-profile' },
        { id: '2', title: 'Change password', icon: 'lock-closed-outline', route: '/settings/change-password' },
        { id: '3', title: 'Privacy', icon: 'shield-checkmark-outline', route: '/settings/privacy' },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: '4',
          title: 'Push notifications',
          icon: 'notifications-outline',
          toggle: true,
          value: notificationsEnabled,
          onToggle: setNotificationsEnabled,
        },
        {
          id: '5',
          title: 'Email notifications',
          icon: 'mail-outline',
          toggle: true,
          value: emailNotifications,
          onToggle: setEmailNotifications,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        { id: '6', title: 'Help & support', icon: 'help-circle-outline', route: '/help-support' },
        { id: '7', title: 'About', icon: 'information-circle-outline', route: '/settings/about' },
      ],
    },
  ];

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
        <Header title="Settings" showBack />
        <CenteredScreenLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-secondary" edges={['top']}>
      <Header title="Settings" showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="px-6 py-6">
          <Card className="border-border/80 shadow-sm">
            <View className="flex-row items-center">
              <Avatar name={user?.display_name || 'User'} size="lg" className="mr-4" />
              <View className="flex-1 min-w-0">
                <Text
                  className="text-lg font-semibold text-text mb-1 tracking-tight"
                  numberOfLines={1}
                >
                  {user?.display_name || 'Signed-in user'}
                </Text>
                <Text className="text-sm text-text-secondary" numberOfLines={2}>
                  {user?.email || '—'}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {settingsSections.map((section) => (
          <View key={section.title} className="px-6 mb-6">
            <Text className="text-[11px] font-semibold text-text-secondary mb-3 uppercase tracking-[0.12em]">
              {section.title}
            </Text>
            <View className="rounded-2xl border border-border/90 bg-bg-card overflow-hidden shadow-sm">
              {section.items.map((item, index) => {
                const hasToggle = 'toggle' in item && item.toggle;
                const hasRoute = 'route' in item;
                const isLast = index === section.items.length - 1;

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => hasRoute && router.push(item.route as any)}
                    disabled={!!hasToggle}
                    activeOpacity={hasToggle ? 1 : 0.75}
                    className={`flex-row items-center justify-between px-4 py-3.5 ${
                      !isLast ? 'border-b border-border/80' : ''
                    }`}
                    accessibilityRole={hasToggle ? undefined : 'button'}
                  >
                    <View className="flex-row items-center flex-1 min-w-0 pr-3">
                      <View className="w-10 h-10 rounded-[14px] bg-primary/10 items-center justify-center mr-3 border border-primary/10">
                        <Ionicons name={item.icon} size={20} color={colors.primary.main} />
                      </View>
                      <Text className="text-base font-medium text-text flex-1">{item.title}</Text>
                    </View>
                    {hasToggle ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: colors.border.medium, true: colors.primary.light }}
                        thumbColor={item.value ? colors.primary.contrast : colors.background.tertiary}
                      />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
