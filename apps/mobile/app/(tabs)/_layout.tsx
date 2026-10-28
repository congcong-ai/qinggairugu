/* eslint-disable @typescript-eslint/no-require-imports -- Metro 本地图片需要静态 require。 */
import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { colors } from '@pengtou/design-tokens';
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 12, marginBottom: 2 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          minHeight: 64,
        },
      }}
    >
      {[
        ['index', '记录', require('../../assets/tabs/home-idle.png')],
        ['records', '我的活动', require('../../assets/tabs/records-idle.png')],
        ['people', '见过的人', require('../../assets/tabs/people-idle.png')],
        ['me', '我的', require('../../assets/tabs/me-idle.png')],
      ].map(([name, title, icon]) => (
        <Tabs.Screen
          key={name}
          name={name!}
          options={{
            title,
            tabBarIcon: ({ color }) => (
              <Image
                source={icon}
                style={{ width: 25, height: 25, tintColor: color }}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
