import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

// ── Types ───────────────────────────────────────────────────────────────────────
type RequestStatus = 'Pending' | 'Approved' | 'Rejected';

interface ReRequest {
  id: string;
  reason: string;
  notes?: string;
  submittedAt: string;
  status: RequestStatus;
  reviewedAt?: string;
  reviewNote?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────────
const REASONS = [
  'Face not recognized during exams',
  'Significant change in appearance',
  'Poor quality of previous registration',
  'Added or removed glasses',
  'Medical or physical changes',
  'Other reason',
] as const;

const STATUS_CFG: Record<
  RequestStatus,
  { color: string; bg: string; border: string; icon: string }
> = {
  Pending:  { color: COLORS.gold,  bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)',  icon: '⏳' },
  Approved: { color: COLORS.green, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '✓'  },
  Rejected: { color: COLORS.red,   bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',  icon: '✗'  },
};

// ── Mock history (pre-existing requests) ────────────────────────────────────────
const INITIAL_HISTORY: ReRequest[] = [
  {
    id: 'h1',
    reason: 'Poor quality of previous registration',
    notes: 'My face was not detected clearly during the morning exam sessions.',
    submittedAt: 'Jun 15, 2026',
    status: 'Approved',
    reviewedAt: 'Jun 18, 2026',
    reviewNote: 'Request approved. Please complete re-registration within 7 days via the face registration screen.',
  },
  {
    id: 'h2',
    reason: 'Significant change in appearance',
    submittedAt: 'May 30, 2026',
    status: 'Rejected',
    reviewedAt: 'Jun 2, 2026',
    reviewNote: 'The original registration images are sufficiently clear. Please contact your instructor if recognition issues persist.',
  },
];

// ── Reason picker modal ─────────────────────────────────────────────────────────
function ReasonPickerModal({
  open,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean;
  selected: string;
  onSelect: (r: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={pm.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={pm.sheet}>
          <View style={pm.dragHandle} />

          <AppText variant="h3" style={pm.sheetTitle}>
            Reason for Request
          </AppText>
          <AppText variant="body-sm" color={COLORS.muted} style={pm.sheetSubtitle}>
            Select the reason that best describes your situation.
          </AppText>

          <View style={pm.divider} />

          {REASONS.map((r) => {
            const isSelected = selected === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => onSelect(r)}
                activeOpacity={0.75}
                style={[pm.optionRow, isSelected && pm.optionRowSelected]}
              >
                {/* Radio button */}
                <View style={[pm.radioOuter, isSelected && pm.radioOuterActive]}>
                  {isSelected && <View style={pm.radioInner} />}
                </View>

                <AppText
                  variant="body"
                  color={isSelected ? COLORS.whiteSoft : 'rgba(241,245,255,0.65)'}
                  style={{ flex: 1 }}
                >
                  {r}
                </AppText>
              </TouchableOpacity>
            );
          })}

          <View style={pm.divider} />

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={pm.cancelBtn}>
            <AppText variant="semi" color={COLORS.muted}>
              Cancel
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Request history card ────────────────────────────────────────────────────────
function RequestCard({ item }: { item: ReRequest }) {
  const sc = STATUS_CFG[item.status];

  return (
    <View style={[s.historyCard, { borderLeftColor: sc.color }]}>
      {/* Date + status row */}
      <View style={s.cardRow}>
        <AppText variant="caption" color={COLORS.muted}>
          Submitted {item.submittedAt}
        </AppText>
        <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <AppText style={[s.statusIcon, { color: sc.color }]}>{sc.icon}</AppText>
          <AppText style={[s.statusLabel, { color: sc.color }]}>{item.status}</AppText>
        </View>
      </View>

      {/* Reason */}
      <AppText variant="semi" color={COLORS.whiteSoft} style={s.historyReason}>
        {item.reason}
      </AppText>

      {/* Notes (if any) */}
      {item.notes && (
        <AppText
          variant="body-sm"
          color="rgba(241,245,255,0.50)"
          numberOfLines={2}
          style={s.historyNotes}
        >
          "{item.notes}"
        </AppText>
      )}

      {/* Review response (Approved / Rejected) */}
      {item.reviewedAt && (
        <View style={[s.reviewBlock, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <AppText variant="caption" color={COLORS.muted}>
            Reviewed on {item.reviewedAt}
          </AppText>
          {item.reviewNote && (
            <AppText
              variant="body-sm"
              color={sc.color}
              style={{ marginTop: 4, lineHeight: 18 }}
            >
              {item.reviewNote}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function FaceReRegistrationScreen() {
  const navigation = useNavigation();
  // Form
  const [reason, setReason]           = useState('');
  const [notes, setNotes]             = useState('');
  const [reasonError, setReasonError] = useState('');
  const [notesFocused, setNotesFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen]   = useState(false);

  // History (mutable — new requests get prepended)
  const [history, setHistory] = useState<ReRequest[]>(INITIAL_HISTORY);

  // Success banner
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  const triggerBanner = () => {
    setBannerVisible(true);
    Animated.sequence([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(3200),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start(() => setBannerVisible(false));
  };

  const handleSubmit = async () => {
    if (!reason) {
      setReasonError('Please select a reason before submitting.');
      return;
    }
    setReasonError('');
    setIsSubmitting(true);

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 1500));

    const newReq: ReRequest = {
      id: `req_${Date.now()}`,
      reason,
      notes: notes.trim() || undefined,
      submittedAt: 'Jun 27, 2026',
      status: 'Pending',
    };

    setHistory((prev) => [newReq, ...prev]);
    setReason('');
    setNotes('');
    setIsSubmitting(false);
    triggerBanner();
  };

  const hasPending = history.some((r) => r.status === 'Pending');
  const pendingItem = history.find((r) => r.status === 'Pending');

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} activeOpacity={0.75} onPress={() => navigation.goBack()}>
            <AppText style={s.backArrow}>←</AppText>
          </TouchableOpacity>
          <AppText variant="h3" style={s.headerTitle}>
            Re-registration Request
          </AppText>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Success banner ── */}
            {bannerVisible && (
              <Animated.View style={[s.successBanner, { opacity: bannerOpacity }]}>
                <AppText style={s.successBannerText}>✓</AppText>
                <View>
                  <AppText style={s.successBannerTitle}>Request Submitted</AppText>
                  <AppText style={s.successBannerSub}>
                    Pending review by an administrator.
                  </AppText>
                </View>
              </Animated.View>
            )}

            {/* ── Form or Pending notice ── */}
            {hasPending ? (
              /* Pending notice — shown after submission */
              <View style={s.pendingNotice}>
                <LinearGradient
                  colors={[COLORS.gold, '#F97316']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.cardAccentBar}
                />

                <View style={s.pendingIconRow}>
                  <AppText style={s.pendingHourglass}>⏳</AppText>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" style={{ color: COLORS.whiteSoft }}>
                      Request Under Review
                    </AppText>
                    <View style={[s.pendingBadge, { marginTop: 5 }]}>
                      <AppText style={s.pendingBadgeText}>PENDING</AppText>
                    </View>
                  </View>
                </View>

                <AppText
                  variant="body-sm"
                  color={COLORS.muted}
                  style={{ lineHeight: 20, marginBottom: 14 }}
                >
                  Your re-registration request is being reviewed. You cannot submit
                  a new request until the current one is resolved.
                </AppText>

                {pendingItem && (
                  <View style={s.pendingDetail}>
                    <AppText variant="caption" color={COLORS.muted}>
                      Reason
                    </AppText>
                    <AppText variant="body-sm" color={COLORS.whiteSoft}>
                      {pendingItem.reason}
                    </AppText>
                    <AppText
                      variant="caption"
                      color={COLORS.muted}
                      style={{ marginTop: 8 }}
                    >
                      Submitted {pendingItem.submittedAt}
                    </AppText>
                  </View>
                )}
              </View>
            ) : (
              /* New request form */
              <View style={s.formCard}>
                <LinearGradient
                  colors={[COLORS.blue, COLORS.cyan]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.cardAccentBar}
                />

                <AppText variant="h3" style={{ color: COLORS.whiteSoft, marginBottom: 4 }}>
                  New Request
                </AppText>
                <AppText
                  variant="body-sm"
                  color={COLORS.muted}
                  style={{ marginBottom: 20, lineHeight: 19 }}
                >
                  Request a re-registration of your biometric face profile. Your request
                  will be reviewed by an administrator.
                </AppText>

                {/* ── Reason selector ── */}
                <View style={s.fieldGroup}>
                  <AppText variant="semi" color={COLORS.muted} style={s.fieldLabel}>
                    Reason for Request{' '}
                    <AppText variant="semi" color={COLORS.red}>
                      *
                    </AppText>
                  </AppText>

                  <TouchableOpacity
                    onPress={() => setPickerOpen(true)}
                    activeOpacity={0.75}
                    style={[
                      s.pickerBtn,
                      reason ? s.pickerBtnFilled : undefined,
                      reasonError ? s.pickerBtnError : undefined,
                    ]}
                  >
                    <AppText
                      color={reason ? COLORS.whiteSoft : 'rgba(241,245,255,0.35)'}
                      style={s.pickerBtnText}
                      numberOfLines={1}
                    >
                      {reason || 'Select a reason...'}
                    </AppText>
                    <AppText style={s.pickerChevron}>▾</AppText>
                  </TouchableOpacity>

                  {!!reasonError && (
                    <AppText variant="caption" color={COLORS.red} style={{ marginTop: 4 }}>
                      {reasonError}
                    </AppText>
                  )}
                </View>

                {/* ── Additional notes ── */}
                <View style={s.fieldGroup}>
                  <AppText variant="semi" color={COLORS.muted} style={s.fieldLabel}>
                    Additional Notes{' '}
                    <AppText variant="caption" color={COLORS.muted}>
                      (optional)
                    </AppText>
                  </AppText>

                  <View
                    style={[
                      s.notesContainer,
                      notesFocused && s.notesContainerFocused,
                    ]}
                  >
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      onFocus={() => setNotesFocused(true)}
                      onBlur={() => setNotesFocused(false)}
                      placeholder="Describe your issue or provide additional context…"
                      placeholderTextColor="rgba(241,245,255,0.35)"
                      multiline
                      textAlignVertical="top"
                      style={s.notesInput}
                    />
                  </View>
                </View>

                {/* ── Info notice ── */}
                <View style={s.infoBox}>
                  <AppText style={s.infoIcon}>ℹ</AppText>
                  <AppText variant="caption" color={COLORS.muted} style={{ flex: 1, lineHeight: 17 }}>
                    Your current face profile will remain active until the request is
                    approved and re-registration is completed.
                  </AppText>
                </View>

                {/* ── Submit ── */}
                <Button
                  label="Submit Request"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </View>
            )}

            {/* ── Request history ── */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <AppText variant="label" style={{ letterSpacing: 1 }}>
                  Request History
                </AppText>
                <View style={s.sectionCount}>
                  <AppText variant="caption" color={COLORS.muted}>
                    {history.length}
                  </AppText>
                </View>
              </View>

              {history.length === 0 ? (
                <View style={s.emptyState}>
                  <AppText style={{ fontSize: 36, marginBottom: 12 }}>📋</AppText>
                  <AppText variant="semi" color={COLORS.muted}>
                    No previous requests
                  </AppText>
                </View>
              ) : (
                <View style={s.historyList}>
                  {history.map((item) => (
                    <RequestCard key={item.id} item={item} />
                  ))}
                </View>
              )}
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Reason picker modal */}
      <ReasonPickerModal
        open={pickerOpen}
        selected={reason}
        onSelect={(r) => {
          setReason(r);
          setReasonError('');
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

// ── Screen styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 280, height: 280, top: -70,  right: -70, backgroundColor: 'rgba(37,99,235,0.09)' },
  orb2: { width: 200, height: 200, bottom: 80, left: -60,  backgroundColor: 'rgba(6,182,212,0.07)' },

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
  backArrow: { fontSize: 20, color: COLORS.whiteSoft },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.whiteSoft,
  },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingTop: 4 },

  // Success banner
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.32)',
    padding: 14,
    marginBottom: 16,
  },
  successBannerText: { fontSize: 22, color: COLORS.green },
  successBannerTitle: {
    fontFamily: FONTS.bodySemi,
    fontSize: 14,
    color: COLORS.whiteSoft,
  },
  successBannerSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },

  // Shared card accent bar
  cardAccentBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
  },

  // Form card
  formCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    paddingTop: 24,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },

  // Pending notice card
  pendingNotice: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    padding: 20,
    paddingTop: 24,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  pendingIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  pendingHourglass: { fontSize: 34 },
  pendingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 10,
    color: COLORS.gold,
    letterSpacing: 0.8,
  },
  pendingDetail: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
    padding: 12,
    gap: 3,
  },

  // Form fields
  fieldGroup: { gap: 8, marginBottom: 16 },
  fieldLabel: { fontSize: 13 },

  // Reason picker button
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  pickerBtnFilled: {
    borderColor: 'rgba(59,130,246,0.40)',
  },
  pickerBtnError: {
    borderColor: 'rgba(239,68,68,0.50)',
  },
  pickerBtnText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  pickerChevron: {
    fontSize: 16,
    color: COLORS.muted,
  },

  // Notes textarea
  notesContainer: {
    backgroundColor: COLORS.navy,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notesContainerFocused: {
    borderColor: 'rgba(59,130,246,0.50)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  notesInput: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.whiteSoft,
    minHeight: 80,
    padding: 0,
    margin: 0,
  },

  // Info notice
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(6,182,212,0.07)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.18)',
    padding: 12,
    marginBottom: 20,
  },
  infoIcon: { fontSize: 14, color: COLORS.cyan, marginTop: 1 },

  // Section header
  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionCount: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },

  // History
  historyList: { gap: 12 },
  historyCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusIcon:  { fontSize: 10 },
  statusLabel: { fontFamily: FONTS.bodySemi, fontSize: 11 },

  historyReason: { fontSize: 14 },
  historyNotes:  { lineHeight: 18 },

  reviewBlock: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
});

// ── Picker modal styles ─────────────────────────────────────────────────────────
const pm = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,7,20,0.78)',
  },
  sheet: {
    backgroundColor: COLORS.navyCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    paddingBottom: 28,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(241,245,255,0.18)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  sheetTitle: {
    color: COLORS.whiteSoft,
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 4,
  },
  sheetSubtitle: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 0,
    marginVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionRowSelected: {
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: 'rgba(241,245,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioOuterActive: {
    borderColor: COLORS.blue,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.blue,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
