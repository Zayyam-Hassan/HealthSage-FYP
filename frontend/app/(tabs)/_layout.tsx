import { icons } from "@/constants/icons";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authService, type UserRole } from '@/services/auth';

interface TabIconProps {
  focused: boolean;
  icon: any;
}

const TabIcon = ({ focused, icon }: TabIconProps) => {
  return (
    <View className="items-center justify-center" style={{ width: '100%', height: '100%' }}>
      {focused ? (
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center shadow-md">
          <Image source={icon} tintColor="#FFFFFF" className="w-6 h-6" style={{ width: 24, height: 24 }} />
        </View>
      ) : (
        <View className="items-center justify-center">
          <Image source={icon} tintColor="#9CA3AF" className="w-6 h-6" style={{ width: 24, height: 24 }} />
        </View>
      )}
    </View>
  );
};

const TabsLayout = () => {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    authService.getCurrentUser().then((user) => setRole(user?.role ?? null));
  }, []);
  
  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 0,
          flex: 1,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderRadius: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60 + Math.max(insets.bottom, 0),
          overflow: 'hidden',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingHorizontal: 8,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.home} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: role === 'doctor' ? "Hub" : "Care",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.search} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: role === 'doctor' ? "Records" : "Records",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.save} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={icons.person} />,
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
