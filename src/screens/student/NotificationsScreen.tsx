import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';

// ── Types ───────────────────────────────────────────────────────────────────────
type NotifCategory = 'attendance' | 'exam' | 'violation';

interface NotificationItem {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

// ── Mock data ───────────────────────────────────────────────────────────────────
const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    category: 'attendance',
    title: 'Attendance Reminder',
    body: 'You have Advanced Mathematics at 07:30. Remember to scan your face at the door.',
    time: '30 min ago',
    read: false,
  },
  {
    id: '2',
    category: 'exam',
    title: 'Exam in 2 Hours',
    body: 'Database Systems exam starts at 14:00 in Exam Hall 1. Bring your student ID.',
    time: '1 hour ago',
    read: false,
  },
  {
    id: '3',
    category: 'violation',
    title: 'Violation Alert',
    body: 'Face recognition mismatch detected at 09:45 during Software Engineering class.',
    time: '2 hours ago',
    read: false,
  },
  {
    id: '4',
    category: 'attendance',
    title: 'Attendance Confirmed',
    body: 'Your attendance for Software Engineering (09:30) has been recorded successfully.',
    time: '3 hours ago',
    read: true,
  },
  {
    id: '5',
    category: 'exam',
    title: 'Score Available',
    body: 'Your Introduction to Programming midterm result is now available. Check the portal.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: '6',
    category: 'violation',
    title: 'Mobile Device Detected',
    body: 'Unauthorized phone usage was flagged during Database Systems on Jun 25, 2026.',
    time: '2 days ago',
    read: true,
  },
  {
    id: '7',
    category: 'attendance',
    title: 'Missed Check-in',
    body: 'No check-in recorded for Advanced Mathematics on Jun 25. Contact your instructor.',
    time: '2 days ago',
    read: true,
  },
  {
    id: '8',
    category: 'exam',
    title: 'Exam Rescheduled',
    body: 'Artificial Intelligence exam moved to Jun 30 at 08:00 in Exam Hall 2.',
    time: '3 days ago',
    read: true,
  },
];

// ── Category config ─────────────────────────────────────────────────────────────
const CATEGORY_CFG: Record<
  NotifCategory,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  attendance: {
    label: 'Attendance',
    icon: '📋',
    color: COLORS.blueBright,
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.28)',
  },
  exam: {
    label: 'Exam',
    icon: '📅',
    color: COLORS.gold,
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.28)',
  },
  violation: {
    label: 'Violation',
    icon: '⚠️',
    color: COLORS.red,
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.28)',
  },
};

// ── Filter config ───────────────────────────────────────────────────────────────
type FilterKey = 'all' | NotifCategory;

const FILTERS: {
  key: FilterKey;
  label: string;
  icon?: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}[] = [
  {
    key: 'all',
    label: 'All',
    activeBg: COLORS.blue,
    activeBorder: COLORS.blue,
    activeText: COLORS.whiteSoft,
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: '📋',
    activeBg: 'rgba(37,99,235,0.13)',
    activeBorder: 'rgba(37,99,235,0.40)',
    activeText: COLORS.blueBright,
  },
  {
    key: 'exam',
    label: 'Exam',
    icon: '📅',
    activeBg: 'rgba(245,158,11,0.13)',
    activeBorder: 'rgba(245,158,11,0.40)',
    activeText: COLORS.gold,
  },
  {
    key: 'violation',
    label: 'Violation',
    icon: '⚠️',
    activeBg: 'rgba(239,68,68,0.13)',
    activeBorder: 'rgba(239,68,68,0.40)',
    activeText: COLORS.red,
  },
];

// ── Filter pill ─────────────────────────────────────────────────────────────────
function FilterPill({
  label,
  icon,
  active,
  activeBg,
  activeBorder,
  activeText,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.filterPill,
        active && { backgroundColor: activeBg, borderColor: activeBorder },
      ]}
    >
      {icon && <AppText style={{ fontSize: 12 }}>{icon}</AppText>}
      <AppText
        variant="body-sm"
        color={active ? activeText : COLORS.muted}
        style={s.filterPillText}
      >
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

// ── Notification card ───────────────────────────────────────────────────────────
function NotificationCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const cfg = CATEGORY_CFG[item.category];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[s.notifCard, !item.read && s.notifCardUnread]}
    >
      {/* Unread accent bar */}
      {!item.read && (
        <View style={[s.unreadBar, { backgroundColor: cfg.color }]} />
      )}

      <View style={s.notifInner}>
        {/* Category icon bubble */}
        <View style={[s.iconBubble, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <AppText style={s.iconText}>{cfg.icon}</AppText>
        </View>

        {/* Content */}
        <View style={s.notifContent}>
          {/* Title row */}
          <View style={s.notifTitleRow}>
            <AppText
              variant="semi"
              color={item.read ? 'rgba(241,245,255,0.45)' : COLORS.whiteSoft}
              numberOfLines={1}
              style={s.notifTitle}
            >
              {item.title}
            </AppText>
            <AppText style={s.notifTime}>{item.time}</AppText>
          </View>

          {/* Body */}
          <AppText
            variant="body-sm"
            color={item.read ? 'rgba(241,245,255,0.35)' : 'rgba(241,245,255,0.65)'}
            numberOfLines={2}
            style={s.notifBody}
          >
            {item.body}
          </AppText>

          {/* Category chip */}
          <View style={[s.categoryChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <AppText style={[s.categoryChipText, { color: cfg.color }]}>
              {cfg.label.toUpperCase()}
            </AppText>
          </View>
        </View>

        {/* Unread dot */}
        {!item.read && (
          <View style={[s.unreadDot, { backgroundColor: cfg.color }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: FilterKey }) {
  const label = filter === 'all' ? 'notifications' : CATEGORY_CFG[filter as NotifCategory].label.toLowerCase() + ' notifications';
  return (
    <View style={s.emptyState}>
      <AppText style={{ fontSize: 44, marginBottom: 14 }}>🔕</AppText>
      <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>
        No {label}
      </AppText>
      <AppText variant="body-sm" color={COLORS.muted} style={{ textAlign: 'center' }}>
        You're all caught up for this category.
      </AppText>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filtered = useMemo(
    () =>
      activeFilter === 'all'
        ? notifications
        : notifications.filter((n) => n.category === activeFilter),
    [notifications, activeFilter]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredUnread = filtered.filter((n) => !n.read).length;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <View style={s.headerTitleRow}>
              <AppText variant="h2">Notifications</AppText>
              {unreadCount > 0 && (
                <View style={s.unreadBadge}>
                  <AppText style={s.unreadBadgeText}>{unreadCount}</AppText>
                </View>
              )}
            </View>
            <AppText variant="caption">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </AppText>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.75} style={s.markAllBtn}>
              <AppText style={s.markAllText}>Mark all read</AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills (horizontal scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          {FILTERS.map((f) => (
            <FilterPill
              key={f.key}
              label={f.label}
              icon={f.icon}
              active={activeFilter === f.key}
              activeBg={f.activeBg}
              activeBorder={f.activeBorder}
              activeText={f.activeText}
              onPress={() => setActiveFilter(f.key)}
            />
          ))}
        </ScrollView>

        {/* Unread count for active filter */}
        {filteredUnread > 0 && (
          <View style={s.filterUnreadBanner}>
            <View style={s.filterUnreadDot} />
            <AppText variant="caption" color={COLORS.cyan}>
              {filteredUnread} unread in this view
            </AppText>
          </View>
        )}

        {/* Notification list */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >
          {filtered.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <View style={s.list}>
              {filtered.map((item) => (
                <NotificationCard
                  key={item.id}
                  item={item}
                  onPress={() => handleMarkRead(item.id)}
                />
              ))}
            </View>
          )}
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
  orb1: { width: 280, height: 280, top: -60, right: -60, backgroundColor: 'rgba(37,99,235,0.09)' },
  orb2: { width: 200, height: 200, bottom: 100, left: -60, backgroundColor: 'rgba(6,182,212,0.07)' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  unreadBadge: {
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: '#fff',
  },
  markAllBtn: {
    backgroundColor: 'rgba(37,99,235,0.14)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.32)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 4,
  },
  markAllText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.blueBright,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.navyCard,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
  },

  // Unread banner
  filterUnreadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  filterUnreadDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cyan,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 20,
  },
  list: {
    gap: 10,
  },

  // Notification card
  notifCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  notifCardUnread: {
    borderColor: 'rgba(59,130,246,0.22)',
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  unreadBar: {
    width: 3,
    alignSelf: 'stretch',
  },
  notifInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },

  // Icon bubble
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 19,
  },

  // Notification content
  notifContent: {
    flex: 1,
    gap: 4,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  notifTitle: {
    flex: 1,
    fontSize: 14,
  },
  notifTime: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: 'rgba(241,245,255,0.30)',
    flexShrink: 0,
  },
  notifBody: {
    lineHeight: 17,
  },

  // Category chip
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    marginTop: 4,
  },
  categoryChipText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Unread dot (right edge)
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    marginTop: 3,
    flexShrink: 0,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 32,
  },
});
