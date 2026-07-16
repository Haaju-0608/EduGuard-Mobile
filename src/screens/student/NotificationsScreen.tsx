import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AppText } from '../../components/ui/AppText';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import type { MainTabParamList } from '../../navigation/types';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationItem,
  NotifType,
} from '../../api/notifications';

// ── Type config ────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<
  NotifType,
  { icon: string; color: string; bg: string; border: string; chipLabel: string }
> = {
  AttendanceSessionStarted: {
    icon: '📋',
    color: COLORS.blueBright,
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(37,99,235,0.28)',
    chipLabel: 'ATTENDANCE',
  },
  ExamReminder: {
    icon: '📅',
    color: COLORS.gold,
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.28)',
    chipLabel: 'EXAM',
  },
  ViolationDetected: {
    icon: '⚠️',
    color: COLORS.red,
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.28)',
    chipLabel: 'VIOLATION',
  },
  BiometricRequestStatus: {
    icon: '🪪',
    color: COLORS.cyan,
    bg: 'rgba(6,182,212,0.12)',
    border: 'rgba(6,182,212,0.28)',
    chipLabel: 'BIOMETRIC',
  },
  LowBalanceAlert: {
    icon: '💳',
    color: COLORS.gold,
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.28)',
    chipLabel: 'BALANCE',
  },
  ServiceSuspended: {
    icon: '🚨',
    color: COLORS.red,
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.28)',
    chipLabel: 'SERVICE',
  },
};

function getCfg(type: NotifType) {
  return (
    TYPE_CFG[type] ?? {
      icon: '🔔',
      color: COLORS.muted,
      bg: 'rgba(241,245,255,0.06)',
      border: 'rgba(241,245,255,0.12)',
      chipLabel: type.toUpperCase(),
    }
  );
}

// ── Time helper ────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}

// ── Notification card ──────────────────────────────────────────────────────────

function NotifCard({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: (item: NotificationItem) => void;
}) {
  const cfg = getCfg(item.type);
  const unread = !item.isRead;

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.76}
      style={[s.card, unread && s.cardUnread]}
    >
      {unread && <View style={[s.accentBar, { backgroundColor: cfg.color }]} />}

      <View style={[s.cardInner, !unread && { paddingLeft: 14 }]}>
        {/* Icon bubble */}
        <View style={[s.iconBubble, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <AppText style={s.iconEmoji}>{cfg.icon}</AppText>
        </View>

        {/* Content */}
        <View style={s.cardBody}>
          <View style={s.cardTopRow}>
            <AppText
              style={[
                s.cardTitle,
                { color: unread ? COLORS.whiteSoft : 'rgba(241,245,255,0.42)' },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </AppText>
            <AppText style={s.cardTime}>{timeAgo(item.createdAt)}</AppText>
          </View>

          <AppText
            variant="body-sm"
            color={unread ? 'rgba(241,245,255,0.62)' : 'rgba(241,245,255,0.30)'}
            numberOfLines={2}
            style={s.cardMsg}
          >
            {item.body}
          </AppText>

          <View style={[s.chip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <AppText style={[s.chipText, { color: cfg.color }]}>{cfg.chipLabel}</AppText>
          </View>
        </View>

        {unread && <View style={[s.unreadDot, { backgroundColor: cfg.color }]} />}
      </View>
    </TouchableOpacity>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

type Nav = BottomTabNavigationProp<MainTabParamList, 'Notifications'>;

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();

  const [items,       setItems]       = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [fetchError,  setFetchError]  = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setFetchError(null);
    try {
      const page = await getNotifications(1, 20);
      if (!isMounted.current) return;
      setItems(page.items ?? []);
      const cnt = page.unreadCount ?? page.items.filter((n) => !n.isRead).length;
      setUnreadCount(cnt);
    } catch (e: any) {
      if (isMounted.current) setFetchError(e?.message ?? 'Failed to load notifications');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => { if (isMounted.current) setLoading(false); });
  }, [loadData]);

  useEffect(() => {
    navigation.setOptions({
      tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    });
  }, [unreadCount, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (isMounted.current) setRefreshing(false);
  }, [loadData]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleTap = useCallback((item: NotificationItem) => {
    if (item.isRead) return;
    setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));

    markNotificationRead(item.id).catch(() => {
      if (!isMounted.current) return;
      setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, isRead: false } : n));
      setUnreadCount((c) => c + 1);
    });
  }, []);

  const handleMarkAll = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => loadData());
  }, [loadData]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />

      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.titleRow}>
              <AppText variant="h2">Notifications</AppText>
              {unreadCount > 0 && (
                <View style={s.headerBadge}>
                  <AppText style={s.headerBadgeText}>{unreadCount}</AppText>
                </View>
              )}
            </View>
            <AppText variant="caption">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </AppText>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAll}
              activeOpacity={0.75}
              style={s.markAllBtn}
            >
              <AppText style={s.markAllText}>Mark all read</AppText>
            </TouchableOpacity>
          )}
        </View>

        {/* Body */}
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={COLORS.blueBright} />
            <AppText variant="caption" style={{ marginTop: 12 }}>
              Loading notifications…
            </AppText>
          </View>
        ) : fetchError ? (
          <View style={s.centered}>
            <AppText style={s.errorIcon}>⚠️</AppText>
            <AppText
              variant="body-sm"
              color={COLORS.red}
              style={{ textAlign: 'center', paddingHorizontal: 32 }}
            >
              {fetchError}
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
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.blueBright}
                colors={[COLORS.blueBright]}
              />
            }
          >
            {items.length === 0 ? (
              <View style={s.emptyState}>
                <AppText style={s.emptyIcon}>🔕</AppText>
                <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>
                  No notifications
                </AppText>
                <AppText variant="body-sm" color={COLORS.muted} style={{ textAlign: 'center' }}>
                  You're all caught up.
                </AppText>
              </View>
            ) : (
              <View style={s.list}>
                {items.map((item) => (
                  <NotifCard key={item.id} item={item} onPress={handleTap} />
                ))}
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  safe: { flex: 1 },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 280, height: 280, top: -60,  right: -60, backgroundColor: 'rgba(37,99,235,0.09)' },
  orb2: { width: 200, height: 200, bottom: 100, left: -60, backgroundColor: 'rgba(6,182,212,0.07)' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  headerLeft: { gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerBadge: {
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  headerBadgeText: { fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff' },
  markAllBtn: {
    backgroundColor: 'rgba(37,99,235,0.14)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.32)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  markAllText: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.blueBright },

  // List
  scrollContent: { paddingHorizontal: 20 },
  list: { gap: 10 },

  // Card
  card: {
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: 'rgba(59,130,246,0.20)',
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 3,
  },
  accentBar: { width: 3, alignSelf: 'stretch' },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingRight: 12,
    paddingLeft: 12,
    gap: 12,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 18 },
  cardBody: { flex: 1, gap: 4 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTitle: { flex: 1, fontFamily: FONTS.bodySemi, fontSize: 14, lineHeight: 20 },
  cardTime: { fontFamily: FONTS.body, fontSize: 11, color: 'rgba(241,245,255,0.28)', flexShrink: 0 },
  cardMsg: { lineHeight: 17 },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    marginTop: 2,
  },
  chipText: { fontFamily: FONTS.bodySemi, fontSize: 9, letterSpacing: 0.5 },
  unreadDot: { width: 8, height: 8, borderRadius: RADIUS.full, marginTop: 4, flexShrink: 0 },

  // States
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  errorIcon: { fontSize: 40 },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(37,99,235,0.14)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.32)',
  },
  retryText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.blueBright },
  emptyState: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 32, gap: 6 },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
});
