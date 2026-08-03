import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, GRADIENTS, RADIUS } from '../../constants/theme';
import { getExamSlotsByClass, getMyClasses, ExamSlot, MyClass } from '../../api/schedule';

// ── Types ─────────────────────────────────────────────────────────────────────

type BadgeType = 'upcoming' | 'now' | 'past' | 'cancelled';

interface ExamSlotWithClass extends ExamSlot {
  className: string;
}

interface DayGroup {
  label: string;
  slots: ExamSlotWithClass[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDayLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) return 'TODAY';
  if (isSameDay(date, tomorrow)) return 'TOMORROW';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function computeBadge(slot: ExamSlot): BadgeType {
  if (slot.status === 'Cancelled') return 'cancelled';
  const now = Date.now();
  const start = new Date(slot.startTime).getTime();
  const end = new Date(slot.endTime).getTime();
  if (now > end) return 'past';
  if (now >= start && now <= end) return 'now';
  return 'upcoming';
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function groupByDay(slots: ExamSlotWithClass[]): DayGroup[] {
  const map = new Map<string, ExamSlotWithClass[]>();

  const sorted = [...slots].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );

  for (const slot of sorted) {
    const label = getDayLabel(slot.startTime);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(slot);
  }

  return Array.from(map.entries()).map(([label, s]) => ({ label, slots: s }));
}

// ── Badge config ──────────────────────────────────────────────────────────────

const BADGE_CFG: Record<
  BadgeType,
  { bg: string; border: string; text: string; label: string }
> = {
  upcoming: {
    bg: 'rgba(37,99,235,0.13)',
    border: 'rgba(59,130,246,0.30)',
    text: COLORS.blueBright,
    label: 'Upcoming',
  },
  now: {
    bg: 'rgba(16,185,129,0.13)',
    border: 'rgba(16,185,129,0.30)',
    text: COLORS.green,
    label: 'Live',
  },
  past: {
    bg: 'rgba(241,245,255,0.05)',
    border: 'rgba(241,245,255,0.10)',
    text: 'rgba(241,245,255,0.35)',
    label: 'Past',
  },
  cancelled: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.28)',
    text: COLORS.red,
    label: 'Cancelled',
  },
};

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ type }: { type: BadgeType }) {
  const cfg = BADGE_CFG[type];
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {type === 'now' && <View style={s.liveDot} />}
      <AppText style={[s.badgeText, { color: cfg.text }]}>{cfg.label}</AppText>
    </View>
  );
}

// ── Exam Card ─────────────────────────────────────────────────────────────────

function ExamCard({ slot }: { slot: ExamSlotWithClass }) {
  const badge = computeBadge(slot);
  const isPast = badge === 'past';
  const accentColor = badge === 'now' ? COLORS.green : badge === 'cancelled' ? COLORS.red : COLORS.gold;
  const duration = slot.expectedDurationMinutes
    ? `  ·  ${slot.expectedDurationMinutes} min`
    : '';

  return (
    <View style={[s.card, isPast && s.cardPast]}>
      {/* Left accent bar */}
      <View style={[s.cardAccent, { backgroundColor: accentColor }]} />

      <View style={s.cardBody}>
        {/* Top row: name + badge */}
        <View style={s.cardTopRow}>
          <AppText
            variant="semi"
            color={isPast ? 'rgba(241,245,255,0.45)' : COLORS.whiteSoft}
            numberOfLines={2}
            style={s.examName}
          >
            {slot.examName}
          </AppText>
          <StatusBadge type={badge} />
        </View>

        {/* Class chip */}
        <View style={s.classChip}>
          <AppText style={s.classChipText}>{slot.className}</AppText>
        </View>

        {/* Time */}
        <View style={s.metaRow}>
          <AppText style={s.metaIcon}>🕐</AppText>
          <AppText variant="body-sm" color={isPast ? 'rgba(241,245,255,0.30)' : COLORS.muted}>
            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}{duration}
          </AppText>
        </View>

        {/* Lecturer */}
        {slot.lecturer?.fullName ? (
          <View style={s.metaRow}>
            <AppText style={s.metaIcon}>👤</AppText>
            <AppText variant="body-sm" color={isPast ? 'rgba(241,245,255,0.30)' : COLORS.muted}>
              {slot.lecturer.fullName}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Day Group Header ──────────────────────────────────────────────────────────

function DayHeader({ label }: { label: string }) {
  const isToday    = label === 'TODAY';
  const isTomorrow = label === 'TOMORROW';
  const color = isToday ? COLORS.cyan : isTomorrow ? '#818cf8' : COLORS.muted;

  return (
    <View style={s.dayHeader}>
      <AppText style={[s.dayLabel, { color }]}>{label}</AppText>
      <View style={s.daySep} />
    </View>
  );
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow({ slots }: { slots: ExamSlotWithClass[] }) {
  const upcoming = slots.filter((s) => computeBadge(s) === 'upcoming').length;
  const live     = slots.filter((s) => computeBadge(s) === 'now').length;

  return (
    <View style={s.statsRow}>
      <StatCard label="Total" value={slots.length} colors={GRADIENTS.heading} />
      <StatCard label="Upcoming" value={upcoming}  colors={['#7c3aed', '#4f46e5']} />
      <StatCard label="Live Now" value={live}       colors={GRADIENTS.success} />
    </View>
  );
}

function StatCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: number;
  colors: readonly [string, string];
}) {
  return (
    <View style={s.statCard}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.statAccentBar}
      />
      <AppText style={s.statValue}>{value}</AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const [groups,     setGroups]     = useState<DayGroup[]>([]);
  const [allSlots,   setAllSlots]   = useState<ExamSlotWithClass[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failCount,  setFailCount]  = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setFatalError(null);
    setFailCount(0);

    let classes: MyClass[] = [];
    try {
      classes = await getMyClasses();
    } catch (e: any) {
      setFatalError(e?.message ?? 'Failed to load your classes');
      return;
    }

    if (classes.length === 0) {
      setGroups([]);
      setAllSlots([]);
      return;
    }

    const results = await Promise.allSettled(
      classes.map((cls) =>
        getExamSlotsByClass(cls.id).then((slots) =>
          slots.map((sl) => ({ ...sl, className: cls.name })),
        ),
      ),
    );

    let errors = 0;
    const combined: ExamSlotWithClass[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') combined.push(...r.value);
      else errors++;
    }

    setFailCount(errors);
    setAllSlots(combined);
    setGroups(groupByDay(combined));
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      {/* Decorative orbs */}
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <AppText variant="h2">Exam Schedule</AppText>
          <AppText variant="caption">Your upcoming exams</AppText>
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={COLORS.blueBright} />
            <AppText variant="caption" style={{ marginTop: 10 }}>
              Loading exams…
            </AppText>
          </View>
        ) : fatalError ? (
          <View style={s.centered}>
            <AppText style={s.fatalIcon}>⚠️</AppText>
            <AppText variant="body-sm" color={COLORS.red} style={s.fatalText}>
              {fatalError}
            </AppText>
            <TouchableOpacity
              style={s.retryBtn}
              activeOpacity={0.78}
              onPress={() => {
                setLoading(true);
                loadData().finally(() => setLoading(false));
              }}
            >
              <AppText style={s.retryText}>Try Again</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Stats */}
            {allSlots.length > 0 && <StatsRow slots={allSlots} />}

            {/* Partial error banner */}
            {failCount > 0 && (
              <View style={s.warnBanner}>
                <AppText style={{ fontSize: 13 }}>⚠️</AppText>
                <AppText variant="caption" color={COLORS.gold}>
                  Could not load exams for {failCount} class{failCount > 1 ? 'es' : ''}
                </AppText>
              </View>
            )}

            <ScrollView
              style={s.scroll}
              contentContainerStyle={s.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={COLORS.blueBright}
                  colors={[COLORS.blueBright]}
                />
              }
              showsVerticalScrollIndicator={false}
            >
              {groups.length === 0 ? (
                <View style={s.emptyState}>
                  <AppText style={s.emptyIcon}>📋</AppText>
                  <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>
                    No Exams Scheduled
                  </AppText>
                  <AppText
                    variant="body-sm"
                    color={COLORS.muted}
                    style={{ textAlign: 'center' }}
                  >
                    You have no upcoming exams at this time.{'\n'}Pull down to refresh.
                  </AppText>
                </View>
              ) : (
                groups.map((group) => (
                  <View key={group.label}>
                    <DayHeader label={group.label} />
                    {group.slots.map((slot) => (
                      <ExamCard key={slot.id} slot={slot} />
                    ))}
                  </View>
                ))
              )}
              <View style={{ height: 32 }} />
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  // Orbs
  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: {
    width: 280,
    height: 280,
    top: -60,
    right: -60,
    backgroundColor: 'rgba(37,99,235,0.09)',
  },
  orb2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -60,
    backgroundColor: 'rgba(6,182,212,0.07)',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 2,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  statAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  statValue: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.whiteSoft,
    lineHeight: 28,
  },

  // Warn banner
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  // Day header
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
    gap: 10,
  },
  dayLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  daySep: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPast: {
    opacity: 0.50,
  },
  cardAccent: {
    width: 3,
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 5,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  examName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  // Class chip
  classChip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.blueGlow,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  classChipText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 10,
    color: COLORS.blueBright,
    letterSpacing: 0.3,
  },

  // Meta rows
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: { fontSize: 12 },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.green,
  },

  // Loading / error
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fatalIcon: { fontSize: 40 },
  fatalText: {
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(37,99,235,0.14)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.32)',
  },
  retryText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.blueBright,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 72,
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
});
