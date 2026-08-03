import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

interface Props {
  onComplete: () => void;
}

export default function SplashAnimationScreen({ onComplete }: Props) {
  const scale   = useRef(new Animated.Value(0.68)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // ── Appear: scale up + fade in (like LinkedIn logo pop-in)
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // ── Hold
      Animated.delay(900),
      // ── Fade out the entire screen
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 320,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, []);

  return (
    <Animated.View style={[s.root, { opacity: screenOpacity }]}>
      <StatusBar style="light" />

      {/* Radial glow behind the shield */}
      <View style={s.glow} />

      <Animated.View
        style={[s.content, { opacity, transform: [{ scale }] }]}
      >
        {/* Shield icon */}
        <View style={s.shieldShadow}>
          <LinearGradient
            colors={['#2563EB', '#06B6D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.shieldGradient}
          >
            <AppText style={s.shieldEmoji}>🛡</AppText>
          </LinearGradient>
        </View>

        <AppText style={s.appName}>EduGuard</AppText>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Subtle blue glow in the centre background
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },

  content: {
    alignItems: 'center',
  },

  // Elevation / shadow wrapper (View, not LinearGradient)
  shieldShadow: {
    borderRadius: RADIUS['2xl'],
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
    marginBottom: 24,
  },
  shieldGradient: {
    width: 120,
    height: 120,
    borderRadius: RADIUS['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldEmoji: {
    fontSize: 52,
    lineHeight: 64,
    includeFontPadding: false,
  },

  appName: {
    fontFamily: FONTS.heading,
    fontSize: 36,
    color: COLORS.whiteSoft,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.cyan,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginTop: 5,
  },
});
