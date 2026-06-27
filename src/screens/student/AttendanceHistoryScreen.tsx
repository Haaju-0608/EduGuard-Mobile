import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

// ── Types ───────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'Present' | 'Absent' | 'Late';
type ItemType = 'Class' | 'Exam';

interface AttendanceRecord {
  id: string;
  date: string;       // "Jun 27"
  dayOfWeek: string;  // "Friday"
  subject: string;
  type: ItemType;
  time: string;
  room: string;
  status: AttendanceStatus;
  checkInTime?: string;
  note?: string;
}

// ── Mock data ───────────────────────────────────────────────────────────────────
const MOCK_RECORDS: AttendanceRecord[] = [
  { id: '1',  date: 'Jun 27', dayOfWeek: 'Friday',    subject: 'Software Engineering',     type: 'Class', time: '09:30 – 11:00', room: 'Room A.501',  status: 'Late',    checkInTime: '09:52' },
  { id: '2',  date: 'Jun 25', dayOfWeek: 'Wednesday', subject: 'Database Systems',          type: 'Class', time: '13:00 – 14:30', room: 'Room B.301',  status: 'Present', checkInTime: '12:58' },
  { id: '3',  date: 'Jun 25', dayOfWeek: 'Wednesday', subject: 'Advanced Mathematics',      type: 'Class', time: '07:30 – 09:00', room: 'Room B.204',  status: 'Present', checkInTime: '07:25' },
  { id: '4',  date: 'Jun 24', dayOfWeek: 'Tuesday',   subject: 'Advanced Mathematics',      type: 'Class', time: '07:30 – 09:00', room: 'Room B.204',  status: 'Absent',  note: 'No check-in recorded' },
  { id: '5',  date: 'Jun 23', dayOfWeek: 'Monday',    subject: 'Computer Networks',         type: 'Class', time: '13:00 – 14:30', room: 'Room C.201',  status: 'Present', checkInTime: '12:57' },
  { id: '6',  date: 'Jun 20', dayOfWeek: 'Friday',    subject: 'Computer Networks',         type: 'Exam',  time: '08:00 – 10:00', room: 'Exam Hall 1', status: 'Present', checkInTime: '07:55' },
  { id: '7',  date: 'Jun 18', dayOfWeek: 'Wednesday', subject: 'Operating Systems',         type: 'Class', time: '09:30 – 11:00', room: 'Room B.401',  status: 'Present', checkInTime: '09:28' },
  { id: '8',  date: 'Jun 17', dayOfWeek: 'Tuesday',   subject: 'Software Engineering',     type: 'Class', time: '09:30 – 11:00', room: 'Room A.501',  status: 'Late',    checkInTime: '10:05' },
  { id: '9',  date: 'Jun 16', dayOfWeek: 'Monday',    subject: 'Database Systems',          type: 'Class', time: '13:00 – 14:30', room: 'Room B.301',  status: 'Present', checkInTime: '12:59' },
  { id: '10', date: 'Jun 15', dayOfWeek: 'Friday',    subject: 'Software Engineering',     type: 'Exam',  time: '14:00 – 16:00', room: 'Exam Hall 2', status: 'Present', checkInTime: '13:58' },
  { id: '11', date: 'Jun 12', dayOfWeek: 'Tuesday',   subject: 'Advanced Mathematics',      type: 'Class', time: '07:30 – 09:00', room: 'Room B.204',  status: 'Absent',  note: 'Medical leave approved' },
  { id: '12', date: 'Jun 10', dayOfWeek: 'Monday',    subject: 'Computer Networks',         type: 'Class', time: '13:00 – 14:30', room: 'Room C.201',  status: 'Present', checkInTime: '12:55' },
];

// ── Config ──────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  AttendanceStatus,
  { color: string; bg: string; border: string; icon: string; label: string }
> = {
  Present: { color: COLORS.green,    bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.28)',  icon: '✓',  label: 'Present' },
  Late:    { color: COLORS.gold,     bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)',  icon: '⏰', label: 'Late'    },
  Absent:  { color: COLORS.red,      bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.28)',   icon: '✗',  label: 'Absent'  },
};

const TYPE_CFG: Record<
  ItemType,
  { text: string; bg: string; border: string }
> = {
  Class: { text: COLORS.blueBright,  bg: 'rgba(37,99,235,0.10)',   border: 'rgba(37,99,235,0.28)'   },
  Exam:  { text: COLORS.gold,        bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.28)'  },
};

// ── Summary card ────────────────────────────────────────────────────────────────
function SummaryCard({ records }: { records: AttendanceRecord[] }) {
  const total   = records.length;
  const present = records.filter((r) => r.status === 'Present').length;
  const late    = records.filter((r) => r.status === 'Late').length;
  const absent  = records.filter((r) => r.status === 'Absent').length;
  const rate    = total > 0 ? ((present + late) / total) * 100 : 0;

  const stats = [
    { icon: '✓',  count: present, label: 'Present', cfg: STATUS_CFG.Present },
    { icon: '⏰', count: late,    label: 'Late',    cfg: STATUS_CFG.Late    },
    { icon: '✗',  count: absent,  label: 'Absent',  cfg: STATUS_CFG.Absent  },
  ];

  return (
    <View style={s.summaryCard}>
      <LinearGradient
        colors={[COLORS.green, COLORS.cyan]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.cardAccentBar}
      />

      <View style={s.summaryTop}>
        <View>
          <AppText variant="label" style={{ letterSpacing: 1 }}>
            Attendance Rate
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 4 }}>
            <AppText style={s.rateNum}>{rate.toFixed(1)}</AppText>
            <AppText style={s.ratePct}>%</AppText>
          </View>
        </View>
        <View style={s.summaryMeta}>
          <AppText variant="caption">June 2026</AppText>
          <AppText variant="caption" color={COLORS.muted}>
            {total} sessions
          </AppText>
        </View>
      </View>

      {/* Segmented progress bar */}
      <View style={s.progressBar}>
        <View style={{ flex: present, backgroundColor: COLORS.green }} />
        <View style={{ flex: late, backgroundColor: COLORS.gold }} />
        <View style={{ flex: absent || 0.001, backgroundColor: COLORS.red }} />
      </View>

      {/* Stat chips */}
      <View style={s.statRow}>
        {stats.map((st) => (
          <View
            key={st.label}
            style={[s.statChip, { backgroundColor: st.cfg.bg, borderColor: st.cfg.border }]}
          >
            <AppText style={[s.statIcon, { color: st.cfg.color }]}>{st.icon}</AppText>
            <AppText style={[s.statCount, { color: st.cfg.color }]}>{st.count}</AppText>
            <AppText variant="caption" color={COLORS.muted}>
              {st.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Record card ─────────────────────────────────────────────────────────────────
function RecordCard({ item }: { item: AttendanceRecord }) {
  const sc   = STATUS_CFG[item.status];
  const tc   = TYPE_CFG[item.type];
  const isPast = true; // all records are past

  const [dayNum, month] = item.date.split(' ');
  const dayAbbr = item.dayOfWeek.slice(0, 3);

  return (
    <View style={s.recordCard}>
      {/* Date column */}
      <View style={s.dateCol}>
        <AppText style={[s.dayNum, { color: sc.color }]}>{dayNum}</AppText>
        <AppText style={s.dayMon}>{month}</AppText>
        <AppText style={s.dayAbbr}>{dayAbbr}</AppText>
      </View>

      <View style={s.dateDivider} />

      {/* Content */}
      <View style={s.recordContent}>
        {/* Subject + status badge */}
        <View style={s.recordTopRow}>
          <AppText
            variant="semi"
            numberOfLines={1}
            color={item.status === 'Absent' ? 'rgba(241,245,255,0.45)' : COLORS.whiteSoft}
            style={s.recordSubject}
          >
            {item.subject}
          </AppText>
          <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <AppText style={[s.statusIcon, { color: sc.color }]}>{sc.icon}</AppText>
            <AppText style={[s.statusLabel, { color: sc.color }]}>{sc.label}</AppText>
          </View>
        </View>

        {/* Time + room */}
        <AppText
          variant="caption"
          color={item.status === 'Absent' ? 'rgba(241,245,255,0.30)' : 'rgba(241,245,255,0.55)'}
        >
          🕐 {item.time}  ·  📍 {item.room}
        </AppText>

        {/* Type badge + check-in info */}
        <View style={s.recordMeta}>
          <View style={[s.typeBadge, { backgroundColor: tc.bg, borderColor: tc.border }]}>
            <AppText style={[s.typeBadgeText, { color: tc.text }]}>
              {item.type.toUpperCase()}
            </AppText>
          </View>

          {item.checkInTime && (
            <AppText
              variant="caption"
              color={sc.color}
              style={{ marginLeft: 8, opacity: 0.85 }}
            >
              {item.status === 'Late' ? 'Arrived late: ' : 'Checked in: '}
              {item.checkInTime}
            </AppText>
          )}

          {!item.checkInTime && item.note && (
            <AppText
              variant="caption"
              color={COLORS.muted}
              style={{ marginLeft: 8 }}
            >
              {item.note}
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Filter pill ─────────────────────────────────────────────────────────────────
type FilterKey = 'all' | AttendanceStatus;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'Present', label: 'Present' },
  { key: 'Late',    label: 'Late'    },
  { key: 'Absent',  label: 'Absent'  },
];

function FilterPill({
  label,
  active,
  accentColor,
  onPress,
}: {
  label: string;
  active: boolean;
  accentColor?: string;
  onPress: () => void;
}) {
  const ac = accentColor ?? COLORS.blue;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.filterPill,
        active && {
          backgroundColor: accentColor ? ac + '22' : COLORS.blue,
          borderColor:     accentColor ? ac + '55' : COLORS.blue,
        },
      ]}
    >
      <AppText
        variant="body-sm"
        color={active ? (accentColor ? ac : COLORS.whiteSoft) : COLORS.muted}
        style={s.filterText}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function AttendanceHistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? MOCK_RECORDS
        : MOCK_RECORDS.filter((r) => r.status === filter),
    [filter]
  );

  const filteredCount = filtered.length;

  const content = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      <SummaryCard records={MOCK_RECORDS} />
      <View style={s.filterRow}>
        {FILTER_OPTIONS.map((f) => (
          <FilterPill
            key={f.key}
            label={f.label}
            active={filter === f.key}
            accentColor={f.key !== 'all' ? STATUS_CFG[f.key as AttendanceStatus].color : undefined}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </View>
      <AppText
        variant="caption"
        color={COLORS.muted}
        style={{ paddingHorizontal: 20, marginBottom: 10 }}
      >
        {filteredCount} {filteredCount === 1 ? 'session' : 'sessions'}
      </AppText>
      <View style={s.list}>
        {filtered.map((item) => (
          <RecordCard key={item.id} item={item} />
        ))}
      </View>
      <View style={{ height: 32 }} />
    </ScrollView>
  );

  if (embedded) return content;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <View>
            <AppText variant="h2">Attendance</AppText>
            <AppText variant="caption">Full attendance history</AppText>
          </View>
        </View>
        {content}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 300, height: 300, top: -80,  right: -80, backgroundColor: 'rgba(16,185,129,0.07)' },
  orb2: { width: 200, height: 200, bottom: 80, left: -60,  backgroundColor: 'rgba(6,182,212,0.06)'  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    paddingTop: 22,
    overflow: 'hidden',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  rateNum: {
    fontFamily: FONTS.heading,
    fontSize: 40,
    color: COLORS.whiteSoft,
    lineHeight: 44,
  },
  ratePct: {
    fontFamily: FONTS.heading,
    fontSize: 22,
    color: COLORS.whiteSoft,
    marginBottom: 4,
  },
  summaryMeta: {
    alignItems: 'flex-end',
    gap: 3,
  },

  // Progress bar
  progressBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(241,245,255,0.06)',
    marginBottom: 14,
  },

  // Stat chips
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statIcon: {
    fontSize: 12,
  },
  statCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.navyCard,
  },
  filterText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
  },

  // Scroll + list
  scroll: { paddingTop: 0 },
  list: {
    paddingHorizontal: 20,
    gap: 10,
  },

  // Record card
  recordCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  // Date column
  dateCol: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 2,
  },
  dayNum: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    lineHeight: 24,
  },
  dayMon: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.muted,
  },
  dayAbbr: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: 'rgba(241,245,255,0.35)',
  },
  dateDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },

  // Record content
  recordContent: {
    flex: 1,
    padding: 12,
    paddingLeft: 14,
    gap: 5,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recordSubject: {
    flex: 1,
    fontSize: 14,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusIcon: { fontSize: 9  },
  statusLabel: { fontFamily: FONTS.bodySemi, fontSize: 10 },

  // Record meta
  recordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 9,
    letterSpacing: 0.4,
  },
});
