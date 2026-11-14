import { Stack } from 'expo-router';
import { colors } from '@qinggairugu/design-tokens';

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
