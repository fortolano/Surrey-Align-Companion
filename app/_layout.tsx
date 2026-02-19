import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerTintColor: Colors.brand.primary,
        headerStyle: { backgroundColor: Colors.light.background },
        headerTitleStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 17,
          color: Colors.brand.black,
        },
        contentStyle: { backgroundColor: Colors.light.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{
          title: "Profile",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="callings"
        options={{ title: "Callings & Releases" }}
      />
      <Stack.Screen
        name="high-council-agenda"
        options={{ title: "High Council Agenda" }}
      />
      <Stack.Screen
        name="stake-council-agenda"
        options={{ title: "Stake Council Agenda" }}
      />
      <Stack.Screen
        name="assignments"
        options={{ title: "My Assignments" }}
      />
      <Stack.Screen
        name="align-pulse"
        options={{ title: "ALIGN Pulse" }}
      />
      <Stack.Screen
        name="align-info"
        options={{ title: "ALIGN" }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="about-app"
        options={{ title: "About this App" }}
      />
      <Stack.Screen
        name="terms"
        options={{ title: "Terms of Service" }}
      />
      <Stack.Screen
        name="goals"
        options={{ title: "Goals" }}
      />
      <Stack.Screen
        name="goal-detail"
        options={{ title: "Goal Detail" }}
      />
      <Stack.Screen
        name="calling-create"
        options={{ title: "New Calling Request" }}
      />
      <Stack.Screen
        name="calling-detail"
        options={{ title: "Calling Request" }}
      />
      <Stack.Screen
        name="sunday-business"
        options={{ title: "Stake Business" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
