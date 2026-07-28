import { apiRequest } from './client';

export type BEViolationType =
  | 'Impersonation'
  | 'GazeDiversion'
  | 'MultipleFaces'
  | 'Absence'
  | 'HeadTurn'
  | 'FaceObstructed'
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

export async function getStudentViolations(): Promise<ViolationLog[]> {
  const data = await apiRequest<{ items?: ViolationLog[] } | ViolationLog[]>(
    '/api/violation-logs?pageSize=100&sort=recordedAt_desc',
  );
  return Array.isArray(data) ? data : (data as any).items ?? [];
}
