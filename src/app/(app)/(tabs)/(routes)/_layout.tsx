import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stack, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { requestLeaveGuard } from '@/lib/navigation-leave-guard';
import { navigateToReturnTarget } from '@/lib/navigation-return-target';
import { webShadowRgba } from '@/lib/web-styles';

function BackButton({ tintColor }: { tintColor?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { returnTo } = useGlobalSearchParams<{ returnTo?: string | string[] }>();

  return (
    <Pressable
      onPress={() => {
        const continueNavigation = () => {
          navigateToReturnTarget(router, pathname, returnTo);
        };

        const intercepted = requestLeaveGuard({
          reason: 'back',
          continueNavigation,
        });

        if (!intercepted) {
          continueNavigation();
        }
      }}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      hitSlop={8}
      testID="route-back-button"
    >
      <Ionicons name="chevron-back" size={20} color={tintColor || Colors.brand.white} />
    </Pressable>
  );
}

export default function TabRoutesLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackVisible: false,
        headerLeft: ({ tintColor }) => <BackButton tintColor={tintColor} />,
        headerBackTitle: 'Back',
        headerTintColor: Colors.brand.white,
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: Colors.brand.primary },
        headerBackground: () => <View style={styles.headerBackground} />,
        headerTitleStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 17,
          color: Colors.brand.white,
        },
        headerLeftContainerStyle: {
          paddingLeft: 14,
        },
        headerRightContainerStyle: {
          paddingRight: 14,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.light.background },
        animation: 'slide_from_right',
      }}
    >
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
        name="intelligence-inbox"
        options={{ title: 'Leadership Intelligence' }}
      />
      <Stack.Screen
        name="agenda-entity"
        options={{ title: 'Agenda' }}
      />
      <Stack.Screen
        name="agenda-submit"
        options={{ title: 'Submit Topic' }}
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
        name="bishop-home"
        options={{ title: 'Bishop Home' }}
      />
      <Stack.Screen
        name="carry-forward"
        options={{ title: 'Carry-Forward' }}
      />
      <Stack.Screen
        name="carry-forward-detail"
        options={{ title: 'Carry-Forward Detail' }}
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
        options={{
          title: 'Goal Detail',
        }}
      />
      <Stack.Screen
        name="callings"
        options={{ title: 'Callings & Releases' }}
      />
      <Stack.Screen
        name="calling-create"
        options={{
          title: 'New Calling Request',
        }}
      />
      <Stack.Screen
        name="calling-detail"
        options={{
          title: 'Calling Request',
        }}
      />
      <Stack.Screen
        name="sunday-business"
        options={{
          title: 'Stake Business',
        }}
      />
      <Stack.Screen
        name="sustainings"
        options={{ title: 'Sustainings' }}
      />
      <Stack.Screen
        name="speaking-assignments"
        options={{ title: 'Speaking Assignments' }}
      />
      <Stack.Screen
        name="sacrament-overview"
        options={{ title: 'Sacrament Overview' }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerBackground: {
    flex: 1,
    backgroundColor: Colors.brand.primary,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...webShadowRgba('rgba(1, 97, 131, 0.18)', 0, 8, 18),
    elevation: 6,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  backButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
});
