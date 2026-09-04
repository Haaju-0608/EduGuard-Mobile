import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { useAuth } from '../../navigation/AuthContext';
import { submitBiometricRegistration } from '../../api/biometric';
import PoseCheckWebView, { PoseCheckWebViewHandle } from '../../components/registration/PoseCheckWebView';
import { isPoseValidForAngle, poseWarningMessage } from '../../utils/facePose';

// ── Config ────────────────────────────────────────────────────────────────────

const FRAME_W = 260;
const FRAME_H = 340;
const BRACKET = 28;
const PAD = 12;

const ANGLES = [
  { key: 'front', label: 'Front View',    instruction: 'Look straight at the camera', arrow: '↑' },
  { key: 'left',  label: 'Left Profile',  instruction: 'Slowly turn your head to the left', arrow: '←' },
  { key: 'right', label: 'Right Profile', instruction: 'Slowly turn your head to the right', arrow: '→' },
] as const;

type Phase = 'permission' | 'denied' | 'scanning' | 'confirm' | 'preview' | 'uploading' | 'success' | 'error';

// ── Corner bracket ─────────────────────────────────────────────────────────────

function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop  = pos[0] === 't';
  const isLeft = pos[1] === 'l';
  return (
    <View style={[s.cornerBracket, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]}>
      <View style={[s.bracketArm, { width: BRACKET, height: 3 }, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]} />
      <View style={[s.bracketArm, { width: 3, height: BRACKET }, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]} />
    </View>
  );
}

// ── Animated scan frame ────────────────────────────────────────────────────────

function ScanFrame({ active }: { active: boolean }) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!active) return;
    const scanLoop = Animated.loop(Animated.sequence([
      Animated.timing(scanAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
      Animated.timing(scanAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
    ]));
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
    ]));
    scanLoop.start();
    glowLoop.start();
    return () => { scanLoop.stop(); glowLoop.stop(); };
  }, [active]);

  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H - 3] });

  return (
    <View style={s.frameContainer}>
      <CornerBracket pos="tl" /><CornerBracket pos="tr" />
      <CornerBracket pos="bl" /><CornerBracket pos="br" />
      <Animated.View style={[s.ovalFrame, { opacity: glowAnim }]}>
        <Animated.View style={[s.scanBeam, { transform: [{ translateY: scanY }] }]} />
      </Animated.View>
    </View>
  );
}

// ── Permission request ─────────────────────────────────────────────────────────

function PermissionView({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={s.centeredSection}>
      <View style={s.card}>
        <LinearGradient colors={[COLORS.blue, COLORS.cyan]} style={s.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <AppText style={{ fontSize: 34 }}>📷</AppText>
        </LinearGradient>
        <AppText variant="h2" style={s.cardTitle}>Camera Access Required</AppText>
        <AppText variant="body-sm" color={COLORS.muted} style={s.cardSubtitle}>
          EduGuard needs your camera to capture 3 angles of your face for secure exam authentication.
        </AppText>
        <View style={s.featureList}>
          {[
            'Face data is processed securely on-device',
            'Used only for exam identity verification',
            '3 angles required: front, left, right',
          ].map((line) => (
            <View key={line} style={s.featureRow}>
              <AppText style={{ color: COLORS.green, marginRight: 10 }}>✓</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={{ flex: 1 }}>{line}</AppText>
            </View>
          ))}
        </View>
        <Button label="Allow Camera Access" onPress={onRequest} style={{ width: '100%' }} />
      </View>
    </View>
  );
}

// ── Permission denied ──────────────────────────────────────────────────────────

function DeniedView() {
  return (
    <View style={s.centeredSection}>
      <View style={s.card}>
        <AppText style={{ fontSize: 40, marginBottom: 16 }}>🚫</AppText>
        <AppText variant="h3" style={s.cardTitle}>Camera Access Denied</AppText>
        <AppText variant="body-sm" color={COLORS.muted} style={s.cardSubtitle}>
          Please enable camera access in your device settings.
        </AppText>
        <View style={{ marginTop: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', padding: 12 }}>
          <AppText variant="body-sm" color={COLORS.muted} style={{ textAlign: 'center' }}>
            Settings → Apps → EduGuard → Permissions → Camera
          </AppText>
        </View>
      </View>
    </View>
  );
}

// ── Preview (all 3 captured) ───────────────────────────────────────────────────

function PreviewView({
  photos,
  onRetake,
  onSubmit,
}: {
  photos: string[];
  onRetake: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={s.centeredSection}>
      <View style={s.card}>
        <LinearGradient
          colors={[COLORS.blue, COLORS.cyan]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={s.accentBar}
        />
        <AppText variant="h3" style={s.cardTitle}>Review Your Photos</AppText>
        <AppText variant="body-sm" color={COLORS.muted} style={[s.cardSubtitle, { marginBottom: 20 }]}>
          Make sure all 3 angles are clear before submitting.
        </AppText>

        {/* 3 thumbnails */}
        <View style={s.thumbRow}>
          {ANGLES.map((angle, i) => (
            <View key={angle.key} style={s.thumbWrap}>
              <Image source={{ uri: photos[i] }} style={s.thumb} resizeMode="cover" />
              <View style={s.thumbBadge}>
                <AppText style={s.thumbArrow}>{angle.arrow}</AppText>
              </View>
              <AppText variant="caption" style={s.thumbLabel}>{angle.label}</AppText>
            </View>
          ))}
        </View>

        {/* Checklist */}
        <View style={s.checkList}>
          {ANGLES.map((angle) => (
            <View key={angle.key} style={s.checkRow}>
              <AppText style={{ color: COLORS.green, fontSize: 13 }}>✓</AppText>
              <AppText variant="body-sm" color={COLORS.whiteSoft}>{angle.label} captured</AppText>
            </View>
          ))}
        </View>

        <Button label="Submit Registration" onPress={onSubmit} style={{ width: '100%', marginTop: 4 }} />

        <TouchableOpacity onPress={onRetake} activeOpacity={0.75} style={s.retakeBtn}>
          <AppText style={s.retakeText}>Re-take photos</AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Uploading ──────────────────────────────────────────────────────────────────

function UploadingView() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1100, useNativeDriver: true })
    ).start();
  }, []);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.centeredSection}>
      <View style={s.card}>
        <Animated.View style={{ transform: [{ rotate }], marginBottom: 20 }}>
          <AppText style={{ fontSize: 44 }}>⏳</AppText>
        </Animated.View>
        <AppText variant="h3" style={s.cardTitle}>Submitting…</AppText>
        <AppText variant="body-sm" color={COLORS.muted} style={s.cardSubtitle}>
          Uploading your 3 photos to the server. Please wait.
        </AppText>
      </View>
    </View>
  );
}

// ── Error ──────────────────────────────────────────────────────────────────────

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={s.centeredSection}>
      <View style={s.card}>
        <AppText style={{ fontSize: 40, marginBottom: 16 }}>❌</AppText>
        <AppText variant="h3" style={s.cardTitle}>Submission Failed</AppText>
        <View style={s.errorBox}>
          <AppText variant="body-sm" style={{ color: '#F87171', textAlign: 'center' }}>
            {message}
          </AppText>
        </View>
        <Button label="Try Again" onPress={onRetry} style={{ width: '100%' }} />
      </View>
    </View>
  );
}

// ── Success ────────────────────────────────────────────────────────────────────

function SuccessView({ onContinue }: { onContinue: () => void }) {
  const scaleAnim   = useRef(new Animated.Value(0.55)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[s.centeredSection, { paddingHorizontal: 24 }]}>
      <Animated.View style={[s.successCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <LinearGradient colors={[COLORS.gold, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
        <View style={{ marginTop: 12, marginBottom: 16 }}>
          <LinearGradient colors={[COLORS.gold, '#f97316']} style={s.successBadgeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <AppText style={s.successMark}>📬</AppText>
          </LinearGradient>
        </View>

        <AppText variant="h2" style={s.cardTitle}>Request Submitted!</AppText>
        <AppText variant="body-sm" color={COLORS.muted} style={[s.cardSubtitle, { marginBottom: 20 }]}>
          Your photos have been sent to the school for review.{'\n'}
          You'll be notified once your biometric profile is approved.
        </AppText>

        {/* Checklist */}
        <View style={s.checkList}>
          <View style={s.checkRow}>
            <AppText style={{ color: COLORS.green, fontSize: 13 }}>✓</AppText>
            <AppText variant="body-sm" color={COLORS.whiteSoft}>3 photos uploaded successfully</AppText>
          </View>
          <View style={s.checkRow}>
            <AppText style={{ color: COLORS.green, fontSize: 13 }}>✓</AppText>
            <AppText variant="body-sm" color={COLORS.whiteSoft}>Registration request created</AppText>
          </View>
          <View style={[s.checkRow, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.20)' }]}>
            <AppText style={{ fontSize: 13 }}>🕐</AppText>
            <AppText variant="body-sm" color={COLORS.gold}>Awaiting school approval</AppText>
          </View>
        </View>
      </Animated.View>

      <View style={{ width: '100%', marginTop: 24 }}>
        <Button label="Continue to App" onPress={onContinue} style={{ width: '100%' }} />
      </View>
    </View>
  );
}

// ── User-friendly error mapper ─────────────────────────────────────────────────

function friendlyBiometricError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  if (/400|bad request/i.test(msg))
    return 'No face detected. Please retake your photos in good lighting with your face clearly visible inside the frame.';
  if (/409|already|duplicate|exists/i.test(msg))
    return 'You already have a pending registration request. Please wait for admin review.';
  if (/401|unauthorized|session/i.test(msg))
    return 'Your session has expired. Please sign in again.';
  if (/network|timeout|fetch|connect/i.test(msg))
    return 'Could not reach the server. Please check your connection and try again.';
  if (/500|server error/i.test(msg))
    return 'Server error. Please try again in a moment.';
  return 'Registration failed. Please try again.';
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function FaceRegistrationScreen() {
  const { completeFaceRegistration, logout } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase]               = useState<Phase>('permission');
  const [angleIndex, setAngleIndex]     = useState(0); // 0=front, 1=left, 2=right
  const [photos, setPhotos]             = useState<string[]>([]); // captured URIs
  const [isCapturing, setIsCapturing]   = useState(false);
  const [pendingUri, setPendingUri]     = useState<string | null>(null);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [checkingPose, setCheckingPose] = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');

  const cameraRef    = useRef<CameraView>(null);
  const poseRef       = useRef<PoseCheckWebViewHandle>(null);
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

  // ── Capture one angle ──────────────────────────────────────────────────────

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);

    // Flash
    await new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.88, duration: 70,  useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0,    duration: 380, useNativeDriver: true }),
      ]).start(() => resolve());
    });

    let uri: string;
    let base64: string | undefined;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true });
      uri = photo!.uri;
      base64 = photo!.base64;
    } catch {
      setErrorMsg('Failed to capture photo. Please try again.');
      setPhase('error');
      setIsCapturing(false);
      return;
    }

    setPendingUri(uri);
    setPendingBase64(base64 ?? null);
    setPhase('confirm');
    setIsCapturing(false);
  };

  // ── Confirm captured photo ─────────────────────────────────────────────────

  const commitPendingPhoto = () => {
    if (!pendingUri) return;
    const newPhotos = [...photos, pendingUri];
    setPhotos(newPhotos);
    setPendingUri(null);
    setPendingBase64(null);
    if (newPhotos.length < 3) {
      setAngleIndex(newPhotos.length);
      setPhase('scanning');
    } else {
      setPhase('preview');
    }
  };

  // Kiểm tra góc quay đầu trước khi chấp nhận ảnh — fail-open: bất kỳ lỗi/không chắc chắn nào
  // (WebView chưa sẵn sàng, mất mạng lúc tải MediaPipe, timeout...) đều cho qua bình thường như
  // trước đây, CHỈ chặn khi thật sự đo được rõ ràng là sai góc. Không phải khoá cứng — vẫn cho
  // "Use anyway" vì đây chỉ là ước lượng, không phải quyết định cuối cùng (đó là việc của BE lúc
  // duyệt + AI service lúc xác thực thi thật).
  const handleConfirm = async () => {
    if (!pendingUri) return;
    const angleKey = ANGLES[angleIndex].key;

    if (pendingBase64) {
      setCheckingPose(true);
      const result = await poseRef.current?.analyze(pendingBase64).catch(() => null);
      setCheckingPose(false);

      if (result?.ok && !isPoseValidForAngle(angleKey, result.ratio)) {
        Alert.alert('Check This Photo', poseWarningMessage(angleKey), [
          { text: 'Retake', style: 'cancel', onPress: handleRetakeAngle },
          { text: 'Use Anyway', onPress: commitPendingPhoto },
        ]);
        return;
      }
    }

    commitPendingPhoto();
  };

  const handleRetakeAngle = () => {
    setPendingUri(null);
    setPendingBase64(null);
    setPhase('scanning');
  };

  // ── Submit all 3 photos ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setPhase('uploading');
    try {
      await submitBiometricRegistration(photos[0], photos[1], photos[2]);
      setPhase('success');
    } catch (err) {
      setErrorMsg(friendlyBiometricError(err));
      setPhase('error');
    }
  };

  // ── Retake → restart from angle 0 ─────────────────────────────────────────

  const handleRetake = () => {
    setPhotos([]);
    setAngleIndex(0);
    setPhase('scanning');
  };

  const handleRetry = () => {
    setErrorMsg('');
    setPhase('preview'); // go back to preview with same photos
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isScanning = phase === 'scanning';
  const angle      = ANGLES[angleIndex];

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {isScanning && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" zoom={0} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isScanning ? 'rgba(10,15,46,0.48)' : COLORS.navy }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} activeOpacity={0.75} onPress={logout}>
            <AppText style={s.backArrow}>←</AppText>
          </TouchableOpacity>
          <AppText variant="h3" style={s.headerTitle}>Face Registration</AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* Phase views */}
        {phase === 'permission' && <PermissionView onRequest={handleRequest} />}
        {phase === 'denied'     && <DeniedView />}
        {phase === 'confirm'    && pendingUri && (
          <View style={s.centeredSection}>
            <View style={s.card}>
              <AppText variant="h3" style={s.cardTitle}>Check Your Photo</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={[s.cardSubtitle, { marginBottom: 16 }]}>
                {ANGLES[angleIndex].label} — is your face clearly visible?
              </AppText>
              <Image source={{ uri: pendingUri }} style={{ width: '100%', height: 280, borderRadius: RADIUS.md, marginBottom: 20 }} resizeMode="cover" />
              <Button
                label={checkingPose ? 'Checking…' : 'Looks good!'}
                onPress={() => void handleConfirm()}
                loading={checkingPose}
                disabled={checkingPose}
                style={{ width: '100%', marginBottom: 12 }}
              />
              <TouchableOpacity onPress={handleRetakeAngle} activeOpacity={0.75} style={s.retakeBtn}>
                <AppText style={s.retakeText}>Retake this photo</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {phase === 'preview'    && <PreviewView photos={photos} onRetake={handleRetake} onSubmit={handleSubmit} />}
        {phase === 'uploading'  && <UploadingView />}
        {phase === 'error'      && <ErrorView message={errorMsg} onRetry={handleRetry} />}
        {phase === 'success'    && <SuccessView onContinue={completeFaceRegistration} />}

        {/* Scanning UI */}
        {isScanning && (
          <>
            {/* Step counter */}
            <View style={s.stepCounter}>
              {ANGLES.map((a, i) => (
                <View
                  key={a.key}
                  style={[s.stepDot, i < angleIndex && s.stepDotDone, i === angleIndex && s.stepDotActive]}
                />
              ))}
              <AppText variant="caption" style={{ marginLeft: 10 }}>
                Step {angleIndex + 1} of 3 — {angle.label}
              </AppText>
            </View>

            {/* Camera + frame */}
            <View style={s.cameraSection}>
              <ScanFrame active={!isCapturing} />
              <View style={s.directionBadge}>
                <AppText style={s.directionArrow}>{angle.arrow}</AppText>
                <AppText variant="body-sm" color={COLORS.whiteSoft} style={{ marginLeft: 8 }}>
                  {angle.instruction}
                </AppText>
              </View>
            </View>

            {/* Bottom panel: thumbnails + button */}
            <View style={s.bottomPanel}>
              {/* Captured thumbnails */}
              <View style={s.thumbsRow}>
                {ANGLES.map((a, i) => (
                  <View key={a.key} style={s.miniThumbWrap}>
                    {photos[i] ? (
                      <Image source={{ uri: photos[i] }} style={s.miniThumb} resizeMode="cover" />
                    ) : (
                      <View style={[s.miniThumb, s.miniThumbEmpty]}>
                        <AppText style={{ fontSize: 16 }}>{a.arrow}</AppText>
                      </View>
                    )}
                    <AppText style={s.miniThumbLabel}>{a.label}</AppText>
                  </View>
                ))}
              </View>

              <AppText variant="caption" style={{ textAlign: 'center', marginBottom: 6 }}>
                {angle.instruction}
              </AppText>
              <AppText variant="caption" color="rgba(245,158,11,0.8)" style={{ textAlign: 'center', marginBottom: 10 }}>
                💡 Good lighting · face inside the oval · look clearly at camera
              </AppText>
              <Button
                label={isCapturing ? 'Capturing…' : `Capture ${angle.label}`}
                onPress={handleCapture}
                loading={isCapturing}
                style={s.captureBtn}
              />
            </View>
          </>
        )}
      </SafeAreaView>

      {/* Flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flashOpacity }]}
      />

      {/* Ẩn, chỉ dùng để phân tích góc mặt mỗi lần chụp — mount sẵn từ đầu để kịp tải MediaPipe
          trước khi người dùng chụp xong tấm đầu tiên. */}
      <PoseCheckWebView ref={poseRef} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 40, height: 40, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(22,29,63,0.75)', alignItems: 'center', justifyContent: 'center' },
  backArrow:   { fontSize: 20, color: COLORS.whiteSoft },
  headerTitle: { flex: 1, textAlign: 'center', color: COLORS.whiteSoft },

  // Step counter
  stepCounter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 8, gap: 6 },
  stepDot:       { width: 8,  height: 8,  borderRadius: 4, backgroundColor: 'rgba(241,245,255,0.20)' },
  stepDotDone:   { backgroundColor: COLORS.green },
  stepDotActive: { width: 22, backgroundColor: COLORS.cyan },

  // Camera
  cameraSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frameContainer: { width: FRAME_W + PAD * 2, height: FRAME_H + PAD * 2, alignItems: 'center', justifyContent: 'center' },
  cornerBracket: { position: 'absolute', width: BRACKET, height: BRACKET },
  bracketArm:    { position: 'absolute', backgroundColor: COLORS.cyan, borderRadius: 2 },
  ovalFrame:     { width: FRAME_W, height: FRAME_H, borderRadius: FRAME_W / 2, borderWidth: 2.5, borderColor: COLORS.cyan, overflow: 'hidden' },
  scanBeam:      { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(6,182,212,0.8)' },

  directionBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 22, backgroundColor: 'rgba(10,15,46,0.78)', borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 20, paddingVertical: 10 },
  directionArrow: { fontSize: 18, color: COLORS.cyan, fontFamily: FONTS.heading },

  // Bottom panel
  bottomPanel: { backgroundColor: 'rgba(10,15,46,0.88)', borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  captureBtn:  { width: '100%' },

  // Mini thumbnails (during capture)
  thumbsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 14 },
  miniThumbWrap:  { alignItems: 'center', gap: 4 },
  miniThumb:      { width: 56, height: 70, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.border },
  miniThumbEmpty: { backgroundColor: 'rgba(241,245,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  miniThumbLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.muted },

  // Cards (permission / preview / uploading / error)
  centeredSection: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'], borderWidth: 1, borderColor: COLORS.border, padding: 24, alignItems: 'center', overflow: 'hidden' },
  cardTitle:    { color: COLORS.whiteSoft, textAlign: 'center', marginBottom: 8 },
  cardSubtitle: { textAlign: 'center', lineHeight: 20 },
  accentBar:    { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },

  iconCircle: { width: 80, height: 80, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  featureList:  { width: '100%', gap: 10, marginBottom: 24 },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start' },

  // Preview thumbnails
  thumbRow:   { flexDirection: 'row', gap: 12, marginBottom: 16 },
  thumbWrap:  { flex: 1, alignItems: 'center', gap: 6 },
  thumb:      { width: '100%', aspectRatio: 3 / 4, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.green },
  thumbBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(10,15,46,0.75)', borderRadius: RADIUS.full, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  thumbArrow: { fontSize: 12, color: COLORS.cyan },
  thumbLabel: { color: COLORS.muted, fontSize: 10 },

  // Checklist
  checkList: { width: '100%', gap: 8, marginBottom: 20 },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(16,185,129,0.07)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(16,185,129,0.16)', paddingHorizontal: 14, paddingVertical: 10 },

  // Retake button
  retakeBtn:  { marginTop: 16, paddingVertical: 10 },
  retakeText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: 'rgba(241,245,255,0.45)' },

  // Error
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', padding: 12, width: '100%', marginBottom: 20, marginTop: 4 },

  // Success
  successCard:      { backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'], borderWidth: 1, borderColor: 'rgba(245,158,11,0.22)', padding: 24, alignItems: 'center', overflow: 'hidden' },
  successBadgeGrad: { width: 72, height: 72, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  successMark:      { fontSize: 32 },
});
