import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { submitBiometricRegistration, getMyBiometricRequests, BiometricRequest } from '../../api/biometric';

// ── Config ─────────────────────────────────────────────────────────────────────

const FRAME_W = 260;
const FRAME_H = 340;
const BRACKET = 28;
const PAD     = 12;

const ANGLES = [
  { key: 'front', label: 'Front View',    instruction: 'Look straight at the camera', arrow: '↑' },
  { key: 'left',  label: 'Left Profile',  instruction: 'Slowly turn your head to the left', arrow: '←' },
  { key: 'right', label: 'Right Profile', instruction: 'Slowly turn your head to the right', arrow: '→' },
] as const;

const REASONS = [
  'Face not recognized during exams',
  'Significant change in appearance',
  'Poor quality of previous registration',
  'Added or removed glasses',
  'Medical or physical changes',
  'Other reason',
] as const;

const STATUS_CFG = {
  Pending:  { color: COLORS.gold,  bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)',  icon: '⏳', label: 'Pending'  },
  Approved: { color: COLORS.green, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '✓',  label: 'Approved' },
  Rejected: { color: COLORS.red,   bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',  icon: '✗',  label: 'Rejected' },
};

type Phase = 'reason' | 'permission' | 'denied' | 'scanning' | 'preview' | 'uploading' | 'submitted' | 'error';

// ── Camera helpers ─────────────────────────────────────────────────────────────

function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop  = pos[0] === 't';
  const isLeft = pos[1] === 'l';
  return (
    <View style={[cam.cornerBracket, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]}>
      <View style={[cam.bracketArm, { width: BRACKET, height: 3 }, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]} />
      <View style={[cam.bracketArm, { width: 3, height: BRACKET }, isTop ? { top: 0 } : { bottom: 0 }, isLeft ? { left: 0 } : { right: 0 }]} />
    </View>
  );
}

function ScanFrame({ active }: { active: boolean }) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (!active) return;
    const s = Animated.loop(Animated.sequence([
      Animated.timing(scanAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
      Animated.timing(scanAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
    ]));
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,    duration: 1100, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.45, duration: 1100, useNativeDriver: true }),
    ]));
    s.start(); g.start();
    return () => { s.stop(); g.stop(); };
  }, [active]);

  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_H - 3] });

  return (
    <View style={cam.frameContainer}>
      <CornerBracket pos="tl" /><CornerBracket pos="tr" />
      <CornerBracket pos="bl" /><CornerBracket pos="br" />
      <Animated.View style={[cam.ovalFrame, { opacity: glowAnim }]}>
        <Animated.View style={[cam.scanBeam, { transform: [{ translateY: scanY }] }]} />
      </Animated.View>
    </View>
  );
}

// ── Reason picker modal ────────────────────────────────────────────────────────

function ReasonPickerModal({ open, selected, onSelect, onClose }: {
  open: boolean; selected: string; onSelect: (r: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={pm.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={pm.sheet}>
          <View style={pm.dragHandle} />
          <AppText variant="h3" style={pm.title}>Reason for Request</AppText>
          <AppText variant="body-sm" color={COLORS.muted} style={pm.subtitle}>
            Select the reason that best describes your situation.
          </AppText>
          <View style={pm.divider} />
          {REASONS.map((r) => {
            const active = selected === r;
            return (
              <TouchableOpacity key={r} onPress={() => onSelect(r)} activeOpacity={0.75}
                style={[pm.optionRow, active && pm.optionRowActive]}>
                <View style={[pm.radioOuter, active && pm.radioOuterActive]}>
                  {active && <View style={pm.radioInner} />}
                </View>
                <AppText variant="body" color={active ? COLORS.whiteSoft : 'rgba(241,245,255,0.65)'} style={{ flex: 1 }}>
                  {r}
                </AppText>
              </TouchableOpacity>
            );
          })}
          <View style={pm.divider} />
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={pm.cancelBtn}>
            <AppText variant="semi" color={COLORS.muted}>Cancel</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── History card ───────────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: BiometricRequest }) {
  const sc  = STATUS_CFG[item.status];
  const date = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const reviewDate = item.reviewedAt
    ? new Date(item.reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <View style={[s.historyCard, { borderLeftColor: sc.color }]}>
      <View style={s.historyCardTop}>
        <AppText variant="caption" color={COLORS.muted}>Submitted {date}</AppText>
        <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <AppText style={[s.statusIcon, { color: sc.color }]}>{sc.icon}</AppText>
          <AppText style={[s.statusLabel, { color: sc.color }]}>{sc.label}</AppText>
        </View>
      </View>
      <AppText variant="semi" color={COLORS.whiteSoft} style={{ fontSize: 14 }}>{item.reason}</AppText>
      {reviewDate && (
        <View style={[s.reviewBlock, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <AppText variant="caption" color={COLORS.muted}>Reviewed on {reviewDate}</AppText>
          {item.status === 'Approved' && (
            <AppText variant="body-sm" color={sc.color} style={{ marginTop: 4 }}>
              Your biometric profile has been updated with the new face data.
            </AppText>
          )}
          {item.status === 'Rejected' && (
            <AppText variant="body-sm" color={sc.color} style={{ marginTop: 4 }}>
              Request was not approved. You may submit a new request if the issue persists.
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function FaceReRegistrationScreen() {
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef    = useRef<CameraView>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const [phase, setPhase]           = useState<Phase>('reason');
  const [reason, setReason]         = useState('');
  const [reasonError, setReasonError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [angleIndex, setAngleIndex] = useState(0);
  const [photos, setPhotos]         = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [history, setHistory]       = useState<BiometricRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    getMyBiometricRequests()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  const hasPending = history.some((r) => r.status === 'Pending');

  // ── Start flow ────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!reason) { setReasonError('Please select a reason before continuing.'); return; }
    setReasonError('');

    if (permission?.granted) {
      resetCamera();
      setPhase('scanning');
    } else if (permission?.status === 'denied') {
      setPhase('denied');
    } else {
      setPhase('permission');
    }
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (result.granted) { resetCamera(); setPhase('scanning'); }
    else setPhase('denied');
  };

  const resetCamera = () => { setPhotos([]); setAngleIndex(0); };

  // ── Capture ───────────────────────────────────────────────────────────────────

  const handleCapture = async () => {
    if (isCapturing || !cameraRef.current) return;
    setIsCapturing(true);

    await new Promise<void>((resolve) => {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.88, duration: 70,  useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0,    duration: 380, useNativeDriver: true }),
      ]).start(() => resolve());
    });

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      const newPhotos = [...photos, photo!.uri];
      setPhotos(newPhotos);
      if (newPhotos.length < 3) setAngleIndex(newPhotos.length);
      else setPhase('preview');
    } catch {
      setErrorMsg('Failed to capture photo. Please try again.');
      setPhase('error');
    } finally {
      setIsCapturing(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setPhase('uploading');
    try {
      await submitBiometricRegistration(photos[0], photos[1], photos[2], reason);
      // Refresh history
      const updated = await getMyBiometricRequests().catch(() => history);
      setHistory(updated);
      setPhase('submitted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      let friendly = 'Registration failed. Please try again.';
      if (/400|bad request/i.test(msg))        friendly = 'No face detected. Please retake in good lighting with your face clearly visible.';
      else if (/409|already|duplicate/i.test(msg)) friendly = 'You already have a pending request. Please wait for admin review.';
      else if (/401|unauthorized|session/i.test(msg)) friendly = 'Your session has expired. Please sign in again.';
      else if (/network|timeout|fetch|connect/i.test(msg)) friendly = 'Could not reach the server. Check your connection and try again.';
      else if (/500|server error/i.test(msg))   friendly = 'Server error. Please try again in a moment.';
      setErrorMsg(friendly);
      setPhase('error');
    }
  };

  const handleRetake = () => { resetCamera(); setPhase('scanning'); };
  const handleRetry  = () => setPhase('preview');
  const handleDone   = () => { setPhase('reason'); setReason(''); };

  // ── Render ────────────────────────────────────────────────────────────────────

  const isScanning  = phase === 'scanning';
  const angle       = ANGLES[angleIndex];

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {isScanning && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" zoom={0} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isScanning ? 'rgba(10,15,46,0.48)' : COLORS.navy }]} />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} activeOpacity={0.75}
            onPress={() => {
              if (phase === 'scanning' || phase === 'preview') { resetCamera(); setPhase('reason'); }
              else if (phase === 'permission' || phase === 'denied') setPhase('reason');
              else navigation.goBack();
            }}>
            <AppText style={s.backArrow}>←</AppText>
          </TouchableOpacity>
          <AppText variant="h3" style={s.headerTitle}>
            {phase === 'scanning' ? `Photo ${angleIndex + 1} of 3` : 'Re-registration Request'}
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Phase: Reason selection ── */}
        {phase === 'reason' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            {hasPending ? (
              /* Pending notice */
              <View style={s.pendingCard}>
                <LinearGradient colors={[COLORS.gold, '#F97316']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <AppText style={{ fontSize: 34 }}>⏳</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" style={{ color: COLORS.whiteSoft }}>Request Under Review</AppText>
                    <View style={s.pendingBadge}>
                      <AppText style={s.pendingBadgeText}>PENDING</AppText>
                    </View>
                  </View>
                </View>
                <AppText variant="body-sm" color={COLORS.muted} style={{ lineHeight: 20 }}>
                  Your request is being reviewed by an administrator. You cannot submit a new request until the current one is resolved.
                </AppText>
              </View>
            ) : (
              /* Form */
              <View style={s.formCard}>
                <LinearGradient colors={[COLORS.blue, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />

                <AppText variant="h3" style={{ color: COLORS.whiteSoft, marginBottom: 4 }}>New Request</AppText>
                <AppText variant="body-sm" color={COLORS.muted} style={{ marginBottom: 20, lineHeight: 19 }}>
                  Select your reason, then take 3 photos of your face. The school admin will review and approve your new biometric profile.
                </AppText>

                {/* Steps preview */}
                <View style={s.stepsRow}>
                  {[{ n: '1', label: 'Select\nReason' }, { n: '2', label: 'Take\n3 Photos' }, { n: '3', label: 'Admin\nReview' }].map((step, i) => (
                    <React.Fragment key={step.n}>
                      <View style={s.stepItem}>
                        <View style={[s.stepCircle, i === 0 && s.stepCircleActive]}>
                          <AppText style={[s.stepNum, i === 0 && { color: '#fff' }]}>{step.n}</AppText>
                        </View>
                        <AppText variant="caption" color={i === 0 ? COLORS.whiteSoft : COLORS.muted} style={{ textAlign: 'center', lineHeight: 15 }}>
                          {step.label}
                        </AppText>
                      </View>
                      {i < 2 && <View style={s.stepLine} />}
                    </React.Fragment>
                  ))}
                </View>

                {/* Reason selector */}
                <View style={{ gap: 8, marginBottom: 20 }}>
                  <AppText variant="semi" color={COLORS.muted} style={{ fontSize: 13 }}>
                    Reason <AppText variant="semi" color={COLORS.red}>*</AppText>
                  </AppText>
                  <TouchableOpacity onPress={() => setPickerOpen(true)} activeOpacity={0.75}
                    style={[s.pickerBtn, reason ? s.pickerBtnFilled : undefined, reasonError ? s.pickerBtnError : undefined]}>
                    <AppText color={reason ? COLORS.whiteSoft : 'rgba(241,245,255,0.35)'} style={s.pickerBtnText} numberOfLines={1}>
                      {reason || 'Select a reason...'}
                    </AppText>
                    <AppText style={s.pickerChevron}>▾</AppText>
                  </TouchableOpacity>
                  {!!reasonError && (
                    <AppText variant="caption" color={COLORS.red}>{reasonError}</AppText>
                  )}
                </View>

                <Button label="Continue to Camera →" onPress={handleStart} style={{ width: '100%' }} />
              </View>
            )}

            {/* Request history */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <AppText variant="label" style={{ letterSpacing: 1 }}>Request History</AppText>
                {!historyLoading && (
                  <View style={s.sectionCount}>
                    <AppText variant="caption" color={COLORS.muted}>{history.length}</AppText>
                  </View>
                )}
              </View>
              {historyLoading ? (
                <AppText variant="caption" color={COLORS.muted} style={{ paddingVertical: 20, textAlign: 'center' }}>Loading…</AppText>
              ) : history.length === 0 ? (
                <View style={s.empty}>
                  <AppText style={{ fontSize: 32, marginBottom: 8 }}>📋</AppText>
                  <AppText variant="semi" color={COLORS.muted}>No previous requests</AppText>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {history.map((item) => <HistoryCard key={item.id} item={item} />)}
                </View>
              )}
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        )}

        {/* ── Phase: Camera permission ── */}
        {phase === 'permission' && (
          <View style={s.center}>
            <View style={s.card}>
              <LinearGradient colors={[COLORS.blue, COLORS.cyan]} style={s.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <AppText style={{ fontSize: 34 }}>📷</AppText>
              </LinearGradient>
              <AppText variant="h3" style={s.cardTitle}>Camera Access Required</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={s.cardSubtitle}>
                EduGuard needs your camera to capture 3 angles of your face for the re-registration request.
              </AppText>
              <Button label="Allow Camera Access" onPress={handleRequestPermission} style={{ width: '100%' }} />
            </View>
          </View>
        )}

        {/* ── Phase: Camera denied ── */}
        {phase === 'denied' && (
          <View style={s.center}>
            <View style={s.card}>
              <AppText style={{ fontSize: 40, marginBottom: 16 }}>🚫</AppText>
              <AppText variant="h3" style={s.cardTitle}>Camera Access Denied</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={s.cardSubtitle}>
                Please enable camera access in your device settings.
              </AppText>
              <View style={{ marginTop: 8, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', padding: 12, width: '100%' }}>
                <AppText variant="body-sm" color={COLORS.muted} style={{ textAlign: 'center' }}>
                  Settings → Apps → EduGuard → Permissions → Camera
                </AppText>
              </View>
            </View>
          </View>
        )}

        {/* ── Phase: Scanning (camera UI) ── */}
        {isScanning && (
          <>
            <View style={cam.stepCounter}>
              {ANGLES.map((a, i) => (
                <View key={a.key} style={[cam.stepDot, i < angleIndex && cam.stepDotDone, i === angleIndex && cam.stepDotActive]} />
              ))}
              <AppText variant="caption" style={{ marginLeft: 10 }}>
                Step {angleIndex + 1} of 3 — {angle.label}
              </AppText>
            </View>

            <View style={cam.cameraSection}>
              <ScanFrame active={!isCapturing} />
              <View style={cam.directionBadge}>
                <AppText style={cam.directionArrow}>{angle.arrow}</AppText>
                <AppText variant="body-sm" color={COLORS.whiteSoft} style={{ marginLeft: 8 }}>{angle.instruction}</AppText>
              </View>
            </View>

            <View style={cam.bottomPanel}>
              <View style={cam.thumbsRow}>
                {ANGLES.map((a, i) => (
                  <View key={a.key} style={cam.miniThumbWrap}>
                    {photos[i] ? (
                      <Image source={{ uri: photos[i] }} style={cam.miniThumb} resizeMode="cover" />
                    ) : (
                      <View style={[cam.miniThumb, cam.miniThumbEmpty]}>
                        <AppText style={{ fontSize: 16 }}>{a.arrow}</AppText>
                      </View>
                    )}
                    <AppText style={cam.miniThumbLabel}>{a.label}</AppText>
                  </View>
                ))}
              </View>
              <AppText variant="caption" style={{ textAlign: 'center', marginBottom: 6 }}>{angle.instruction}</AppText>
              <AppText variant="caption" color="rgba(245,158,11,0.8)" style={{ textAlign: 'center', marginBottom: 10 }}>
                💡 Good lighting · face inside the oval · look clearly at camera
              </AppText>
              <Button label={isCapturing ? 'Capturing…' : `Capture ${angle.label}`} onPress={handleCapture} loading={isCapturing} style={cam.captureBtn} />
            </View>
          </>
        )}

        {/* ── Phase: Preview ── */}
        {phase === 'preview' && (
          <View style={s.center}>
            <View style={s.card}>
              <LinearGradient colors={[COLORS.blue, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
              <AppText variant="h3" style={s.cardTitle}>Review Your Photos</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={[s.cardSubtitle, { marginBottom: 20 }]}>
                Make sure all 3 angles are clear before submitting.
              </AppText>
              <View style={s.thumbRow}>
                {ANGLES.map((angle, i) => (
                  <View key={angle.key} style={s.thumbWrap}>
                    <Image source={{ uri: photos[i] }} style={s.thumb} resizeMode="cover" />
                    <View style={s.thumbBadge}>
                      <AppText style={{ fontSize: 12, color: COLORS.cyan }}>{angle.arrow}</AppText>
                    </View>
                    <AppText variant="caption" style={{ color: COLORS.muted, fontSize: 10 }}>{angle.label}</AppText>
                  </View>
                ))}
              </View>
              <View style={s.checkList}>
                {ANGLES.map((a) => (
                  <View key={a.key} style={s.checkRow}>
                    <AppText style={{ color: COLORS.green, fontSize: 13 }}>✓</AppText>
                    <AppText variant="body-sm" color={COLORS.whiteSoft}>{a.label} captured</AppText>
                  </View>
                ))}
              </View>
              <Button label="Submit Request" onPress={handleSubmit} style={{ width: '100%', marginTop: 4 }} />
              <TouchableOpacity onPress={handleRetake} activeOpacity={0.75} style={{ marginTop: 16, paddingVertical: 10 }}>
                <AppText style={{ fontFamily: FONTS.bodySemi, fontSize: 13, color: 'rgba(241,245,255,0.45)' }}>Re-take photos</AppText>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Phase: Uploading ── */}
        {phase === 'uploading' && (
          <View style={s.center}>
            <View style={s.card}>
              <SpinningIcon />
              <AppText variant="h3" style={s.cardTitle}>Submitting…</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={s.cardSubtitle}>
                Uploading your 3 photos and sending to the school admin. Please wait.
              </AppText>
            </View>
          </View>
        )}

        {/* ── Phase: Submitted ── */}
        {phase === 'submitted' && (
          <View style={s.center}>
            <View style={[s.card, { borderColor: 'rgba(245,158,11,0.25)' }]}>
              <LinearGradient colors={[COLORS.gold, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
              <LinearGradient colors={[COLORS.gold, '#f97316']} style={s.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <AppText style={{ fontSize: 34 }}>📬</AppText>
              </LinearGradient>
              <AppText variant="h3" style={s.cardTitle}>Request Submitted!</AppText>
              <AppText variant="body-sm" color={COLORS.muted} style={[s.cardSubtitle, { marginBottom: 20 }]}>
                Your 3 photos have been sent to the school admin for review.{'\n'}
                Once approved, your old face data will be replaced.
              </AppText>
              <View style={s.checkList}>
                <View style={s.checkRow}>
                  <AppText style={{ color: COLORS.green, fontSize: 13 }}>✓</AppText>
                  <AppText variant="body-sm" color={COLORS.whiteSoft}>3 photos uploaded successfully</AppText>
                </View>
                <View style={s.checkRow}>
                  <AppText style={{ color: COLORS.green, fontSize: 13 }}>✓</AppText>
                  <AppText variant="body-sm" color={COLORS.whiteSoft}>Re-registration request created</AppText>
                </View>
                <View style={[s.checkRow, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.20)' }]}>
                  <AppText style={{ fontSize: 13 }}>🕐</AppText>
                  <AppText variant="body-sm" color={COLORS.gold}>Awaiting admin approval</AppText>
                </View>
              </View>
              <Button label="Back to Profile" onPress={handleDone} style={{ width: '100%', marginTop: 4 }} />
            </View>
          </View>
        )}

        {/* ── Phase: Error ── */}
        {phase === 'error' && (
          <View style={s.center}>
            <View style={s.card}>
              <AppText style={{ fontSize: 40, marginBottom: 16 }}>❌</AppText>
              <AppText variant="h3" style={s.cardTitle}>Submission Failed</AppText>
              <View style={s.errorBox}>
                <AppText variant="body-sm" style={{ color: '#F87171', textAlign: 'center' }}>{errorMsg}</AppText>
              </View>
              <Button label="Try Again" onPress={handleRetry} style={{ width: '100%' }} />
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Flash overlay */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flashOpacity }]} />

      {/* Reason picker modal */}
      <ReasonPickerModal
        open={pickerOpen}
        selected={reason}
        onSelect={(r) => { setReason(r); setReasonError(''); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

// ── Spinning icon ──────────────────────────────────────────────────────────────

function SpinningIcon() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1100, useNativeDriver: true })).start();
  }, []);
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }], marginBottom: 20 }}>
      <AppText style={{ fontSize: 44 }}>⏳</AppText>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  orb:  { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 280, height: 280, top: -70,  right: -70, backgroundColor: 'rgba(37,99,235,0.09)' },
  orb2: { width: 200, height: 200, bottom: 80, left: -60,  backgroundColor: 'rgba(6,182,212,0.07)' },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 40, height: 40, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(22,29,63,0.75)', alignItems: 'center', justifyContent: 'center' },
  backArrow:   { fontSize: 20, color: COLORS.whiteSoft },
  headerTitle: { flex: 1, textAlign: 'center', color: COLORS.whiteSoft },

  scroll:  { paddingHorizontal: 20, paddingTop: 4 },
  center:  { flex: 1, justifyContent: 'center', padding: 24 },

  card:      { backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'], borderWidth: 1, borderColor: COLORS.border, padding: 24, alignItems: 'center', overflow: 'hidden' },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  cardTitle:    { color: COLORS.whiteSoft, textAlign: 'center', marginBottom: 8 },
  cardSubtitle: { textAlign: 'center', lineHeight: 20 },
  iconCircle:   { width: 72, height: 72, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  errorBox:     { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', padding: 12, width: '100%', marginBottom: 20, marginTop: 4 },

  // Steps preview
  stepsRow:         { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 22 },
  stepItem:         { alignItems: 'center', gap: 6, flex: 0 },
  stepCircle:       { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(241,245,255,0.08)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: COLORS.blue, borderColor: COLORS.blue },
  stepNum:          { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.muted },
  stepLine:         { flex: 1, height: 1, backgroundColor: COLORS.border, marginBottom: 20 },

  // Form
  formCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'],
    borderWidth: 1, borderColor: COLORS.border,
    padding: 20, paddingTop: 24, marginBottom: 24, overflow: 'hidden',
  },
  pendingCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'],
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.22)',
    padding: 20, paddingTop: 24, marginBottom: 24, overflow: 'hidden',
  },
  pendingBadge: {
    alignSelf: 'flex-start', marginTop: 5,
    backgroundColor: 'rgba(245,158,11,0.14)', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.32)',
    paddingHorizontal: 10, paddingVertical: 3,
  },
  pendingBadgeText: { fontFamily: FONTS.bodySemi, fontSize: 10, color: COLORS.gold, letterSpacing: 0.8 },

  // Picker
  pickerBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  pickerBtnFilled: { borderColor: 'rgba(59,130,246,0.40)' },
  pickerBtnError:  { borderColor: 'rgba(239,68,68,0.50)' },
  pickerBtnText:   { flex: 1, fontFamily: FONTS.body, fontSize: 14 },
  pickerChevron:   { fontSize: 16, color: COLORS.muted },

  // Photo preview
  thumbRow:  { flexDirection: 'row', gap: 12, marginBottom: 16 },
  thumbWrap: { flex: 1, alignItems: 'center', gap: 6 },
  thumb:     { width: '100%', aspectRatio: 3 / 4, borderRadius: RADIUS.md, borderWidth: 2, borderColor: COLORS.green },
  thumbBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(10,15,46,0.75)', borderRadius: RADIUS.full, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },

  // Checklist
  checkList: { width: '100%', gap: 8, marginBottom: 20 },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(16,185,129,0.07)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(16,185,129,0.16)', paddingHorizontal: 14, paddingVertical: 10 },

  // Section / History
  section:       { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionCount:  { backgroundColor: COLORS.navyCard, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 9, paddingVertical: 2 },
  empty:         { alignItems: 'center', paddingVertical: 36 },

  historyCard:    { backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, padding: 14, gap: 8 },
  historyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, flexShrink: 0 },
  statusIcon:     { fontSize: 10 },
  statusLabel:    { fontFamily: FONTS.bodySemi, fontSize: 11 },
  reviewBlock:    { borderRadius: RADIUS.md, borderWidth: 1, padding: 10, gap: 2 },
});

// ── Camera styles ──────────────────────────────────────────────────────────────

const cam = StyleSheet.create({
  stepCounter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 8, gap: 6 },
  stepDot:        { width: 8,  height: 8,  borderRadius: 4, backgroundColor: 'rgba(241,245,255,0.20)' },
  stepDotDone:    { backgroundColor: COLORS.green },
  stepDotActive:  { width: 22, backgroundColor: COLORS.cyan },
  cameraSection:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frameContainer: { width: FRAME_W + PAD * 2, height: FRAME_H + PAD * 2, alignItems: 'center', justifyContent: 'center' },
  cornerBracket:  { position: 'absolute', width: BRACKET, height: BRACKET },
  bracketArm:     { position: 'absolute', backgroundColor: COLORS.cyan, borderRadius: 2 },
  ovalFrame:      { width: FRAME_W, height: FRAME_H, borderRadius: FRAME_W / 2, borderWidth: 2.5, borderColor: COLORS.cyan, overflow: 'hidden' },
  scanBeam:       { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(6,182,212,0.8)' },
  directionBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 22, backgroundColor: 'rgba(10,15,46,0.78)', borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 20, paddingVertical: 10 },
  directionArrow: { fontSize: 18, color: COLORS.cyan, fontFamily: FONTS.heading },
  bottomPanel:    { backgroundColor: 'rgba(10,15,46,0.88)', borderTopWidth: 1, borderTopColor: COLORS.border, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  captureBtn:     { width: '100%' },
  thumbsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 14 },
  miniThumbWrap:  { alignItems: 'center', gap: 4 },
  miniThumb:      { width: 56, height: 70, borderRadius: RADIUS.sm, borderWidth: 2, borderColor: COLORS.border },
  miniThumbEmpty: { backgroundColor: 'rgba(241,245,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  miniThumbLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.muted },
});

// ── Picker modal styles ────────────────────────────────────────────────────────

const pm = StyleSheet.create({
  backdrop:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,7,20,0.78)' },
  sheet:           { backgroundColor: COLORS.navyCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border, paddingBottom: 28 },
  dragHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(241,245,255,0.18)', alignSelf: 'center', marginTop: 12, marginBottom: 6 },
  title:           { color: COLORS.whiteSoft, paddingHorizontal: 20, paddingTop: 8, marginBottom: 4 },
  subtitle:        { paddingHorizontal: 20, marginBottom: 10 },
  divider:         { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  optionRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  optionRowActive: { backgroundColor: 'rgba(37,99,235,0.08)' },
  radioOuter:      { width: 20, height: 20, borderRadius: RADIUS.full, borderWidth: 2, borderColor: 'rgba(241,245,255,0.25)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  radioOuterActive: { borderColor: COLORS.blue, backgroundColor: 'rgba(37,99,235,0.12)' },
  radioInner:      { width: 9, height: 9, borderRadius: RADIUS.full, backgroundColor: COLORS.blue },
  cancelBtn:       { alignItems: 'center', paddingVertical: 16 },
});
