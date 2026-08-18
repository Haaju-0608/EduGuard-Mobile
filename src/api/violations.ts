import { apiRequest } from './client';

export type BEViolationType =
  | 'EyeDiversion'
  | 'GazeDiversion'   // legacy alias — keep for backwards compat
  | 'HeadTurn'
  | 'MultipleFaces'
  | 'FaceObstructed'
  | 'Absence'
  | 'Impersonation'   // legacy
  | 'TabSwitch'
  | 'WindowBlur'
  | 'ExitFullscreen';

export type BEViolationSeverity = 'Warning' | 'Severe';

export interface ViolationLog {
  id: string;
  participationId: string;
  evidencePath: string | null;
  severity: BEViolationSeverity;
  violationType: BEViolationType;
  aiConfidence: number | null;
  isReviewed: boolean;
  reviewedBy: string | null;
  recordedAt: string;
}

export async function getStudentViolations(studentId: string): Promise<ViolationLog[]> {
  const data = await apiRequest<ViolationLog[] | { items?: ViolationLog[] }>(
    `/api/violation-logs/student/${studentId}?page=1&pageSize=100`,
  );
  return Array.isArray(data) ? data : (data as any).items ?? [];
}

export interface ParticipationDetail {
  id: string;
  examSlotId?: string;
  // BE (ExamParticipationResponseDto) trả examName là field phẳng ngay trên participation
  // (ExamName = entity.ExamSlot?.ExamName), không lồng trong 1 object examSlot riêng.
  examName?: string | null;
}

export async function getParticipationDetail(participationId: string): Promise<ParticipationDetail | null> {
  try {
    // Route thật là /api/exam-participations, không phải /api/participations (endpoint đó không
    // tồn tại) — gọi sai route trước đây khiến tên bài thi luôn fail âm thầm, phải fallback về
    // "Exam Session" thay vì tên thật.
    return await apiRequest<ParticipationDetail>(`/api/exam-participations/${participationId}`);
  } catch {
    return null;
  }
}

export async function getSignedEvidenceUrl(evidencePath: string): Promise<string> {
  const encoded = encodeURIComponent(evidencePath);
  const result = await apiRequest<{ signedUrl: string }>(
    `/api/storage/signed-url?bucket=exam-evidence&path=${encoded}&expiresInSeconds=3600`,
    { method: 'POST' },
  );
  return result.signedUrl;
}
