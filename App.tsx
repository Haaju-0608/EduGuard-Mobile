import './global.css';

import React, { useCallback, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
import { COLORS, FONTS } from './src/constants/theme';

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
  if (!authState.isLoggedIn) {
    return <LoginScreen />;
  }

  // Lecturer portal not yet implemented
  if (authState.user?.role === 'lecturer') {
    return (
      <ActivityWrapper onActivity={resetTimer}>
        <View style={s.holding}>
          <StatusBar style="light" />
          <SafeAreaView style={s.holdingInner}>
            <AppText style={s.holdingEmoji}>🏗️</AppText>
            <AppText style={s.holdingTitle}>Lecturer Portal</AppText>
            <AppText style={s.holdingBody}>
              The lecturer interface is not yet available.{'\n'}
              Please check back later.
            </AppText>
            <TouchableOpacity style={s.holdingBtn} onPress={logout} activeOpacity={0.75}>
              <AppText style={s.holdingBtnText}>Back to Login</AppText>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </ActivityWrapper>
    );
  }

  if (!authState.hasRegisteredFace) {
    return (
      <ActivityWrapper onActivity={resetTimer}>
        <FaceRegistrationScreen />
      </ActivityWrapper>
    );
  }

  return (
    <ActivityWrapper onActivity={resetTimer}>
      <NavigationContainer>
        <MainStackNavigator />
      </NavigationContainer>
    </ActivityWrapper>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  holding: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  holdingInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  holdingEmoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  holdingTitle: {
    fontSize: 22,
    fontFamily: FONTS.bodyBold,
    color: COLORS.whiteSoft,
  },
  holdingBody: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  holdingBtn: {
    marginTop: 24,
    backgroundColor: COLORS.navyCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
  },
  holdingBtnText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemi,
    color: COLORS.cyan,
  },
});
