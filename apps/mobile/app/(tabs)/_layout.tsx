import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@pengtou/design-tokens';
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 78,
          paddingTop: 10,
        },
      }}
    >
      {[
        ['index', '首页', '◉'],
        ['records', '我的活动', '▤'],
        ['people', '人', '◎'],
        ['me', '我的', '◌'],
      ].map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name!}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 24 }}>{icon}</Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
