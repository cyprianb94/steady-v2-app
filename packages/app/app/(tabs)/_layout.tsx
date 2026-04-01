import React from 'react';
import { Tabs } from 'expo-router';
import { C } from '../../constants/colours';
import { FONTS } from '../../constants/typography';
import { TabIcon } from '../../components/ui/TabIcon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.clay,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 6,
        },
        tabBarLabelStyle: {
          fontFamily: FONTS.sans,
          fontSize: 10,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="week"
        options={{
          title: 'Week',
          tabBarIcon: ({ focused }) => <TabIcon name="week" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="block"
        options={{
          title: 'Block',
          tabBarIcon: ({ focused }) => <TabIcon name="block" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
