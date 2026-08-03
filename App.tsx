import './global.css';

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import {
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { AuthProvider, useAuth } from './src/navigation/AuthContext';
import { MainStackNavigator } from './src/navigation/RootNavigator';
import SplashAnimationScreen from './src/screens/auth/SplashAnimationScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import FaceRegistrationScreen from './src/screens/auth/FaceRegistrationScreen';
import { AppText } from './src/components/ui/AppText';
import { COLORS } from './src/constants/theme';

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

// Transparent wrapper that resets the inactivity timer on every touch.
// onTouchStart fires before responder negotiation so it never blocks children.
function ActivityWrapper({
  onActivity,
  children,
}: {
  onActivity: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1 }} onTouchStart={onActivity}>
      {children}
    </View>
  );
}

function AppContent() {
  const { authState, logout } = useAuth();

  // ── Inactivity timer ───────────────────────────────────────────────────────
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef(logout);
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => logoutRef.current(), INACTIVITY_MS);
  }, []);

  useEffect(() => {
    if (authState.isLoggedIn) {
      resetTimer();                          // start counting on login
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);      // cancel on logout
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authState.isLoggedIn, resetTimer]);

  // ── Routing ────────────────────────────────────────────────────────────────
  if (authState.booting) {
    return <View style={{ flex: 1, backgroundColor: COLORS.navy }} />;
  }

  if (!authState.isLoggedIn) {
    return <LoginScreen />;
  }

  // Face registration only required for students
  if (authState.user?.role !== 'lecturer' && !authState.hasRegisteredFace) {
    return (
      <ActivityWrapper onActivity={resetTimer}>
        <FaceRegistrationScreen />
      </ActivityWrapper>
    );
  }

  // GestureHandlerRootView wraps only the navigation stack — not LoginScreen
  // to prevent gesture handler from intercepting keyboard events on Android
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ActivityWrapper onActivity={resetTimer}>
        <NavigationContainer>
          <MainStackNavigator />
        </NavigationContainer>
      </ActivityWrapper>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [splashDone, setSplashDone] = React.useState(false);

  if (!fontsLoaded) {
    return (
      <View style={s.splash}>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!splashDone) {
    return <SplashAnimationScreen onComplete={() => setSplashDone(true)} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

});
