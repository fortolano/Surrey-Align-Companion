import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Animated, { FadeOut } from "react-native-reanimated";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/lib/auth-context";
import { setupPWA } from "@/lib/pwa-setup";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();
setupPWA();

// On web (especially iOS standalone PWA mode), GestureHandlerRootView installs
// touch event interceptors that block focus on native <input> elements. Use a
// plain View on web — gesture handler features aren't needed for web.
const RootWrapper = Platform.OS === 'web'
  ? ({ children, style }: { children: React.ReactNode; style?: any }) => <View style={style}>{children}</View>
  : GestureHandlerRootView;

function BrandedSplash() {
  return (
    <View style={splashStyles.container}>
      <Image
        source={require('../assets/images/surreyalign-compass-color.jpg')}
        style={splashStyles.logo}
        resizeMode="contain"
      />
      <Text style={splashStyles.title}>SurreyALIGN</Text>
      <Text style={splashStyles.subtitle}>Leadership Companion</Text>
    </View>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
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
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      // Keep branded splash visible briefly for a polished transition
      const timer = setTimeout(() => setShowSplash(false), 600);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <BrandedSplash />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RootWrapper style={{ flex: 1 }}>
          <KeyboardProvider>
            <AuthProvider>
              <RootLayoutNav />
            </AuthProvider>
          </KeyboardProvider>
          {showSplash && (
            <Animated.View
              exiting={FadeOut.duration(300)}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <BrandedSplash />
            </Animated.View>
          )}
        </RootWrapper>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#016183',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 6,
  },
});
