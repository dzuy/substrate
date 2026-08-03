import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.light.background },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="photo" />
        <Stack.Screen name="check-in" />
        <Stack.Screen name="skin-story" />
        <Stack.Screen name="daily-plan" />
      </Stack>
    </>
  );
}
