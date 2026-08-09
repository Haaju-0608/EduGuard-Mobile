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
  ExamSlotBrief,
  createAttendanceRecord,
  getClassEnrollments,
  getExamSlotsForClass,
  getInProgressSessionForClass,
  getLecturerClasses,
  openAttendanceSession,
  updateAttendanceRecord,
  uploadAttendanceVideo,
} from '../../api/attendance';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'classes'; refreshing: boolean }
  | { tag: 'exams'; cls: AttendanceClass; exams: ExamSlotBrief[]; loading: boolean; error: string | null }
  | { tag: 'video-pick'; cls: AttendanceClass; exam: ExamSlotBrief; sessionId: string }
  | { tag: 'uploading'; cls: AttendanceClass; exam: ExamSlotBrief }
  | {
      tag: 'results';
      cls: AttendanceClass;
      exam: ExamSlotBrief;
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

function fmtTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (isToday) return time;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

function fmtExamDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameDay(d, today)) return `Today · ${fmtTime(iso)}`;
  if (sameDay(d, tomorrow)) return `Tomorrow · ${fmtTime(iso)}`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + fmtTime(iso);
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

// ── Exam status config ────────────────────────────────────────────────────────

const EXAM_STATUS_CFG = {
  Scheduled:  { color: COLORS.blueBright, bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.28)',  label: 'Scheduled',   icon: '🗓' },
  InProgress: { color: COLORS.green,      bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.28)', label: 'In Progress', icon: '🟢' },
  Completed:  { color: COLORS.muted,      bg: 'rgba(241,245,255,0.06)', border: 'rgba(241,245,255,0.12)', label: 'Completed', icon: '✓'  },
  Cancelled:  { color: COLORS.red,        bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  label: 'Cancelled',   icon: '✗'  },
};

// ── ClassCard ─────────────────────────────────────────────────────────────────

function ClassCard({ cls, onPress }: { cls: AttendanceClass; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={s.classCard}>
      <LinearGradient colors={[COLORS.blue, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
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

// ── ExamCard ──────────────────────────────────────────────────────────────────

function ExamCard({ exam, onPress }: { exam: ExamSlotBrief; onPress: () => void }) {
  const sc = EXAM_STATUS_CFG[exam.status] ?? EXAM_STATUS_CFG.Scheduled;
  const isExpired = new Date(exam.endTime) < new Date();
  const canAttend = (exam.status === 'InProgress' || exam.status === 'Scheduled') && !isExpired;
  const expiredLabel = isExpired && exam.status !== 'Cancelled' && exam.status !== 'Completed';

  return (
    <TouchableOpacity
      activeOpacity={canAttend ? 0.75 : 1}
      onPress={canAttend ? onPress : undefined}
      style={[s.examCard, !canAttend && { opacity: 0.5 }]}
    >
      <View style={[s.examStatusStripe, { backgroundColor: sc.color }]} />
      <View style={s.examCardBody}>
        <View style={{ flex: 1 }}>
          <AppText variant="semi" color={COLORS.whiteSoft} numberOfLines={1} style={{ fontSize: 14 }}>
            {exam.examName}
          </AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 4 }}>
            📅  {fmtExamDate(exam.startTime)}
          </AppText>
          <AppText variant="caption" color="rgba(241,245,255,0.35)" style={{ marginTop: 2 }}>
            ⏱  Until {fmtTime(exam.endTime)}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          {expiredLabel ? (
            <View style={[s.examStatusChip, { backgroundColor: 'rgba(100,100,100,0.15)', borderColor: 'rgba(100,100,100,0.3)' }]}>
              <AppText style={[s.examStatusText, { color: COLORS.muted }]}>Expired</AppText>
            </View>
          ) : (
            <View style={[s.examStatusChip, { backgroundColor: sc.bg, borderColor: sc.border }]}>
              <AppText style={[s.examStatusText, { color: sc.color }]}>{sc.label}</AppText>
            </View>
          )}
          {canAttend && <AppText style={{ fontSize: 18, color: COLORS.muted }}>›</AppText>}
        </View>
      </View>
    </TouchableOpacity>
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
  const [classes, setClasses]           = useState<AttendanceClass[]>([]);
  const [classLoading, setClassLoading] = useState(true);
  const [classError, setClassError]     = useState<string | null>(null);
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

  // ── Select class → load exam slots ────────────────────────────────────────

  const handleSelectClass = async (cls: AttendanceClass) => {
    setPhase({ tag: 'exams', cls, exams: [], loading: true, error: null });
    try {
      const raw = await getExamSlotsForClass(cls.id);
      const now = Date.now();
      const priority = (e: ExamSlotBrief) => {
        const active = (e.status === 'Scheduled' || e.status === 'InProgress') && new Date(e.endTime).getTime() > now;
        return active ? 0 : 1;
      };
      const exams = [...raw].sort((a, b) => {
        const pd = priority(a) - priority(b);
        if (pd !== 0) return pd;
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      });
      setPhase({ tag: 'exams', cls, exams, loading: false, error: null });
    } catch (e: any) {
      setPhase({ tag: 'exams', cls, exams: [], loading: false, error: e.message ?? 'Failed to load exams' });
    }
  };

  // ── Select exam → open session ─────────────────────────────────────────────

  const handleSelectExam = async (cls: AttendanceClass, exam: ExamSlotBrief) => {
    Alert.alert(
      'Start Attendance',
      `Start attendance for "${exam.examName}"?\n\nYou will then select a video to upload.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start', onPress: async () => {
            setPhase({ tag: 'uploading', cls, exam });
            try {
              const session = await openAttendanceSession(cls.id, exam.id);
              setPhase({ tag: 'video-pick', cls, exam, sessionId: session.id });
            } catch (e: any) {
              const alreadyOpen = /already has an in-progress/i.test(e.message ?? '');
              const reloadedExams = await getExamSlotsForClass(cls.id).catch(() => []);

              if (alreadyOpen) {
                const existing = await getInProgressSessionForClass(cls.id);
                if (existing) {
                  setPhase({ tag: 'exams', cls, exams: reloadedExams, loading: false, error: null });
                  Alert.alert(
                    'Session Already Open',
                    'This class has an ongoing attendance session. Would you like to continue it?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue',
                        onPress: () => setPhase({ tag: 'video-pick', cls, exam, sessionId: existing.id }),
                      },
                    ],
                  );
                  return;
                }
              }

              setPhase({ tag: 'exams', cls, exams: reloadedExams, loading: false, error: null });
              Alert.alert('Failed to Open Session', e.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  };

  // ── Pick & upload video ────────────────────────────────────────────────────

  const handlePickVideo = async (cls: AttendanceClass, exam: ExamSlotBrief, sessionId: string) => {
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

    setPhase({ tag: 'uploading', cls, exam });
    try {
      const [aiRecords, enrollments] = await Promise.all([
        uploadAttendanceVideo(sessionId, result.assets[0].uri),
        getClassEnrollments(cls.id),
      ]);
      setPhase({ tag: 'results', cls, exam, sessionId, records: aiRecords, enrollments, toggling: null });
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message ?? 'Please try again.', [
        { text: 'Retry', onPress: () => setPhase({ tag: 'video-pick', cls, exam, sessionId }) },
        { text: 'Back',  onPress: () => setPhase({ tag: 'classes', refreshing: false }) },
      ]);
    }
  };

  // ── Toggle student ─────────────────────────────────────────────────────────

  const handleToggle = async (row: StudentRow) => {
    if (phase.tag !== 'results') return;
    const { cls, exam, sessionId, records, enrollments } = phase;
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
      setPhase({ tag: 'results', cls, exam, sessionId, records: newRecords, enrollments, toggling: null });
    } catch (e: any) {
      Alert.alert('Update Failed', e.message ?? 'Could not update attendance.');
      setPhase({ ...phase, toggling: null });
    }
  };

  // ── Back ───────────────────────────────────────────────────────────────────

  const goBack = () => {
    if (phase.tag === 'exams') {
      setPhase({ tag: 'classes', refreshing: false });
    } else if (phase.tag === 'results') {
      setPhase({ tag: 'classes', refreshing: false });
    } else if (phase.tag === 'video-pick') {
      Alert.alert(
        'Cancel?',
        'The session will remain open. Leave without completing attendance?',
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
      <SafeAreaView style={{ flex: 1 }}>{renderPhase()}</SafeAreaView>
    </View>
  );

  function renderPhase() {

    // ── Phase 1: Class list ──────────────────────────────────────────────────
    if (phase.tag === 'classes') {
      return (
        <>
          <View style={s.header}>
            <AppText variant="h2" style={{ color: COLORS.whiteSoft }}>Attendance</AppText>
            <AppText variant="caption" color={COLORS.muted}>Select a class to view exam slots</AppText>
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

    // ── Phase 2: Exam list ───────────────────────────────────────────────────
    if (phase.tag === 'exams') {
      const { cls, exams, loading, error } = phase;
      return (
        <>
          <View style={s.backRow}>
            <TouchableOpacity onPress={goBack} activeOpacity={0.7} style={s.backBtn}>
              <AppText style={s.backIcon}>‹</AppText>
              <AppText variant="semi" color={COLORS.blueBright}>Classes</AppText>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            {/* Class info strip */}
            <View style={s.classInfoStrip}>
              <LinearGradient colors={[COLORS.blue, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
              <AppText variant="semi" color={COLORS.whiteSoft} numberOfLines={1}>{cls.courseName}</AppText>
              <AppText variant="caption" color={COLORS.muted}>
                {cls.courseCode}{cls.semester ? `  ·  ${cls.semester}` : ''}
              </AppText>
            </View>

            <AppText variant="label" color={COLORS.muted} style={{ letterSpacing: 1, marginBottom: 10 }}>
              EXAM SLOTS
            </AppText>

            {loading ? (
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.cyan} />
                <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 12 }}>Loading exam slots…</AppText>
              </View>
            ) : error ? (
              <View style={s.errorCard}>
                <AppText style={{ fontSize: 32, marginBottom: 10 }}>⚠️</AppText>
                <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>Could not load exams</AppText>
                <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 16, lineHeight: 19 }}>
                  {error}
                </AppText>
                <Button label="Retry" onPress={() => handleSelectClass(cls)} style={{ width: 140 }} />
              </View>
            ) : exams.length === 0 ? (
              <View style={s.emptyCard}>
                <AppText style={{ fontSize: 36, marginBottom: 10 }}>📭</AppText>
                <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 4 }}>No exam slots</AppText>
                <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center' }}>
                  No exam slots have been created for this class yet.
                </AppText>
              </View>
            ) : (
              <>
                <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 12 }}>
                  Tap an active exam to start attendance
                </AppText>
                {exams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} onPress={() => handleSelectExam(cls, exam)} />
                ))}
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      );
    }

    // ── Phase 3: Video pick ──────────────────────────────────────────────────
    if (phase.tag === 'video-pick') {
      const { cls, exam, sessionId } = phase;
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
            {/* Exam context */}
            <View style={s.examContextCard}>
              <LinearGradient colors={[COLORS.blue, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
              <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 4 }}>Taking attendance for</AppText>
              <AppText variant="h3" color={COLORS.whiteSoft} numberOfLines={2}>{exam.examName}</AppText>
              <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 4 }}>
                {cls.courseName}  ·  {fmtExamDate(exam.startTime)}
              </AppText>
            </View>

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
              {[
                '📷  Keep camera steady while panning',
                '💡  Ensure good lighting',
                '👤  Faces should be clearly visible',
                '⏱  5–10 seconds is ideal',
              ].map((tip, i) => (
                <AppText key={i} variant="caption" color="rgba(241,245,255,0.55)" style={{ marginTop: 5 }}>{tip}</AppText>
              ))}
            </View>

            <Button
              label="Select Video from Gallery"
              onPress={() => handlePickVideo(cls, exam, sessionId)}
              style={{ width: '100%' }}
            />
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      );
    }

    // ── Phase 4: Uploading / processing ─────────────────────────────────────
    if (phase.tag === 'uploading') {
      const { exam } = phase;
      return (
        <View style={s.center}>
          <View style={s.uploadingOrbWrap}>
            <View style={s.uploadingOrb} />
            <AppText style={{ fontSize: 48, zIndex: 1 }}>🤖</AppText>
          </View>
          <AppText variant="h3" color={COLORS.whiteSoft} style={{ marginTop: 24, marginBottom: 4 }}>AI Processing</AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 6 }}>
            {exam.examName}
          </AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 24 }}>
            Scanning faces every 0.5 seconds…{'\n'}This may take a moment.
          </AppText>
          <ActivityIndicator size="large" color={COLORS.cyan} />
          <AppText variant="caption" color="rgba(241,245,255,0.25)" style={{ marginTop: 20 }}>Do not close the app</AppText>
        </View>
      );
    }

    // ── Phase 5: Results ─────────────────────────────────────────────────────
    if (phase.tag === 'results') {
      const { cls, exam, records, enrollments, toggling } = phase;
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
              <LinearGradient colors={[COLORS.green, COLORS.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />
              <AppText variant="label" color={COLORS.muted} style={{ letterSpacing: 1, marginBottom: 2 }}>
                {exam.examName}
              </AppText>
              <AppText variant="caption" color="rgba(241,245,255,0.35)" style={{ marginBottom: 14 }}>
                {cls.courseName}  ·  {fmtExamDate(exam.startTime)}
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

  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14, gap: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  backRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10 },
  backIcon:{ fontSize: 26, color: COLORS.blueBright, lineHeight: 28 },

  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },

  // Class card
  classCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden',
  },
  classCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 18, gap: 10 },

  // Class info strip (in exams phase)
  classInfoStrip: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, paddingTop: 18, marginBottom: 20, overflow: 'hidden', gap: 3,
  },

  // Exam card
  examCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, marginBottom: 10, flexDirection: 'row', overflow: 'hidden',
  },
  examStatusStripe: { width: 4, flexShrink: 0 },
  examCardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  examStatusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  examStatusText: { fontFamily: FONTS.bodySemi, fontSize: 10 },

  // Error / empty states
  errorCard: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyCard: { alignItems: 'center', paddingVertical: 32 },

  // Video pick phase
  examContextCard: {
    backgroundColor: COLORS.navyCard, borderRadius: RADIUS.xl, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, paddingTop: 20, marginBottom: 20, overflow: 'hidden',
  },
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

  // Chips
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

  // Uploading
  uploadingOrbWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  uploadingOrb: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(37,99,235,0.12)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.22)',
  },

  // Results
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
