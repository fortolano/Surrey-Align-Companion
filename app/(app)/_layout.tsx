import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import Colors from '@/constants/colors';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.white} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Back',
        headerTintColor: Colors.brand.primary,
        headerStyle: { backgroundColor: Colors.light.background },
        headerTitleStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 17,
          color: Colors.brand.black,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.light.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Profile',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="high-council-agenda"
        options={{ title: 'High Council Agenda' }}
      />
      <Stack.Screen
        name="stake-council-agenda"
        options={{ title: 'Stake Council Agenda' }}
      />
      <Stack.Screen
        name="assignments"
        options={{ title: 'My Assignments' }}
      />
      <Stack.Screen
        name="align-pulse"
        options={{ title: 'ALIGN Pulse' }}
      />
      <Stack.Screen
        name="align-info"
        options={{ title: 'ALIGN' }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="about-app"
        options={{ title: 'About this App' }}
      />
      <Stack.Screen
        name="terms"
        options={{ title: 'Terms of Service' }}
      />
      <Stack.Screen
        name="goals"
        options={{ title: 'Goals' }}
      />
      <Stack.Screen
        name="goal-detail"
        options={{ title: 'Goal Detail' }}
      />
      <Stack.Screen
        name="calling-create"
        options={{ title: 'New Calling Request' }}
      />
      <Stack.Screen
        name="calling-detail"
        options={{ title: 'Calling Request' }}
      />
      <Stack.Screen
        name="sunday-business"
        options={{ title: 'Stake Business' }}
      />
      <Stack.Screen
        name="sustainings"
        options={{ title: 'Sustainings' }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.primary,
  },
});
