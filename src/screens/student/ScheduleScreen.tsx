import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

// ── Types ───────────────────────────────────────────────────────────────────────
type ItemType = 'Class' | 'Exam';
type ItemStatus = 'Upcoming' | 'In Progress' | 'Past';

interface ScheduleItem {
  id: string;
  subject: string;
  room: string;
  time: string;
  type: ItemType;
  status: ItemStatus;
  instructor: string;
  credits?: number;
}

interface ScheduleGroup {
  dateLabel: string;
  date: string;
  items: ScheduleItem[];
}

// ── Mock data ───────────────────────────────────────────────────────────────────
const MOCK_SCHEDULE: ScheduleGroup[] = [
  {
    dateLabel: 'Today',
    date: 'Fri, Jun 27',
    items: [
      {
        id: '1',
        subject: 'Advanced Mathematics',
        room: 'Room B.204',
        time: '07:30 – 09:00',
        type: 'Class',
        status: 'Past',
        instructor: 'Dr. Nguyen Van An',
        credits: 3,
      },
      {
        id: '2',
        subject: 'Software Engineering',
        room: 'Room A.501',
        time: '09:30 – 11:00',
        type: 'Class',
        status: 'In Progress',
        instructor: 'Dr. Le Thi Bich',
        credits: 4,
      },
      {
        id: '3',
        subject: 'Database Systems',
        room: 'Exam Hall 1',
        time: '14:00 – 15:30',
        type: 'Exam',
        status: 'Upcoming',
        instructor: 'Dr. Tran Van Cuong',
      },
    ],
  },
  {
    dateLabel: 'Tomorrow',
    date: 'Sat, Jun 28',
    items: [
      {
        id: '4',
        subject: 'Computer Networks',
        room: 'Room B.301',
        time: '07:30 – 09:00',
        type: 'Class',
        status: 'Upcoming',
        instructor: 'Dr. Pham Thi Dung',
        credits: 3,
      },
      {
        id: '5',
        subject: 'Operating Systems',
        room: 'Room B.401',
        time: '13:00 – 14:30',
        type: 'Class',
        status: 'Upcoming',
        instructor: 'Dr. Ho Van Em',
        credits: 3,
      },
    ],
  },
  {
    dateLabel: 'Mon, Jun 30',
    date: 'Mon, Jun 30',
    items: [
      {
        id: '6',
        subject: 'Artificial Intelligence',
        room: 'Exam Hall 2',
        time: '08:00 – 10:00',
        type: 'Exam',
        status: 'Upcoming',
        instructor: 'Dr. Vo Thi Phuong',
      },
      {
        id: '7',
        subject: 'Human-Computer Interaction',
        room: 'Room C.102',
        time: '13:30 – 15:00',
        type: 'Class',
        status: 'Upcoming',
        instructor: 'Dr. Ngo Van Giang',
        credits: 2,
      },
    ],
  },
];

// ── Config ──────────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<ItemType, { bar: string; badgeText: string; badgeBg: string; badgeBorder: string }> = {
  Class: {
    bar: COLORS.blue,
    badgeText: COLORS.blueBright,
    badgeBg: 'rgba(37,99,235,0.10)',
    badgeBorder: 'rgba(37,99,235,0.28)',
  },
  Exam: {
    bar: COLORS.gold,
    badgeText: COLORS.gold,
    badgeBg: 'rgba(245,158,11,0.10)',
    badgeBorder: 'rgba(245,158,11,0.28)',
  },
};

const STATUS_CFG: Record<
  ItemStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  Upcoming: { label: 'Upcoming', color: COLORS.cyan,  bg: 'rgba(6,182,212,0.12)',   icon: '↑' },
  'In Progress': { label: 'Now',  color: COLORS.green, bg: 'rgba(16,185,129,0.12)', icon: '●' },
  Past:      { label: 'Past',    color: 'rgba(241,245,255,0.30)', bg: 'rgba(241,245,255,0.05)', icon: '✓' },
};

// ── Pulsing "live" dot for In-Progress ─────────────────────────────────────────
function LiveDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 720, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: 720, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.liveDot, { opacity: anim }]} />;
}

// ── Schedule card ───────────────────────────────────────────────────────────────
function ScheduleCard({ item }: { item: ScheduleItem }) {
  const type   = TYPE_CFG[item.type];
  const status = STATUS_CFG[item.status];
  const isPast = item.status === 'Past';

  return (
    <View style={[s.card, { borderLeftColor: type.bar }]}>
      {/* Subject + status badge */}
      <View style={s.cardRow}>
        <AppText
          variant="semi"
          color={isPast ? 'rgba(241,245,255,0.40)' : COLORS.whiteSoft}
          numberOfLines={1}
          style={s.cardSubject}
        >
          {item.subject}
        </AppText>

        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          {item.status === 'In Progress' ? (
            <LiveDot />
          ) : (
            <AppText style={[s.statusIcon, { color: status.color }]}>
              {status.icon}
            </AppText>
          )}
          <AppText style={[s.statusLabel, { color: status.color }]}>
            {status.label}
          </AppText>
        </View>
      </View>

      {/* Time */}
      <AppText
        variant="body-sm"
        color={isPast ? 'rgba(241,245,255,0.30)' : 'rgba(241,245,255,0.60)'}
        style={{ fontSize: 12, marginBottom: 2 }}
      >
        🕐  {item.time}
      </AppText>

      {/* Room · instructor · type badge */}
      <View style={s.cardRow}>
        <AppText
          variant="caption"
          color={isPast ? 'rgba(241,245,255,0.25)' : 'rgba(241,245,255,0.50)'}
          numberOfLines={1}
          style={{ flex: 1 }}
        >
          📍 {item.room}  ·  {item.instructor}
        </AppText>

        <View style={[s.typeBadge, { backgroundColor: type.badgeBg, borderColor: type.badgeBorder }]}>
          <AppText style={[s.typeBadgeText, { color: type.badgeText }]}>
            {item.type.toUpperCase()}
          </AppText>
        </View>
      </View>
    </View>
  );
}

// ── Date group header ───────────────────────────────────────────────────────────
function GroupHeader({ dateLabel, date }: { dateLabel: string; date: string }) {
  const isToday    = dateLabel === 'Today';
  const isTomorrow = dateLabel === 'Tomorrow';
  const accentColor = isToday ? COLORS.cyan : isTomorrow ? COLORS.blueBright : undefined;

  return (
    <View style={s.groupHeader}>
      <AppText
        variant="label"
        color={accentColor ?? 'rgba(241,245,255,0.38)'}
        style={{ letterSpacing: 1.1 }}
      >
        {dateLabel.toUpperCase()}
      </AppText>
      {(isToday || isTomorrow) && (
        <AppText variant="caption" style={{ marginLeft: 8 }}>
          {date}
        </AppText>
      )}
      <View style={s.groupHeaderLine} />
    </View>
  );
}

// ── Filter pill ─────────────────────────────────────────────────────────────────
type FilterKey = 'all' | 'class' | 'exam';

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.filterPill, active && s.filterPillActive]}
    >
      <AppText
        variant="body-sm"
        color={active ? COLORS.whiteSoft : COLORS.muted}
        style={s.filterPillText}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

// ── Summary stat ────────────────────────────────────────────────────────────────
function StatBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={[s.statBadge, { borderColor: color + '44', backgroundColor: color + '14' }]}>
      <AppText style={[s.statCount, { color }]}>{count}</AppText>
      <AppText variant="caption" color={COLORS.muted} style={{ marginLeft: 4 }}>
        {label}
      </AppText>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const [filter, setFilter] = useState<FilterKey>('all');

  const allItems = MOCK_SCHEDULE.flatMap((g) => g.items);
  const upcoming = allItems.filter((i) => i.status === 'Upcoming').length;
  const exams    = allItems.filter((i) => i.type === 'Exam').length;

  const filteredGroups = useMemo(() => {
    if (filter === 'all') return MOCK_SCHEDULE;
    const t: ItemType = filter === 'class' ? 'Class' : 'Exam';
    return MOCK_SCHEDULE.map((g) => ({ ...g, items: g.items.filter((i) => i.type === t) })).filter(
      (g) => g.items.length > 0
    );
  }, [filter]);

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <AppText variant="h2">Schedule</AppText>
            <AppText variant="caption">
              Week of Jun 27 – Jul 4, 2026
            </AppText>
          </View>

          {/* Summary stats */}
          <View style={s.statRow}>
            <StatBadge count={upcoming} label="upcoming" color={COLORS.cyan} />
            <StatBadge count={exams} label="exams" color={COLORS.gold} />
          </View>
        </View>

        {/* Filter pills */}
        <View style={s.filterRow}>
          {([
            { key: 'all',   label: 'All Sessions' },
            { key: 'class', label: 'Classes' },
            { key: 'exam',  label: 'Exams' },
          ] as { key: FilterKey; label: string }[]).map((f) => (
            <FilterPill
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </View>

        {/* Schedule list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {filteredGroups.map((group) => (
            <View key={group.dateLabel} style={s.group}>
              <GroupHeader dateLabel={group.dateLabel} date={group.date} />
              <View style={s.groupItems}>
                {group.items.map((item) => (
                  <ScheduleCard key={item.id} item={item} />
                ))}
              </View>
            </View>
          ))}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 320, height: 320, top: -100, right: -80, backgroundColor: 'rgba(37,99,235,0.09)' },
  orb2: { width: 220, height: 220, bottom: 80, left: -70, backgroundColor: 'rgba(6,182,212,0.07)' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.navyCard,
  },
  filterPillActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemi,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  // Group
  group: {
    marginBottom: 26,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 10,
  },
  groupItems: {
    gap: 10,
  },

  // Card
  card: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardSubject: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  statusIcon: {
    fontSize: 9,
  },
  statusLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.green,
  },

  // Type badge
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    flexShrink: 0,
  },
  typeBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
