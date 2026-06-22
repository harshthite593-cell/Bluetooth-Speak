import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FirebaseProvider, useFirebase } from "@/contexts/FirebaseContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { profileSeen, loading } = useAuth();
  const { firebaseLoading, role, roleLoading } = useFirebase();

  useEffect(() => {
    if (loading || firebaseLoading || roleLoading) return;

    if (!role) {
      router.replace("/role-select");
      return;
    }

    if (role === "guardian") {
      router.replace("/guardian");
      return;
    }

    if (!profileSeen) {
      router.replace("/profile-setup");
    }
  }, [profileSeen, loading, firebaseLoading, role, roleLoading]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="role-select" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="guardian" options={{ headerShown: false }} />
      <Stack.Screen name="profile-setup" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="saved-phrases" options={{ headerShown: false }} />
      <Stack.Screen name="analytics" options={{ headerShown: false }} />
      <Stack.Screen name="friends" options={{ headerShown: false }} />
      <Stack.Screen name="typing-test" options={{ headerShown: false }} />
      <Stack.Screen name="emergency" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="emergency-contacts" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <FirebaseProvider>
            <AuthProvider>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AuthProvider>
          </FirebaseProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
