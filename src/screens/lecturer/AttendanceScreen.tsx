import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import {
  AttendanceClass,
  AttendanceRecord,
  AttendanceSession,
  ClassEnrollment,
  createAttendanceRecord,
  getClassEnrollments,
  getLecturerClasses,
  openAttendanceSession,
  updateAttendanceRecord,
  uploadAttendanceVideo,
} from '../../api/attendance';
import { apiRequest } from '../../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'classes'; refreshing: boolean }
  | { tag: 'detail'; cls: AttendanceClass; sessions: AttendanceSession[]; sessionsLoading: boolean; opening: boolean }
  | { tag: 'video-pick'; cls: AttendanceClass; sessionId: string }
  | { tag: 'uploading'; cls: AttendanceClass; sessionId: string }
  | {
      tag: 'results';
      cls: AttendanceClass;
      sessionId: string;
      records: AttendanceRecord[];
      enrollments: ClassEnrollment[];
      toggling: string | null;
    };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtSessionTime(iso: string) {
  const d = new Date(iso);
  const today    = new Date();
  const sameDay  = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const dayLabel = sameDay(d, today) ? 'Today'
    : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dayLabel}  ·  ${time}`;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase();
}

function mergeResults(records: AttendanceRecord[], enrollments: ClassEnrollment[]) {
  return enrollments
    .filter((e) => e.status === 'Active')
    .map((e) => ({
      studentId:   e.studentId,
      fullName:    e.student.fullName,
      studentCode: e.student.studentCode,
      record:      records.find((r) => r.studentId === e.studentId) ?? null,
    }))
    .sort((a, b) => {
      const aP = a.record?.status === 'Present' ? 0 : 1;
      const bP = b.record?.status === 'Present' ? 0 : 1;
      return aP - bP || a.fullName.localeCompare(b.fullName);
    });
}

async function getPastSessions(classId: string): Promise<AttendanceSession[]> {
  try {
    return await apiRequest<AttendanceSession[]>(
      `/api/attendance-sessions?classId=${classId}&pageSize=5&sort=startTime_desc`,
    );
  } catch {
    return [];
  }
}

// ── ClassCard ─────────────────────────────────────────────────────────────────

function ClassCard({ cls, onPress }: { cls: AttendanceClass; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={s.classCard}>
      <LinearGradient
        colors={[COLORS.blue, COLORS.cyan]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={s.cardAccentBar}
      />
      <View style={s.classCardBody}>
        <View style={{ flex: 1 }}>
          <AppText variant="semi" color={COLORS.whiteSoft} numberOfLines={2} style={{ fontSize: 15 }}>
            {cls.courseName}
          </AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 3 }}>
            {cls.courseCode}
            {cls.semester ? `  ·  ${cls.semester}` : ''}
            {cls.academicYear ? `  ·  ${cls.academicYear}` : ''}
          </AppText>
          {(cls.startDate || cls.endDate) && (
            <AppText variant="caption" color="rgba(241,245,255,0.30)" style={{ marginTop: 2 }}>
              {fmtDate(cls.startDate)} — {fmtDate(cls.endDate)}
            </AppText>
          )}
        </View>
        <AppText style={{ fontSize: 22, color: COLORS.muted, paddingLeft: 6 }}>›</AppText>
      </View>
    </TouchableOpacity>
  );
}

// ── SessionHistoryRow ─────────────────────────────────────────────────────────

const SESSION_STATUS_CFG = {
  InProgress: { color: COLORS.green, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', label: 'In Progress' },
  Completed:  { color: COLORS.cyan,  bg: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.25)',  label: 'Completed'  },
  Cancelled:  { color: COLORS.red,   bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  label: 'Cancelled'  },
};

function SessionHistoryRow({ session }: { session: AttendanceSession }) {
  const sc = SESSION_STATUS_CFG[session.status] ?? SESSION_STATUS_CFG.Completed;
  return (
    <View style={s.sessionRow}>
      <View style={{ flex: 1 }}>
        <AppText variant="semi" color={COLORS.whiteSoft} style={{ fontSize: 13 }}>
          {fmtSessionTime(session.startTime)}
        </AppText>
        <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 2 }}>
          {session.totalRecognized} recognized
          {session.endTime ? `  ·  ended ${fmtSessionTime(session.endTime)}` : ''}
        </AppText>
      </View>
      <View style={[s.sessionStatusChip, { backgroundColor: sc.bg, borderColor: sc.border }]}>
        <AppText style={[s.sessionStatusText, { color: sc.color }]}>{sc.label}</AppText>
      </View>
    </View>
  );
}

// ── StudentToggleRow ──────────────────────────────────────────────────────────

interface StudentRow {
  studentId: string; fullName: string; studentCode: string;
  record: AttendanceRecord | null;
}

function StudentToggleRow({ row, toggling, onToggle }: {
  row: StudentRow; toggling: boolean; onToggle: (row: StudentRow) => void;
}) {
  const isPresent = row.record?.status === 'Present';
  const sc = isPresent
    ? { color: COLORS.green, bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', icon: '✓', label: 'Present' }
    : { color: COLORS.red,   bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.28)',  icon: '✗', label: 'Absent'  };
  return (
    <View style={s.studentRow}>
      <View style={[s.avatar, { borderColor: sc.color + '44' }]}>
        <AppText style={s.avatarText}>{initials(row.fullName)}</AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="semi" color={COLORS.whiteSoft} numberOfLines={1} style={{ fontSize: 13 }}>
          {row.fullName}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <AppText variant="caption" color={COLORS.muted}>{row.studentCode}</AppText>
          {row.record?.method === 'Ai' && row.record.confidenceScore != null && (
            <View style={s.confChip}>
              <AppText style={s.confChipText}>AI {Math.round(row.record.confidenceScore * 100)}%</AppText>
            </View>
          )}
          {row.record?.method === 'Manual' && (
            <View style={s.manualChip}>
              <AppText style={s.manualChipText}>Manual</AppText>
            </View>
          )}
        </View>
      </View>
      <View style={[s.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
        <AppText style={[s.statusIcon, { color: sc.color }]}>{sc.icon}</AppText>
        <AppText style={[s.statusLabel, { color: sc.color }]}>{sc.label}</AppText>
      </View>
      <TouchableOpacity
        onPress={() => !toggling && onToggle(row)}
        activeOpacity={0.7} style={s.toggleBtn} disabled={toggling}
      >
        {toggling
          ? <ActivityIndicator size="small" color={COLORS.muted} />
          : <AppText style={{ fontSize: 16, color: COLORS.muted }}>⇄</AppText>}
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const [classes, setClasses]         = useState<AttendanceClass[]>([]);
  const [classLoading, setClassLoading] = useState(true);
  const [classError, setClassError]   = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ tag: 'classes', refreshing: false });

  const loadClasses = useCallback(async (silent = false) => {
    if (!silent) setClassLoading(true);
    setClassError(null);
    try {
      setClasses(await getLecturerClasses());
    } catch (e: any) {
      setClassError(e.message ?? 'Failed to load classes');
    } finally {
      setClassLoading(false);
      setPhase({ tag: 'classes', refreshing: false });
    }
  }, []);

  useEffect(() => { loadClasses(); }, [loadClasses]);

  // ── Select class → load past sessions ─────────────────────────────────────

  const handleSelectClass = async (cls: AttendanceClass) => {
    setPhase({ tag: 'detail', cls, sessions: [], sessionsLoading: true, opening: false });
    const sessions = await getPastSessions(cls.id);
    setPhase({ tag: 'detail', cls, sessions, sessionsLoading: false, opening: false });
  };

  // ── Open session ───────────────────────────────────────────────────────────

  const handleOpenSession = async (cls: AttendanceClass, sessions: AttendanceSession[]) => {
    setPhase({ tag: 'detail', cls, sessions, sessionsLoading: false, opening: true });
    try {
      const session = await openAttendanceSession(cls.id);
      setPhase({ tag: 'video-pick', cls, sessionId: session.id });
    } catch (e: any) {
      Alert.alert('Failed to Open Session', e.message ?? 'Please try again.');
      setPhase({ tag: 'detail', cls, sessions, sessionsLoading: false, opening: false });
    }
  };

  // ── Pick & upload video ────────────────────────────────────────────────────

  const handlePickVideo = async (cls: AttendanceClass, sessionId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Please allow access to your media library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'videos' as any,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled) return;

    setPhase({ tag: 'uploading', cls, sessionId });
    try {
      const [aiRecords, enrollments] = await Promise.all([
        uploadAttendanceVideo(sessionId, result.assets[0].uri),
        getClassEnrollments(cls.id),
      ]);
      setPhase({ tag: 'results', cls, sessionId, records: aiRecords, enrollments, toggling: null });
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Please try again.', [
        { text: 'Retry', onPress: () => setPhase({ tag: 'video-pick', cls, sessionId }) },
        { text: 'Back',  onPress: () => setPhase({ tag: 'classes', refreshing: false }) },
      ]);
    }
  };

  // ── Toggle student ─────────────────────────────────────────────────────────

  const handleToggle = async (row: StudentRow) => {
    if (phase.tag !== 'results') return;
    const { cls, sessionId, records, enrollments } = phase;
    setPhase({ ...phase, toggling: row.studentId });
    const newStatus = row.record?.status === 'Present' ? 'Absent' : 'Present';
    try {
      const updated = row.record
        ? await updateAttendanceRecord(row.record.id, newStatus)
        : await createAttendanceRecord(sessionId, row.studentId, newStatus);
      const idx = records.findIndex((r) => r.studentId === row.studentId);
      const newRecords = idx >= 0
        ? records.map((r, i) => (i === idx ? updated : r))
        : [...records, updated];
      setPhase({ tag: 'results', cls, sessionId, records: newRecords, enrollments, toggling: null });
    } catch (e: any) {
      Alert.alert('Update Failed', e.message ?? 'Could not update attendance.');
      setPhase({ ...phase, toggling: null });
    }
  };

  // ── Back ───────────────────────────────────────────────────────────────────

  const goBack = () => {
    if (phase.tag === 'detail' || phase.tag === 'results') {
      setPhase({ tag: 'classes', refreshing: false });
    } else if (phase.tag === 'video-pick') {
      Alert.alert(
        'Cancel Session?',
        'The session will remain open. Leaving means attendance is not completed.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => setPhase({ tag: 'classes', refreshing: false }) },
        ],
      );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />
      <SafeAreaView style={{ flex: 1 }}>
        {renderPhase()}
      </SafeAreaView>
    </View>
  );

  function renderPhase() {

    // ── Phase 1: Class list ────────────────────────────────────────────────
    if (phase.tag === 'classes') {
      return (
        <>
          <View style={s.header}>
            <AppText variant="h2" style={{ color: COLORS.whiteSoft }}>Attendance</AppText>
            <AppText variant="caption" color={COLORS.muted}>Select a class to take attendance</AppText>
          </View>

          {classLoading ? (
            <View style={s.center}><ActivityIndicator size="large" color={COLORS.cyan} /></View>
          ) : classError ? (
            <View style={s.center}>
              <AppText style={{ fontSize: 36, marginBottom: 12 }}>⚠️</AppText>
              <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>Failed to load</AppText>
              <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 20 }}>{classError}</AppText>
              <Button label="Retry" onPress={() => loadClasses()} style={{ width: 140 }} />
            </View>
          ) : classes.length === 0 ? (
            <View style={s.center}>
              <AppText style={{ fontSize: 40, marginBottom: 12 }}>📋</AppText>
              <AppText variant="semi" color={COLORS.whiteSoft}>No classes found</AppText>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.scroll}
              refreshControl={
                <RefreshControl
                  refreshing={(phase as any).refreshing ?? false}
                  onRefresh={() => { setPhase({ tag: 'classes', refreshing: true }); loadClasses(true); }}
                  tintColor={COLORS.cyan}
                />
              }
            >
              <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 10 }}>
                {classes.length} {classes.length === 1 ? 'class' : 'classes'}
              </AppText>
              {classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls} onPress={() => handleSelectClass(cls)} />
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </>
      );
    }

    // ── Phase 2: Class detail + past sessions ──────────────────────────────
    if (phase.tag === 'detail') {
      const { cls, sessions, sessionsLoading, opening } = phase;
      return (
        <>
          <View style={s.backRow}>
            <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={s.backBtn}>
              <AppText style={s.backIcon}>‹</AppText>
              <AppText variant="semi" color={COLORS.blueBright}>Classes</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            {/* Class info */}
            <View style={s.infoCard}>
              <LinearGradient
                colors={[COLORS.blue, COLORS.cyan]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cardAccentBar}
              />
              <AppText variant="label" color={COLORS.muted} style={{ letterSpacing: 1, marginBottom: 8 }}>CLASS</AppText>
              <AppText variant="h3" color={COLORS.whiteSoft} style={{ marginBottom: 10 }}>{cls.courseName}</AppText>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {cls.courseCode && (
                  <View style={s.metaChip}><AppText style={s.metaChipText}>{cls.courseCode}</AppText></View>
                )}
                {cls.semester && (
                  <View style={s.metaChip}><AppText style={s.metaChipText}>{cls.semester}</AppText></View>
                )}
                {cls.academicYear && (
                  <View style={s.metaChip}><AppText style={s.metaChipText}>{cls.academicYear}</AppText></View>
                )}
              </View>
              {(cls.startDate || cls.endDate) && (
                <AppText variant="caption" color="rgba(241,245,255,0.35)">
                  📅 {fmtDate(cls.startDate)} — {fmtDate(cls.endDate)}
                </AppText>
              )}
            </View>

            {/* Past sessions */}
            <View style={s.sessionsCard}>
              <AppText variant="label" color={COLORS.muted} style={{ letterSpacing: 1, marginBottom: 10 }}>
                RECENT SESSIONS
              </AppText>
              {sessionsLoading ? (
                <ActivityIndicator size="small" color={COLORS.cyan} style={{ alignSelf: 'flex-start', marginLeft: 4 }} />
              ) : sessions.length === 0 ? (
                <AppText variant="caption" color="rgba(241,245,255,0.35)">No sessions yet</AppText>
              ) : (
                sessions.map((session, i) => (
                  <React.Fragment key={session.id}>
                    {i > 0 && <View style={s.thinDivider} />}
                    <SessionHistoryRow session={session} />
                  </React.Fragment>
                ))
              )}
            </View>

            {/* How it works */}
            <View style={s.instructCard}>
              <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 10, fontSize: 14 }}>
                How attendance works
              </AppText>
              {[
                'Start an attendance session for this class',
                'Record or pick a 5–10 second video of the room',
                'AI scans every 0.5s and identifies faces',
                'Review the results and adjust manually if needed',
              ].map((text, i) => (
                <View key={i} style={s.instructRow}>
                  <View style={s.stepDot}>
                    <AppText style={s.stepNum}>{i + 1}</AppText>
                  </View>
                  <AppText variant="caption" color="rgba(241,245,255,0.65)" style={{ flex: 1 }}>{text}</AppText>
                </View>
              ))}
            </View>

            <Button
              label={opening ? 'Opening Session…' : 'Start Attendance Session'}
              onPress={() => !opening && handleOpenSession(cls, sessions)}
              style={{ width: '100%', opacity: opening ? 0.6 : 1 }}
            />
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      );
    }

    // ── Phase 3: Video pick ────────────────────────────────────────────────
    if (phase.tag === 'video-pick') {
      const { cls, sessionId } = phase;
      return (
        <>
          <View style={s.backRow}>
            <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={s.backBtn}>
              <AppText style={s.backIcon}>‹</AppText>
              <AppText variant="semi" color={COLORS.blueBright}>Back</AppText>
            </TouchableOpacity>
            <View style={s.inProgressChip}>
              <View style={s.liveDot} />
              <AppText style={s.inProgressText}>Session Open</AppText>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <AppText variant="h3" color={COLORS.whiteSoft} style={{ marginBottom: 2 }}>{cls.courseName}</AppText>
            <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 24 }}>{cls.courseCode}</AppText>

            <View style={s.cameraIllustration}>
              <View style={s.cameraOrb} />
              <AppText style={s.cameraIcon}>🎬</AppText>
              <AppText variant="semi" color={COLORS.whiteSoft} style={{ fontSize: 16, marginTop: 14 }}>
                Select Classroom Video
              </AppText>
              <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                Pick a 5–10 second video panning across all students in the room
              </AppText>
            </View>

            <View style={s.tipsCard}>
              <AppText variant="label" color={COLORS.muted} style={{ letterSpacing: 1, marginBottom: 8 }}>TIPS</AppText>
              {['📷  Keep camera steady while panning', '💡  Ensure good lighting', '👤  Faces should be clearly visible', '⏱  5–10 seconds is ideal'].map((tip, i) => (
                <AppText key={i} variant="caption" color="rgba(241,245,255,0.55)" style={{ marginTop: 5 }}>{tip}</AppText>
              ))}
            </View>

            <Button label="Select Video from Gallery" onPress={() => handlePickVideo(cls, sessionId)} style={{ width: '100%' }} />
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      );
    }

    // ── Phase 4: Uploading ─────────────────────────────────────────────────
    if (phase.tag === 'uploading') {
      return (
        <View style={s.center}>
          <View style={s.uploadingOrbWrap}>
            <View style={s.uploadingOrb} />
            <AppText style={{ fontSize: 48, zIndex: 1 }}>🤖</AppText>
          </View>
          <AppText variant="h3" color={COLORS.whiteSoft} style={{ marginTop: 24, marginBottom: 8 }}>AI Processing</AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 24 }}>
            Scanning faces every 0.5 seconds…{'\n'}This may take a moment.
          </AppText>
          <ActivityIndicator size="large" color={COLORS.cyan} />
          <AppText variant="caption" color="rgba(241,245,255,0.25)" style={{ marginTop: 20 }}>Do not close the app</AppText>
        </View>
      );
    }

    // ── Phase 5: Results ───────────────────────────────────────────────────
    if (phase.tag === 'results') {
      const { cls, records, enrollments, toggling } = phase;
      const rows = mergeResults(records, enrollments);
      const presentCount = rows.filter((r) => r.record?.status === 'Present').length;
      const absentCount  = rows.length - presentCount;

      return (
        <>
          <View style={s.backRow}>
            <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={s.backBtn}>
              <AppText style={s.backIcon}>‹</AppText>
              <AppText variant="semi" color={COLORS.blueBright}>Done</AppText>
            </TouchableOpacity>
            <View style={s.completedChip}>
              <AppText style={s.completedText}>✓ Completed</AppText>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <View style={s.statsCard}>
              <LinearGradient
                colors={[COLORS.green, COLORS.cyan]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cardAccentBar}
              />
              <AppText variant="label" color={COLORS.muted} style={{ letterSpacing: 1, marginBottom: 2 }}>
                {cls.courseName}
              </AppText>
              <AppText variant="caption" color="rgba(241,245,255,0.35)" style={{ marginBottom: 14 }}>
                {cls.courseCode}  ·  {fmtSessionTime(new Date().toISOString())}
              </AppText>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <AppText style={[s.statNum, { color: COLORS.green }]}>{presentCount}</AppText>
                  <AppText variant="caption" color={COLORS.muted}>Present</AppText>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <AppText style={[s.statNum, { color: COLORS.red }]}>{absentCount}</AppText>
                  <AppText variant="caption" color={COLORS.muted}>Absent</AppText>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <AppText style={[s.statNum, { color: COLORS.whiteSoft }]}>{rows.length}</AppText>
                  <AppText variant="caption" color={COLORS.muted}>Total</AppText>
                </View>
              </View>
              <View style={s.progressBar}>
                <View style={{ flex: presentCount || 0.001, backgroundColor: COLORS.green, borderRadius: 3 }} />
                <View style={{ flex: absentCount  || 0.001, backgroundColor: COLORS.red,   borderRadius: 3 }} />
              </View>
            </View>

            <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 12 }}>
              Tap ⇄ to manually override AI results
            </AppText>

            <View style={s.studentList}>
              {rows.map((row) => (
                <StudentToggleRow key={row.studentId} row={row} toggling={toggling === row.studentId} onToggle={handleToggle} />
              ))}
            </View>
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      );
    }

    return null;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  orb:  { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 300, height: 300, top: -80,  right: -80, backgroundColor: 'rgba(37,99,235,0.08)'  },
  orb2: { width: 220, height: 220, bottom: 80, left: -70,  backgroundColor: 'rgba(6,182,212,0.06)' },

  header:  { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14, gap: 3 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scroll:  { paddingHorizontal: 20, paddingTop: 8 },

  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10 },
  backIcon:{ fontSize: 26, color: COLORS.blueBright, lineHeight: 28 },

  cardAccentBar: { height: 3 },

  classCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden',
    elevation: 3, shadowColor: COLORS.blue, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10,
  },
  classCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 18, gap: 10 },

  infoCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'], borderWidth: 1,
    borderColor: COLORS.border, padding: 18, paddingTop: 22, marginBottom: 14, overflow: 'hidden',
  },
  metaChip: {
    backgroundColor: 'rgba(37,99,235,0.12)', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.25)', paddingHorizontal: 11, paddingVertical: 4,
  },
  metaChipText: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.blueBright },

  sessionsCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 14,
  },
  sessionRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  sessionStatusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  sessionStatusText: { fontFamily: FONTS.bodySemi, fontSize: 10 },
  thinDivider:       { height: 1, backgroundColor: COLORS.border },

  instructCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 20,
  },
  instructRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  stepDot: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.35)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  stepNum: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.blueBright },

  inProgressChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green },
  inProgressText: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.green },
  completedChip:  {
    backgroundColor: 'rgba(6,182,212,0.12)', borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)', paddingHorizontal: 10, paddingVertical: 5,
  },
  completedText: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.cyan },

  cameraIllustration: {
    alignItems: 'center', paddingVertical: 28, marginBottom: 20,
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'],
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  cameraOrb:  { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(37,99,235,0.08)' },
  cameraIcon: { fontSize: 56, zIndex: 1 },

  tipsCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 20,
  },

  uploadingOrbWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  uploadingOrb: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(37,99,235,0.12)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.22)',
  },

  statsCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS['2xl'], borderWidth: 1,
    borderColor: COLORS.border, padding: 18, paddingTop: 22, marginBottom: 14, overflow: 'hidden',
  },
  statsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  statItem:    { alignItems: 'center', gap: 4 },
  statNum:     { fontFamily: FONTS.heading, fontSize: 38, lineHeight: 42 },
  statDivider: { width: 1, height: 48, backgroundColor: COLORS.border },
  progressBar: {
    flexDirection: 'row', height: 6, borderRadius: 3,
    overflow: 'hidden', backgroundColor: 'rgba(241,245,255,0.06)', gap: 2,
  },

  studentList: { gap: 8 },
  studentRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, padding: 12,
  },
  avatar:       { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(37,99,235,0.15)', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:   { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.blueBright },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, flexShrink: 0 },
  statusIcon:   { fontSize: 10 },
  statusLabel:  { fontFamily: FONTS.bodySemi, fontSize: 10 },
  confChip:     { backgroundColor: 'rgba(37,99,235,0.12)', borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  confChipText: { fontFamily: FONTS.bodySemi, fontSize: 9, color: COLORS.blueBright },
  manualChip:   { backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: RADIUS.xs, paddingHorizontal: 6, paddingVertical: 2 },
  manualChipText: { fontFamily: FONTS.bodySemi, fontSize: 9, color: COLORS.gold },
  toggleBtn:    { width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: 'rgba(241,245,255,0.05)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
