import { apiRequest, BASE_URL, getAuthToken } from './client';

export interface AttendanceClass {
  id: string;
  courseName: string;
  courseCode: string;
  semester: string | null;
  academicYear: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface ClassEnrollment {
  studentId: string;
  status: 'Active' | 'Dropped';
  enrolledAt: string;
  student: {
    id: string;
    fullName: string;
    email: string;
    studentCode: string;
  };
}

export interface AttendanceSession {
  id: string;
  classId: string;
  status: 'InProgress' | 'Completed' | 'Cancelled';
  startTime: string;
  endTime: string | null;
  totalRecognized: number;
  videoPath: string | null;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  method: 'Ai' | 'Manual';
  confidenceScore: number | null;
  checkinAt: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
}

export async function getLecturerClasses(): Promise<AttendanceClass[]> {
  return apiRequest<AttendanceClass[]>('/api/classes?pageSize=100');
}

export async function getClassEnrollments(classId: string): Promise<ClassEnrollment[]> {
  return apiRequest<ClassEnrollment[]>(
    `/api/classes/${classId}/enrollments?expand=student&pageSize=200`,
  );
}

export interface ExamSlotBrief {
  id: string;
  examName: string;
  startTime: string;
  endTime: string;
  status: 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
}

export async function getExamSlotsForClass(classId: string): Promise<ExamSlotBrief[]> {
  const data = await apiRequest<ExamSlotBrief[] | { items?: ExamSlotBrief[] }>(
    `/api/exam-slots/class/${classId}`,
  );
  return Array.isArray(data) ? data : (data as any).items ?? [];
}

export async function openAttendanceSession(
  classId: string,
  examSlotId?: string,
): Promise<AttendanceSession> {
  return apiRequest<AttendanceSession>('/api/attendance-sessions', {
    method: 'POST',
    body: JSON.stringify({
      classId,
      ...(examSlotId ? { examSlotId } : {}),
      startTime: new Date().toISOString(),
    }),
  });
}

export async function uploadAttendanceVideo(
  sessionId: string,
  videoUri: string,
): Promise<AttendanceRecord[]> {
  const token = getAuthToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const formData = new FormData();
  formData.append('VideoFile', { uri: videoUri, type: 'video/mp4', name: 'attendance.mp4' } as any);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000); // 3 min timeout

  try {
    const res = await fetch(`${BASE_URL}/api/attendance-sessions/${sessionId}/records/ai-video`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await res.text();
    console.log('[attendance-video] status:', res.status, 'body:', rawText.slice(0, 500));

    let json: any;
    try { json = JSON.parse(rawText); }
    catch { throw new Error(`Server error ${res.status}: ${rawText.slice(0, 200)}`); }

    if (!res.ok) {
      throw new Error(json.message ?? `Upload failed (${res.status})`);
    }
    return (json.data ?? []) as AttendanceRecord[];
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Upload timed out. Please try again.');
    throw e;
  }
}

export async function updateAttendanceRecord(
  recordId: string,
  status: 'Present' | 'Absent',
): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>(`/api/attendance-records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, method: 'Manual' }),
  });
}

export async function createAttendanceRecord(
  sessionId: string,
  studentId: string,
  status: 'Present' | 'Absent',
): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>('/api/attendance-records', {
    method: 'POST',
    body: JSON.stringify({ sessionId, studentId, status, method: 'Manual' }),
  });
}

export interface StudentAttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  method: 'Ai' | 'Manual';
  confidenceScore: number | null;
  checkinAt: string | null;
  session: {
    id: string;
    classId: string;
    status: string;
    startTime: string;
  } | null;
}

export async function getStudentAttendanceRecords(): Promise<StudentAttendanceRecord[]> {
  const data = await apiRequest<{ items?: StudentAttendanceRecord[] } | StudentAttendanceRecord[]>(
    '/api/attendance-records?expand=session&pageSize=100&sort=checkinAt_desc',
  );
  return Array.isArray(data) ? data : (data as any).items ?? [];
}
