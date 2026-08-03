import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { getStudentAttendanceRecords, StudentAttendanceRecord } from '../../api/attendance';
import { apiRequest } from '../../api/client';

// ── Types ──────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

interface ClassSummary { id: string; courseName: string; courseCode: string; }

interface DisplayRecord {
  id: string;
  date: string;
  dayOfWeek: string;
  subject: string;
  courseCode: string;
  time: string;
  status: AttendanceStatus;
  method: 'Ai' | 'Manual';
  confidenceScore: number | null;
  checkinAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplay(record: StudentAttendanceRecord, classMap: Map<string, ClassSummary>): DisplayRecord {
  const startTime = record.session?.startTime ? new Date(record.session.startTime) : null;
  const cls = record.session ? classMap.get(record.session.classId) : null;

  const dayNum  = startTime ? startTime.getDate().toString() : '—';
  const month   = startTime ? startTime.toLocaleString('en-US', { month: 'short' }) : '—';
  const dow     = startTime ? startTime.toLocaleString('en-US', { weekday: 'long' }) : '—';
  const timeStr = startTime ? startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

  return {
    id:              record.id,
    date:            startTime ? `${dayNum} ${month}` : '—',
    dayOfWeek:       dow,
    subject:         cls?.courseName ?? `Class ${record.session?.classId?.slice(0, 8) ?? '—'}`,
    courseCode:      cls?.courseCode ?? '',
    time:            timeStr,
    status:          record.status as AttendanceStatus,
    method:          record.method,
    confidenceScore: record.confidenceScore,
    checkinAt:       record.checkinAt
      ? new Date(record.checkinAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : null,
  };
}

async function getStudentClasses(): Promise<ClassSummary[]> {
  try {
    const data = await apiRequest<{ items?: ClassSummary[] } | ClassSummary[]>(
      '/api/classes/my-classes?pageSize=100',
    );
    return Array.isArray(data) ? data : (data as any).items ?? [];
  } catch {
    return [];
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<AttendanceStatus, { color: string; bg: string; border: string; icon: string; label: string }> = {
  Present: { color: COLORS.green,     bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '✓',  label: 'Present' },
  Late:    { color: COLORS.gold,      bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', icon: '⏰', label: 'Late'    },
  Absent:  { color: COLORS.red,       bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',  icon: '✗',  label: 'Absent'  },
  Excused: { color: COLORS.blueBright,bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.28)', icon: '○',  label: 'Excused' },
};

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ records }: { records: DisplayRecord[] }) {
  const total   = records.length;
  const present = records.filter((r) => r.status === 'Present').length;
  const late    = records.filter((r) => r.status === 'Late').length;
  const absent  = records.filter((r) => r.status === 'Absent').length;
  const rate    = total > 0 ? ((present + late) / total) * 100 : 0;

  const stats = [
    { count: present, label: 'Present', cfg: STATUS_CFG.Present },
    { count: late,    label: 'Late',    cfg: STATUS_CFG.Late    },
    { count: absent,  label: 'Absent',  cfg: STATUS_CFG.Absent  },
  ];

  return (
    <View style={s.summaryCard}>
      <LinearGradient colors={[COLORS.green, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cardAccentBar} />
      <View style={s.summaryTop}>
        <View>
          <AppText variant="label" style={{ letterSpacing: 1 }}>Attendance Rate</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 4 }}>
            <AppText style={s.rateNum}>{rate.toFixed(1)}</AppText>
            <AppText style={s.ratePct}>%</AppText>
          </View>
        </View>
        <View style={s.summaryMeta}>
          <AppText variant="caption" color={COLORS.muted}>{total} sessions</AppText>
        </View>
      </View>
      <View style={s.progressBar}>
        <View style={{ flex: present || 0.001, backgroundColor: COLORS.green }} />
        <View style={{ flex: late    || 0.001, backgroundColor: COLORS.gold  }} />
        <View style={{ flex: absent  || 0.001, backgroundColor: COLORS.red   }} />
      </View>
      <View style={s.statRow}>
        {stats.map((st) => (
          <View key={st.label} style={[s.statChip, { backgroundColor: st.cfg.bg, borderColor: st.cfg.border }]}>
            <AppText style={[s.statIcon, { color: st.cfg.color }]}>{st.cfg.icon}</AppText>
            <AppText style={[s.statCount, { color: st.cfg.color }]}>{st.count}</AppText>
            <AppText variant="caption" color={COLORS.muted}>{st.label}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Record card ───────────────────────────────────────────────────────────────

function RecordCard({ item }: { item: DisplayRecord }) {
  const sc = STATUS_CFG[item.status];
  const [dayNum, month] = item.date.split(' ');
  const dayAbbr = item.dayOfWeek.slice(0, 3);

  return (
    <View style={s.recordCard}>
      <View style={s.dateCol}>
        <AppText style={[s.dayNum, { color: sc.color }]}>{dayNum}</AppText>
        <AppText style={s.dayMon}>{month}</AppText>
        <AppText style={s.dayAbbr}>{dayAbbr}</AppText>
      </View>
      <View style={s.dateDivider} />
      <View style={s.recordContent}>
        <View style={s.recordTopRow}>
          <AppText variant="semi" numberOfLines={1} color={item.status === 'Absent' ? 'rgba(241,245,255,0.45)' : COLORS.whiteSoft} style={s.recordSubject}>
            {item.subject}
          </AppText>
          <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <AppText style={[s.statusIcon, { color: sc.color }]}>{sc.icon}</AppText>
            <AppText style={[s.statusLabel, { color: sc.color }]}>{sc.label}</AppText>
          </View>
        </View>
        <AppText variant="caption" color={item.status === 'Absent' ? 'rgba(241,245,255,0.30)' : 'rgba(241,245,255,0.55)'}>
          🕐 {item.time}{item.courseCode ? `  ·  ${item.courseCode}` : ''}
        </AppText>
        <View style={s.recordMeta}>
          {item.method === 'Ai' && item.confidenceScore != null && (
            <View style={s.aiChip}>
              <AppText style={s.aiChipText}>AI {Math.round(item.confidenceScore * 100)}%</AppText>
            </View>
          )}
          {item.method === 'Manual' && (
            <View style={s.manualChip}>
              <AppText style={s.manualChipText}>Manual</AppText>
            </View>
          )}
          {item.checkinAt && (
            <AppText variant="caption" color={sc.color} style={{ marginLeft: 8, opacity: 0.85 }}>
              {item.status === 'Late' ? 'Arrived: ' : 'Checked in: '}{item.checkinAt}
            </AppText>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────

type FilterKey = 'all' | AttendanceStatus;
const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'All'     },
  { key: 'Present', label: 'Present' },
  { key: 'Late',    label: 'Late'    },
  { key: 'Absent',  label: 'Absent'  },
];

function FilterPill({ label, active, accentColor, onPress }: { label: string; active: boolean; accentColor?: string; onPress: () => void }) {
  const ac = accentColor ?? COLORS.blue;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[s.filterPill, active && { backgroundColor: ac + '22', borderColor: ac + '55' }]}>
      <AppText variant="body-sm" color={active ? (accentColor ? ac : COLORS.whiteSoft) : COLORS.muted} style={s.filterText}>
        {label}
      </AppText>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AttendanceHistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const [records, setRecords] = useState<DisplayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<FilterKey>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawRecords, classes] = await Promise.all([
        getStudentAttendanceRecords(),
        getStudentClasses(),
      ]);
      const classMap = new Map(classes.map((c) => [c.id, c]));
      setRecords(rawRecords.map((r) => toDisplay(r, classMap)));
    } catch (e: any) {
      setError(e.message ?? 'Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => filter === 'all' ? records : records.filter((r) => r.status === filter),
    [filter, records],
  );

  const content = (
    <>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.cyan} />
          <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 12 }}>Loading attendance…</AppText>
        </View>
      ) : error ? (
        <View style={s.center}>
          <AppText style={{ fontSize: 36, marginBottom: 12 }}>⚠️</AppText>
          <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>Failed to load</AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 20 }}>{error}</AppText>
          <Button label="Retry" onPress={load} style={{ width: 140 }} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <SummaryCard records={records} />
          <View style={s.filterRow}>
            {FILTER_OPTIONS.map((f) => (
              <FilterPill
                key={f.key}
                label={f.label}
                active={filter === f.key}
                accentColor={f.key !== 'all' ? STATUS_CFG[f.key as AttendanceStatus]?.color : undefined}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </View>
          <AppText variant="caption" color={COLORS.muted} style={{ paddingHorizontal: 20, marginBottom: 10 }}>
            {filtered.length} {filtered.length === 1 ? 'session' : 'sessions'}
          </AppText>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <AppText style={{ fontSize: 36, marginBottom: 10 }}>📋</AppText>
              <AppText variant="semi" color={COLORS.whiteSoft}>No records yet</AppText>
              <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 4, textAlign: 'center' }}>
                Attendance records will appear here after your lecturer takes attendance
              </AppText>
            </View>
          ) : (
            <View style={s.list}>
              {filtered.map((item) => <RecordCard key={item.id} item={item} />)}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <AppText variant="h2">Attendance</AppText>
          <AppText variant="caption">Full attendance history</AppText>
        </View>
        {content}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  orb:  { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 300, height: 300, top: -80,  right: -80, backgroundColor: 'rgba(16,185,129,0.07)' },
  orb2: { width: 200, height: 200, bottom: 80, left: -60,  backgroundColor: 'rgba(6,182,212,0.06)'  },

  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  empty:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  scroll: { paddingTop: 0 },
  list:   { paddingHorizontal: 20, gap: 10 },

  // Summary
  summaryCard: {
    marginHorizontal: 20, marginBottom: 18,
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'],
    borderWidth: 1, borderColor: COLORS.border,
    padding: 20, paddingTop: 22, overflow: 'hidden',
    shadowColor: COLORS.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 16, elevation: 6,
  },
  cardAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  rateNum:    { fontFamily: FONTS.heading, fontSize: 40, color: COLORS.whiteSoft, lineHeight: 44 },
  ratePct:    { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.whiteSoft, marginBottom: 4 },
  summaryMeta: { alignItems: 'flex-end', gap: 3 },
  progressBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(241,245,255,0.06)', marginBottom: 14 },
  statRow: { flexDirection: 'row', gap: 8 },
  statChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  statIcon:  { fontSize: 12 },
  statCount: { fontFamily: FONTS.bodyBold, fontSize: 15 },

  // Filter
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterPill: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.navyCard },
  filterText: { fontSize: 12, fontFamily: FONTS.bodySemi },

  // Record card
  recordCard: { flexDirection: 'row', backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  dateCol: { width: 52, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 2 },
  dayNum:  { fontFamily: FONTS.heading, fontSize: 20, lineHeight: 24 },
  dayMon:  { fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted },
  dayAbbr: { fontFamily: FONTS.body, fontSize: 10, color: 'rgba(241,245,255,0.35)' },
  dateDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  recordContent: { flex: 1, padding: 12, paddingLeft: 14, gap: 5 },
  recordTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  recordSubject: { flex: 1, fontSize: 14 },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, flexShrink: 0 },
  statusIcon:    { fontSize: 9 },
  statusLabel:   { fontFamily: FONTS.bodySemi, fontSize: 10 },
  recordMeta:    { flexDirection: 'row', alignItems: 'center' },
  aiChip:        { backgroundColor: 'rgba(6,182,212,0.12)', borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  aiChipText:    { fontFamily: FONTS.bodySemi, fontSize: 9, color: COLORS.cyan },
  manualChip:    { backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  manualChipText: { fontFamily: FONTS.bodySemi, fontSize: 9, color: COLORS.gold },
});
