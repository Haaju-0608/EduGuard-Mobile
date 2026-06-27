import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { useAuth } from '../../navigation/AuthContext';

// ── Data ───────────────────────────────────────────────────────────────────────
const FRAME_W = 230;
const FRAME_H = 310;
const BRACKET = 28;
const PAD = 18;

const ANGLES = [
  {
    key: 'front' as const,
    label: 'Front',
    arrow: '↑',
    instruction: 'Look straight ahead',
    hint: 'Keep your face centered in the frame',
  },
  {
    key: 'left' as const,
    label: 'Left',
    arrow: '←',
    instruction: 'Turn slightly to the left',
    hint: 'Rotate your head slowly to the left',
  },
  {
    key: 'right' as const,
    label: 'Right',
    arrow: '→',
    instruction: 'Turn slightly to the right',
    hint: 'Rotate your head slowly to the right',
  },
] as const;

type AngleKey = (typeof ANGLES)[number]['key'];
type Phase = 'permission' | 'denied' | 'scanning' | 'success';

// ── Corner bracket ─────────────────────────────────────────────────────────────
function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = pos[0] === 't';
  const isLeft = pos[1] === 'l';

  return (
    <View
      style={[
        s.cornerBracket,
        isTop ? { top: 0 } : { bottom: 0 },
        isLeft ? { left: 0 } : { right: 0 },
      ]}
    >
      <View
        style={[
          s.bracketArm,
          { width: BRACKET, height: 3 },
          isTop ? { top: 0 } : { bottom: 0 },
          isLeft ? { left: 0 } : { right: 0 },
        ]}
      />
      <View
        style={[
          s.bracketArm,
          { width: 3, height: BRACKET },
          isTop ? { top: 0 } : { bottom: 0 },
          isLeft ? { left: 0 } : { right: 0 },
        ]}
      />
    </View>
  );
}

// ── Animated scan frame ────────────────────────────────────────────────────────
function ScanFrame({ active }: { active: boolean }) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!active) return;

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
      ])
    );

    scanLoop.start();
    glowLoop.start();

    return () => {
      scanLoop.stop();
      glowLoop.stop();
    };
  }, [active]);

  const scanY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_H - 3],
  });

  return (
    <View style={s.frameContainer}>
      <CornerBracket pos="tl" />
      <CornerBracket pos="tr" />
      <CornerBracket pos="bl" />
      <CornerBracket pos="br" />

      <Animated.View style={[s.ovalFrame, { opacity: glowAnim }]}>
        <Animated.View style={[s.scanBeam, { transform: [{ translateY: scanY }] }]} />
      </Animated.View>
    </View>
  );
}

// ── Progress dot ───────────────────────────────────────────────────────────────
function AngleDot({
  label,
  captured,
  active,
}: {
  label: string;
  captured: boolean;
  active: boolean;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={s.dotWrapper}>
      <Animated.View
        style={[
          s.dot,
          captured && s.dotCaptured,
          active && !captured && s.dotActive,
          active && !captured && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        {captured && <AppText style={s.dotCheck}>✓</AppText>}
        {active && !captured && (
          <View style={s.dotInnerDot} />
        )}
      </Animated.View>
      <AppText
        style={[
          s.dotLabel,
          active && !captured && { color: COLORS.cyan },
          captured && { color: COLORS.green },
        ]}
      >
        {label}
      </AppText>
    </View>
  );
}

// ── Permission request ─────────────────────────────────────────────────────────
function PermissionView({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={s.centeredSection}>
      <View style={s.permCard}>
        <LinearGradient
          colors={[COLORS.blue, COLORS.cyan]}
          style={s.permIconBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <AppText style={{ fontSize: 34 }}>📷</AppText>
        </LinearGradient>

        <AppText
          variant="h2"
          style={{ color: COLORS.whiteSoft, textAlign: 'center', marginBottom: 10 }}
        >
          Camera Access Required
        </AppText>
        <AppText
          variant="body-sm"
          color={COLORS.muted}
          style={{ textAlign: 'center', lineHeight: 20, marginBottom: 20 }}
        >
          EduGuard needs your camera to capture your face for secure exam authentication.
        </AppText>

        <View style={s.permFeatures}>
          {[
            'Face data is processed securely on-device',
            'Used only for exam identity verification',
            'You can remove your profile at any time',
          ].map((line) => (
            <View key={line} style={s.permFeatureRow}>
              <AppText style={{ color: COLORS.green, marginRight: 10 }}>✓</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={{ flex: 1 }}>
                {line}
              </AppText>
            </View>
          ))}
        </View>

        <Button
          label="Allow Camera Access"
          onPress={onRequest}
          style={{ width: '100%' }}
        />
      </View>
    </View>
  );
}

// ── Permission denied ──────────────────────────────────────────────────────────
function DeniedView() {
  return (
    <View style={s.centeredSection}>
      <View style={s.permCard}>
        <AppText style={{ fontSize: 40, marginBottom: 16 }}>🚫</AppText>
        <AppText
          variant="h3"
          style={{ color: COLORS.whiteSoft, textAlign: 'center', marginBottom: 10 }}
        >
          Camera Access Denied
        </AppText>
        <AppText
          variant="body-sm"
          color={COLORS.muted}
          style={{ textAlign: 'center', lineHeight: 20 }}
        >
          Please enable camera access in your device settings to use face registration.
        </AppText>
        <View
          style={{
            marginTop: 16,
            backgroundColor: 'rgba(239,68,68,0.08)',
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: 'rgba(239,68,68,0.2)',
            padding: 12,
          }}
        >
          <AppText variant="body-sm" color={COLORS.muted} style={{ textAlign: 'center' }}>
            Settings → Apps → EduGuard → Permissions → Camera
          </AppText>
        </View>
      </View>
    </View>
  );
}

// ── Success ────────────────────────────────────────────────────────────────────
function SuccessView({ onRetry, onContinue }: { onRetry: () => void; onContinue: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.55)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[s.centeredSection, { paddingHorizontal: 24 }]}>
      <Animated.View
        style={[s.successCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
      >
        {/* Top accent */}
        <LinearGradient
          colors={[COLORS.green, COLORS.cyan]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.cardAccentBar}
        />

        {/* Check badge */}
        <View style={s.successBadge}>
          <LinearGradient
            colors={[COLORS.green, COLORS.cyan]}
            style={s.successBadgeGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <AppText style={s.successMark}>✓</AppText>
          </LinearGradient>
        </View>

        <AppText
          variant="h2"
          style={{ color: COLORS.whiteSoft, textAlign: 'center', marginBottom: 6 }}
        >
          Registration Complete!
        </AppText>
        <AppText
          variant="body-sm"
          color={COLORS.muted}
          style={{ textAlign: 'center', lineHeight: 20, marginBottom: 20 }}
        >
          Your biometric profile has been created successfully.
        </AppText>

        {/* Captured angle summary */}
        <View style={s.capturedList}>
          {ANGLES.map((angle) => (
            <View key={angle.key} style={s.capturedRow}>
              <View style={s.capturedDot} />
              <AppText variant="body-sm" color={COLORS.whiteSoft}>
                {angle.label} view captured
              </AppText>
              <AppText style={{ color: COLORS.green, marginLeft: 'auto', fontSize: 14 }}>✓</AppText>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={{ width: '100%', marginTop: 24, gap: 12 }}>
        <Button label="Continue" onPress={onContinue} style={{ width: '100%' }} />
        <Button
          label="Register Again"
          variant="ghost"
          onPress={onRetry}
          style={{ width: '100%' }}
        />
      </View>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function FaceRegistrationScreen() {
  const { completeFaceRegistration, logout } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('permission');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captured, setCaptured] = useState<AngleKey[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission) return;
    if (permission.granted) setPhase('scanning');
    else if (permission.status === 'denied') setPhase('denied');
  }, [permission]);

  const handleRequest = async () => {
    const result = await requestPermission();
    if (result.granted) setPhase('scanning');
    else setPhase('denied');
  };

  const handleCapture = () => {
    if (isCapturing) return;
    setIsCapturing(true);

    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => {
      const key = ANGLES[currentIndex].key;
      setCaptured((prev) => [...prev, key]);

      if (currentIndex < ANGLES.length - 1) {
        setCurrentIndex((i) => i + 1);
        setIsCapturing(false);
      } else {
        setIsCapturing(false);
        setPhase('success');
      }
    });
  };

  const handleRetry = () => {
    setCaptured([]);
    setCurrentIndex(0);
    setPhase('scanning');
  };

  const currentAngle = ANGLES[currentIndex];

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {phase === 'scanning' && (
        <CameraView style={StyleSheet.absoluteFill} facing="front" />
      )}

      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: phase === 'scanning' ? 'rgba(10,15,46,0.48)' : COLORS.navy },
        ]}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} activeOpacity={0.75} onPress={logout}>
            <AppText style={s.backArrow}>←</AppText>
          </TouchableOpacity>
          <AppText variant="h3" style={s.headerTitle}>
            Face Registration
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Phase content ── */}
        {phase === 'permission' && <PermissionView onRequest={handleRequest} />}
        {phase === 'denied' && <DeniedView />}

        {phase === 'scanning' && (
          <>
            {/* Camera area with scan frame */}
            <View style={s.cameraSection}>
              <ScanFrame active={!isCapturing} />

              {/* Direction badge */}
              <View style={s.directionBadge}>
                <AppText style={s.directionArrow}>{currentAngle.arrow}</AppText>
                <AppText
                  variant="body-sm"
                  color={COLORS.whiteSoft}
                  style={{ marginLeft: 8 }}
                >
                  {currentAngle.instruction}
                </AppText>
              </View>
            </View>

            {/* Bottom controls panel */}
            <View style={s.bottomPanel}>
              <AppText
                variant="body-sm"
                color={COLORS.muted}
                style={{ textAlign: 'center', marginBottom: 16 }}
              >
                {currentAngle.hint}
              </AppText>

              {/* Angle progress dots */}
              <View style={s.dotsRow}>
                {ANGLES.map((angle, i) => (
                  <AngleDot
                    key={angle.key}
                    label={angle.label}
                    captured={captured.includes(angle.key)}
                    active={i === currentIndex && !captured.includes(angle.key)}
                  />
                ))}
              </View>

              {/* Progress counter */}
              <AppText
                variant="caption"
                style={{ textAlign: 'center', color: COLORS.muted, marginBottom: 16 }}
              >
                {captured.length} of {ANGLES.length} angles captured
              </AppText>

              <Button
                label={isCapturing ? 'Capturing…' : 'Capture'}
                onPress={handleCapture}
                loading={isCapturing}
                style={s.captureBtn}
              />
            </View>
          </>
        )}

        {phase === 'success' && (
          <SuccessView onRetry={handleRetry} onContinue={completeFaceRegistration} />
        )}
      </SafeAreaView>

      {/* Camera flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flashOpacity }]}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(22,29,63,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.whiteSoft,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.whiteSoft,
  },

  // Camera section
  cameraSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Frame
  frameContainer: {
    width: FRAME_W + PAD * 2,
    height: FRAME_H + PAD * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
  },
  bracketArm: {
    position: 'absolute',
    backgroundColor: COLORS.cyan,
    borderRadius: 2,
  },
  ovalFrame: {
    width: FRAME_W,
    height: FRAME_H,
    borderRadius: FRAME_W / 2,
    borderWidth: 2.5,
    borderColor: COLORS.cyan,
    overflow: 'hidden',
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(6,182,212,0.8)',
  },

  // Direction badge
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    backgroundColor: 'rgba(10,15,46,0.78)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  directionArrow: {
    fontSize: 18,
    color: COLORS.cyan,
    fontFamily: FONTS.heading,
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: 'rgba(10,15,46,0.82)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 36,
    marginBottom: 12,
  },
  dotWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: 'rgba(241,245,255,0.2)',
    backgroundColor: 'rgba(22,29,63,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    borderColor: COLORS.cyan,
    backgroundColor: 'rgba(6,182,212,0.12)',
  },
  dotCaptured: {
    borderColor: COLORS.green,
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  dotInnerDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cyan,
  },
  dotCheck: {
    fontSize: 15,
    color: COLORS.green,
    fontFamily: FONTS.bodyBold,
  },
  dotLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: 'rgba(241,245,255,0.45)',
    letterSpacing: 0.3,
  },
  captureBtn: {
    width: '100%',
  },

  // Shared centered layout
  centeredSection: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  // Permission card
  permCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  permIconBg: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permFeatures: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  permFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  // Success card
  successCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.22)',
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  successBadge: {
    marginTop: 12,
    marginBottom: 16,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  successBadgeGrad: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMark: {
    fontSize: 32,
    color: '#fff',
    fontFamily: FONTS.headingBold,
  },
  capturedList: {
    width: '100%',
    gap: 8,
  },
  capturedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.07)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  capturedDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.green,
    marginRight: 10,
  },
});
