import { icons } from "@/constants/icons";
import { colors } from "@/constants/colors";
import { Tabs } from "expo-router";
import React from "react";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabIconProps {
  focused: boolean;
  icon: any;
}

const TabIcon = ({ focused, icon }: TabIconProps) => {
  return (
    <View className="items-center justify-center" style={{ width: '100%', height: '100%' }}>
      {focused ? (
        <View
          className="w-11 h-11 bg-primary rounded-2xl items-center justify-center"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <Image
            source={icon}
            tintColor={colors.primary.contrast}
            className="w-6 h-6"
            style={{ width: 22, height: 22 }}
          />
        </View>
      ) : (
        <View className="items-center justify-center w-11 h-11">
          <Image
            source={icon}
            tintColor={colors.text.tertiary}
            className="w-6 h-6"
            style={{ width: 22, height: 22 }}
          />
        </View>
      )}
    </View>
  );
};

const TabsLayout = () => {
  const insets = useSafeAreaInsets();

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
          backgroundColor: colors.background.secondary,
          borderRadius: 0,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 62 + Math.max(insets.bottom, 0),
          overflow: 'hidden',
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
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
        name="saved"
        options={{
          title: "Records",
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
