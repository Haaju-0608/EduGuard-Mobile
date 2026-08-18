import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Image,
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { getStudentViolations, getParticipationDetail, getSignedEvidenceUrl, ViolationLog, BEViolationType, BEViolationSeverity } from '../../api/violations';
import { useAuth } from '../../navigation/AuthContext';

// ── Types ───────────────────────────────────────────────────────────────────────
type ViolationType =
  | 'Face Mismatch'
  | 'Multiple Faces'
  | 'Looking Away'
  | 'No Face Detected'
  | 'Head Turn'
  | 'Face Obstructed'
  | 'Tab Switch'
  | 'Window Blur'
  | 'Exit Fullscreen';

type Severity = 'High' | 'Medium';
type ReviewStatus = 'Pending Review' | 'Reviewed';
type ViewState = 'exams' | 'violations';

interface ViolationRecord {
  id: string;
  participationId: string;
  type: ViolationType;
  exam: string | null;
  timestamp: string;
  rawDate: string;
  severity: Severity;
  status: ReviewStatus;
  description: string;
  hasEvidence: boolean;
  evidencePath: string | null;
}

interface ExamGroup {
  participationId: string;
  examName: string | null;
  latestDate: string;
  latestRaw: string;
  violations: ViolationRecord[];
  highCount: number;
  medCount: number;
}

// ── BE → Display mapping ────────────────────────────────────────────────────────

const VIOLATION_TYPE_MAP: Record<BEViolationType, { label: ViolationType; icon: string }> = {
  EyeDiversion:   { label: 'Looking Away',     icon: '👀' },
  GazeDiversion:  { label: 'Looking Away',     icon: '👀' }, // legacy
  Impersonation:  { label: 'Face Mismatch',    icon: '🎭' }, // legacy
  MultipleFaces:  { label: 'Multiple Faces',   icon: '👥' },
  Absence:        { label: 'No Face Detected', icon: '❓' },
  HeadTurn:       { label: 'Head Turn',        icon: '↩️' },
  FaceObstructed: { label: 'Face Obstructed',  icon: '😷' },
  TabSwitch:      { label: 'Tab Switch',       icon: '💻' },
  WindowBlur:     { label: 'Window Blur',      icon: '💻' },
  ExitFullscreen: { label: 'Exit Fullscreen',  icon: '💻' },
};

const SEVERITY_MAP: Record<BEViolationSeverity, Severity> = {
  Warning: 'Medium',
  Severe:  'High',
};

function toDisplay(log: ViolationLog): ViolationRecord {
  const typeInfo = VIOLATION_TYPE_MAP[log.violationType] ?? { label: 'Face Mismatch' as ViolationType, icon: '⚠️' };
  const d = new Date(log.recordedAt);
  const timestamp = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const confLine = log.aiConfidence != null
    ? ` AI confidence: ${Math.round(log.aiConfidence * 100)}%.`
    : '';

  return {
    id:              log.id,
    participationId: log.participationId,
    type:            typeInfo.label,
    // Tên bài thi không có sẵn trong response /api/violation-logs — được backfill riêng ở
    // load() qua getParticipationDetail() (đúng route /api/exam-participations/{id}).
    exam:            null,
    timestamp,
    rawDate:         log.recordedAt,
    severity:        SEVERITY_MAP[log.severity] ?? 'Medium',
    status:          log.isReviewed ? 'Reviewed' : 'Pending Review',
    description:     `${typeInfo.label} violation detected by AI system.${confLine}`,
    hasEvidence:     !!log.evidencePath,
    evidencePath:    log.evidencePath,
  };
}

// ── Config ──────────────────────────────────────────────────────────────────────
const SEV_CFG: Record<
  Severity,
  { color: string; bg: string; border: string; label: string }
> = {
  High:   { color: COLORS.red,  bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  label: 'HIGH'   },
  Medium: { color: COLORS.gold, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', label: 'MEDIUM' },
};

const TYPE_CFG: Record<ViolationType, { icon: string }> = {
  'Face Mismatch':    { icon: '🎭' },
  'Multiple Faces':   { icon: '👥' },
  'Looking Away':     { icon: '👀' },
  'No Face Detected': { icon: '❓' },
  'Head Turn':        { icon: '↩️' },
  'Face Obstructed':  { icon: '😷' },
  'Tab Switch':       { icon: '💻' },
  'Window Blur':      { icon: '💻' },
  'Exit Fullscreen':  { icon: '💻' },
};

const REVIEW_CFG: Record<
  ReviewStatus,
  { color: string; bg: string; border: string }
> = {
  'Pending Review': { color: COLORS.gold, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)' },
  'Reviewed':       { color: COLORS.cyan, bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.28)'  },
};

// ── Evidence media ───────────────────────────────────────────────────────────────
function EvidenceSnapshot({ violation, signedUrl, urlLoading }: {
  violation: ViolationRecord;
  signedUrl: string | null;
  urlLoading: boolean;
}) {
  const sev = SEV_CFG[violation.severity];

  if (!violation.hasEvidence) {
    return (
      <View style={ev.noEvidenceBox}>
        <AppText style={{ fontSize: 36, marginBottom: 10 }}>📷</AppText>
        <AppText variant="semi" color={COLORS.muted}>No Evidence Captured</AppText>
        <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 4, textAlign: 'center' }}>
          This violation was logged by the AI system without a snapshot.
        </AppText>
      </View>
    );
  }

  const ext = violation.evidencePath?.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);

  if (isImage && signedUrl) {
    return (
      <View style={ev.root}>
        <Image source={{ uri: signedUrl }} style={ev.evidenceImage} resizeMode="cover" />
        <View style={[ev.evidenceBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
          <AppText style={[ev.evidenceBadgeText, { color: sev.color }]}>📷 Evidence Snapshot</AppText>
        </View>
      </View>
    );
  }

  // Video (.webm) — inline player
  if (urlLoading) {
    return (
      <View style={[ev.videoThumb, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={sev.color} />
        <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 10 }}>Loading video…</AppText>
      </View>
    );
  }

  if (!signedUrl) {
    return (
      <View style={ev.noEvidenceBox}>
        <AppText style={{ fontSize: 30, marginBottom: 8 }}>⚠️</AppText>
        <AppText variant="semi" color={COLORS.muted}>Could not load video</AppText>
      </View>
    );
  }

  return (
    <Video
      source={{ uri: signedUrl }}
      style={ev.videoPlayer}
      useNativeControls
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay={false}
    />
  );
}

// ── Violation detail modal ──────────────────────────────────────────────────────
function ViolationDetailModal({
  violation,
  onClose,
}: {
  violation: ViolationRecord | null;
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl]     = useState<string | null>(null);
  const [urlLoading, setUrlLoading]   = useState(false);

  useEffect(() => {
    if (!violation?.evidencePath) { setSignedUrl(null); return; }
    setSignedUrl(null);
    setUrlLoading(true);
    getSignedEvidenceUrl(violation.evidencePath)
      .then(setSignedUrl)
      .catch(() => setSignedUrl(null))
      .finally(() => setUrlLoading(false));
  }, [violation?.evidencePath]);

  if (!violation) return null;
  const sev    = SEV_CFG[violation.severity];
  const rev    = REVIEW_CFG[violation.status];
  const type   = TYPE_CFG[violation.type];

  const details: { label: string; value: string }[] = [
    { label: 'Timestamp', value: violation.timestamp },
    { label: 'Severity',  value: violation.severity  },
    { label: 'Status',    value: violation.status    },
  ];

  return (
    <Modal
      visible={violation !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={md.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={md.sheet}>
          <View style={md.dragHandle} />

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <LinearGradient
              colors={[sev.color + '22', 'transparent']}
              style={md.sheetHeaderGrad}
            >
              <View style={[md.typeIconBubble, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                <AppText style={{ fontSize: 26 }}>{type.icon}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3" style={{ color: COLORS.whiteSoft }}>
                  {violation.type}
                </AppText>
                <View style={[md.sevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                  <AppText style={[md.sevBadgeText, { color: sev.color }]}>
                    {sev.label} SEVERITY
                  </AppText>
                </View>
              </View>
            </LinearGradient>

            <View style={md.evidenceSection}>
              <AppText variant="label" style={{ marginBottom: 10, letterSpacing: 0.8 }}>
                Evidence Snapshot
              </AppText>
              <EvidenceSnapshot violation={violation} signedUrl={signedUrl} urlLoading={urlLoading} />
            </View>

            <View style={md.detailsGrid}>
              {details.map((d) => (
                <View key={d.label} style={md.detailRow}>
                  <AppText variant="caption" color={COLORS.muted} style={{ width: 82 }}>
                    {d.label}
                  </AppText>
                  <View style={{ flex: 1 }}>
                    {d.label === 'Status' ? (
                      <View style={[md.reviewBadge, { backgroundColor: rev.bg, borderColor: rev.border }]}>
                        <AppText style={[md.reviewBadgeText, { color: rev.color }]}>
                          {d.value}
                        </AppText>
                      </View>
                    ) : d.label === 'Severity' ? (
                      <AppText variant="body-sm" color={sev.color}>
                        {d.value}
                      </AppText>
                    ) : (
                      <AppText variant="body-sm" color={COLORS.whiteSoft}>
                        {d.value}
                      </AppText>
                    )}
                  </View>
                </View>
              ))}
            </View>

            <View style={md.descSection}>
              <AppText variant="label" style={{ marginBottom: 8, letterSpacing: 0.8 }}>
                AI Detection Report
              </AppText>
              <View style={[md.descBox, { borderColor: sev.border }]}>
                <AppText variant="body-sm" color={COLORS.muted} style={{ lineHeight: 20 }}>
                  {violation.description}
                </AppText>
              </View>
            </View>

            <View style={md.closeSection}>
              <Button label="Close" variant="ghost" onPress={onClose} style={{ width: '100%' }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Exam group card ─────────────────────────────────────────────────────────────
function ExamCard({ group, onPress }: { group: ExamGroup; onPress: () => void }) {
  const hasHigh = group.highCount > 0;
  const sev = hasHigh ? SEV_CFG.High : SEV_CFG.Medium;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[s.examCard, { borderLeftColor: sev.color }]}
    >
      <View style={[s.examIconBubble, { backgroundColor: sev.bg, borderColor: sev.border }]}>
        <AppText style={{ fontSize: 22 }}>📋</AppText>
      </View>

      <View style={s.examCardContent}>
        <AppText variant="semi" color={COLORS.whiteSoft} numberOfLines={2}>
          {group.examName ?? 'Exam Session'}
        </AppText>
        <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 2 }}>
          {group.latestDate}
        </AppText>
        <View style={s.examBadgeRow}>
          {group.highCount > 0 && (
            <View style={[s.examBadge, { backgroundColor: SEV_CFG.High.bg, borderColor: SEV_CFG.High.border }]}>
              <AppText style={[s.examBadgeText, { color: SEV_CFG.High.color }]}>{group.highCount} HIGH</AppText>
            </View>
          )}
          {group.medCount > 0 && (
            <View style={[s.examBadge, { backgroundColor: SEV_CFG.Medium.bg, borderColor: SEV_CFG.Medium.border }]}>
              <AppText style={[s.examBadgeText, { color: SEV_CFG.Medium.color }]}>{group.medCount} MEDIUM</AppText>
            </View>
          )}
          <View style={[s.examBadge, { backgroundColor: 'rgba(241,245,255,0.05)', borderColor: COLORS.border }]}>
            <AppText style={[s.examBadgeText, { color: COLORS.muted }]}>{group.violations.length} total</AppText>
          </View>
        </View>
      </View>

      <AppText style={s.chevron}>›</AppText>
    </TouchableOpacity>
  );
}

// ── Violation list card ─────────────────────────────────────────────────────────
function ViolationCard({
  item,
  onPress,
}: {
  item: ViolationRecord;
  onPress: () => void;
}) {
  const sev  = SEV_CFG[item.severity];
  const rev  = REVIEW_CFG[item.status];
  const type = TYPE_CFG[item.type];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.78}
      style={[s.card, { borderLeftColor: sev.color }]}
    >
      <View style={[s.cardIconBubble, { backgroundColor: sev.bg, borderColor: sev.border }]}>
        <AppText style={s.cardIcon}>{type.icon}</AppText>
      </View>

      <View style={s.cardContent}>
        <View style={s.cardTopRow}>
          <AppText variant="semi" color={COLORS.whiteSoft} style={{ flex: 1 }} numberOfLines={1}>
            {item.type}
          </AppText>
          <View style={[s.sevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
            <AppText style={[s.sevBadgeText, { color: sev.color }]}>{sev.label}</AppText>
          </View>
        </View>

        <View style={s.cardBottomRow}>
          <AppText variant="caption" color={COLORS.muted}>
            {item.timestamp}
          </AppText>
          <View style={[s.reviewBadge, { backgroundColor: rev.bg, borderColor: rev.border }]}>
            <AppText style={[s.reviewText, { color: rev.color }]}>{item.status}</AppText>
          </View>
        </View>
      </View>

      <AppText style={s.chevron}>›</AppText>
    </TouchableOpacity>
  );
}

// ── Filter pill ─────────────────────────────────────────────────────────────────
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

// ── Filter options ──────────────────────────────────────────────────────────────
type FilterKey = 'all' | Severity;

const FILTER_OPTIONS: { key: FilterKey; label: string; accentColor?: string }[] = [
  { key: 'all',    label: 'All'        },
  { key: 'High',   label: '🔴 High',   accentColor: COLORS.red  },
  { key: 'Medium', label: '🟡 Medium', accentColor: COLORS.gold },
];

// ── Main screen ─────────────────────────────────────────────────────────────────
export default function ViolationHistoryScreen({ embedded = false }: { embedded?: boolean }) {
  const { authState } = useAuth();
  const studentId = authState.user?.id ?? '';

  const [violations, setViolations]       = useState<ViolationRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [filter, setFilter]               = useState<FilterKey>('all');
  const [selected, setSelected]           = useState<ViolationRecord | null>(null);
  const [view, setView]                   = useState<ViewState>('exams');
  const [selectedGroup, setSelectedGroup] = useState<ExamGroup | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const logs = await getStudentViolations(studentId);
      const records = logs.map(toDisplay);

      // Resolve exam names for each unique participationId
      const uniqueIds = [...new Set(records.map((r) => r.participationId))];
      const nameMap = new Map<string, string>();
      await Promise.all(
        uniqueIds.map(async (pid) => {
          const detail = await getParticipationDetail(pid);
          const name = detail?.examName ?? null;
          if (name) nameMap.set(pid, name);
        }),
      );

      setViolations(
        records.map((r) =>
          nameMap.has(r.participationId) ? { ...r, exam: nameMap.get(r.participationId)! } : r,
        ),
      );
    } catch (e: any) {
      setError(e.message ?? 'Failed to load violations');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, []);

  // Group violations by participationId
  const examGroups = useMemo<ExamGroup[]>(() => {
    const map = new Map<string, ViolationRecord[]>();
    for (const v of violations) {
      if (!map.has(v.participationId)) map.set(v.participationId, []);
      map.get(v.participationId)!.push(v);
    }
    return Array.from(map.entries())
      .map(([participationId, items]) => {
        const sorted = [...items].sort(
          (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
        );
        const latest = new Date(sorted[0].rawDate);
        return {
          participationId,
          examName:   sorted[0].exam ?? null,
          latestDate: latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          latestRaw:  sorted[0].rawDate,
          violations: sorted,
          highCount:  items.filter((v) => v.severity === 'High').length,
          medCount:   items.filter((v) => v.severity === 'Medium').length,
        };
      })
      .sort((a, b) => new Date(b.latestRaw).getTime() - new Date(a.latestRaw).getTime());
  }, [violations]);

  const filtered = useMemo(() => {
    if (!selectedGroup) return [];
    return filter === 'all'
      ? selectedGroup.violations
      : selectedGroup.violations.filter((v) => v.severity === filter);
  }, [filter, selectedGroup]);

  const highCount    = violations.filter((v) => v.severity === 'High').length;
  const medCount     = violations.filter((v) => v.severity === 'Medium').length;
  const pendingCount = violations.filter((v) => v.status === 'Pending Review').length;

  function goToExams() {
    setView('exams');
    setSelectedGroup(null);
    setFilter('all');
    setSelected(null);
  }

  function openGroup(group: ExamGroup) {
    setSelectedGroup(group);
    setFilter('all');
    setView('violations');
  }

  const innerContent = (
    <>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 12 }}>Loading violations…</AppText>
        </View>
      ) : error ? (
        <View style={s.center}>
          <AppText style={{ fontSize: 36, marginBottom: 12 }}>⚠️</AppText>
          <AppText variant="semi" color={COLORS.whiteSoft} style={{ marginBottom: 6 }}>Failed to load</AppText>
          <AppText variant="caption" color={COLORS.muted} style={{ textAlign: 'center', marginBottom: 20 }}>{error}</AppText>
          <Button label="Retry" onPress={load} style={{ width: 140 }} />
        </View>
      ) : view === 'exams' ? (
        <>
          {/* Summary chips */}
          <View style={s.summaryRow}>
            {[
              { label: 'High',   count: highCount, sev: SEV_CFG.High   },
              { label: 'Medium', count: medCount,  sev: SEV_CFG.Medium },
            ].map((item) => (
              <View key={item.label} style={[s.summaryChip, { backgroundColor: item.sev.bg, borderColor: item.sev.border }]}>
                <AppText style={[s.summaryChipCount, { color: item.sev.color }]}>{item.count}</AppText>
                <AppText variant="caption" color={COLORS.muted}>{item.label}</AppText>
              </View>
            ))}
            <View style={[s.summaryChip, { backgroundColor: 'rgba(241,245,255,0.04)', borderColor: COLORS.border }]}>
              <AppText style={[s.summaryChipCount, { color: COLORS.muted }]}>{violations.length}</AppText>
              <AppText variant="caption" color={COLORS.muted}>Total</AppText>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 10 }}>
              {examGroups.length} {examGroups.length === 1 ? 'exam' : 'exams'}
            </AppText>
            {examGroups.length === 0 ? (
              <View style={s.empty}>
                <AppText style={{ fontSize: 36, lineHeight: 52, marginBottom: 6 }}>✅</AppText>
                <AppText variant="semi" color={COLORS.whiteSoft}>No violations</AppText>
                <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 4, textAlign: 'center' }}>
                  No AI-detected violations on record
                </AppText>
              </View>
            ) : (
              <View style={s.list}>
                {examGroups.map((group) => (
                  <ExamCard key={group.participationId} group={group} onPress={() => openGroup(group)} />
                ))}
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </>
      ) : (
        <>
          {/* Back bar */}
          <TouchableOpacity onPress={goToExams} activeOpacity={0.75} style={s.backBar}>
            <AppText style={s.backIcon}>‹</AppText>
            <AppText variant="semi" color={COLORS.blueBright} style={{ fontSize: 14 }}>All Exams</AppText>
          </TouchableOpacity>

          {/* Exam name sub-header */}
          <View style={s.examSubHeader}>
            <AppText variant="semi" color={COLORS.whiteSoft} numberOfLines={2}>
              {selectedGroup?.examName ?? 'Exam Session'}
            </AppText>
            <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 2 }}>
              {selectedGroup?.latestDate}
            </AppText>
          </View>

          {/* Filter pills */}
          <View style={s.filterRow}>
            {FILTER_OPTIONS.map((f) => (
              <FilterPill
                key={f.key}
                label={f.label}
                active={filter === f.key}
                accentColor={f.accentColor}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            <AppText variant="caption" color={COLORS.muted} style={{ marginBottom: 10 }}>
              {filtered.length} {filtered.length === 1 ? 'violation' : 'violations'}
            </AppText>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <AppText style={{ fontSize: 36, lineHeight: 52, marginBottom: 6 }}>✅</AppText>
                <AppText variant="semi" color={COLORS.whiteSoft}>No violations</AppText>
                <AppText variant="caption" color={COLORS.muted} style={{ marginTop: 4, textAlign: 'center' }}>
                  No violations matching this filter
                </AppText>
              </View>
            ) : (
              <View style={s.list}>
                {filtered.map((item) => (
                  <ViolationCard key={item.id} item={item} onPress={() => setSelected(item)} />
                ))}
              </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>

          <ViolationDetailModal violation={selected} onClose={() => setSelected(null)} />
        </>
      )}
    </>
  );

  if (embedded) return innerContent;

  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <View style={[s.orb, s.orb1]} />
      <View style={[s.orb, s.orb2]} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <View>
            <AppText variant="h2">Violations</AppText>
            <AppText variant="caption">AI-detected exam violations</AppText>
          </View>
          {!loading && pendingCount > 0 && (
            <View style={s.pendingBadge}>
              <AppText style={s.pendingBadgeText}>{pendingCount} pending</AppText>
            </View>
          )}
        </View>
        {innerContent}
      </SafeAreaView>
    </View>
  );
}

// ── Screen styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },

  orb: { position: 'absolute', borderRadius: RADIUS.full },
  orb1: { width: 280, height: 280, top: -70,  right: -70, backgroundColor: 'rgba(239,68,68,0.06)'  },
  orb2: { width: 200, height: 200, bottom: 80, left: -60,  backgroundColor: 'rgba(6,182,212,0.06)' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.32)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  pendingBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.gold,
  },

  // Back bar
  backBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 4,
  },
  backIcon: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.blueBright,
    lineHeight: 28,
  },

  // Exam sub-header (violations view)
  examSubHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },

  // Summary chips
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  summaryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  summaryChipCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  filterPill: {
    paddingHorizontal: 11,
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 40 },
  empty:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },

  // Scroll + list
  scroll: { paddingHorizontal: 20 },
  list: { gap: 10 },

  // Exam card
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    padding: 14,
  },
  examIconBubble: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  examCardContent: {
    flex: 1,
    gap: 4,
  },
  examBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
  },
  examBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  examBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 9,
    letterSpacing: 0.4,
  },

  // Violation card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.navyCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    padding: 14,
  },
  cardIconBubble: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIcon: { fontSize: 20 },
  cardContent: { flex: 1, gap: 4 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sevBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    flexShrink: 0,
  },
  sevBadgeText: { fontFamily: FONTS.bodySemi, fontSize: 9, letterSpacing: 0.5 },
  reviewBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    flexShrink: 0,
  },
  reviewText: { fontFamily: FONTS.bodySemi, fontSize: 9 },
  chevron: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: 'rgba(241,245,255,0.25)',
    flexShrink: 0,
  },
});

// ── Modal styles ────────────────────────────────────────────────────────────────
const md = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(4,7,20,0.78)',
  },
  sheet: {
    backgroundColor: COLORS.navyCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
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
    marginBottom: 4,
  },

  sheetHeaderGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  typeIconBubble: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sevBadge: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  sevBadgeText: { fontFamily: FONTS.bodySemi, fontSize: 10, letterSpacing: 0.5 },

  evidenceSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  detailsGrid: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  reviewBadgeText: { fontFamily: FONTS.bodySemi, fontSize: 11 },

  descSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  descBox: {
    backgroundColor: 'rgba(241,245,255,0.04)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 14,
  },

  closeSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
});

// ── Evidence styles ─────────────────────────────────────────────────────────────
const ev = StyleSheet.create({
  root: { borderRadius: RADIUS.lg, overflow: 'hidden' },

  evidenceImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
  },
  evidenceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  evidenceBadgeText: { fontFamily: FONTS.bodySemi, fontSize: 10 },

  videoPlayer: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoThumb: {
    height: 180,
    backgroundColor: '#040810',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  noEvidenceBox: {
    height: 160,
    backgroundColor: 'rgba(241,245,255,0.04)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
