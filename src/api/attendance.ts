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
    `/api/classes/${classId}/enrollments?expand=student&pageSize=100`,
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

// BE (AttendanceSessionsController.GetAll) không nhận tham số "status" — query string ?status=
// dưới đây bị BE bỏ qua hoàn toàn, không lọc gì cả. Sort mặc định là StartTime DESC nên item mới
// nhất trả về có thể là session VỪA Completed (vd sau khi bấm End Session) chứ không chắc là đang
// InProgress — phải tự lọc lại ở đây, không tin filter phía server. Lấy vài item gần nhất (không chỉ
// 1) để không bỏ lỡ session InProgress thật nếu nó không phải item mới nhất theo StartTime.
export async function getInProgressSessionForClass(classId: string): Promise<AttendanceSession | null> {
  try {
    const data = await apiRequest<{ items?: AttendanceSession[] } | AttendanceSession[]>(
      `/api/attendance-sessions?classId=${classId}&pageSize=5`,
    );
    const items = Array.isArray(data) ? data : (data as any).items ?? [];
    return items.find((s: any) => s?.status === 'InProgress') ?? null;
  } catch {
    return null;
  }
}

// Trước đây roster chỉ hiện điểm danh khi có session InProgress — vừa bấm End Session xong (BE đã
// đổi status Completed đúng) thì getInProgressSessionForClass() correctly trả null, nhưng roster
// dùng chính null đó để bỏ qua luôn bước load record → cả lớp hiện lại Absent dù đã điểm danh Present
// xong xuôi. Hàm này lấy session GẦN NHẤT bất kể status (kể cả vừa Completed) để roster luôn có gì
// đó để hiện điểm danh — session InProgress/Resume hay không thì vẫn phải dùng getInProgressSessionForClass.
export async function getLatestSessionForClass(classId: string): Promise<AttendanceSession | null> {
  try {
    const data = await apiRequest<{ items?: AttendanceSession[] } | AttendanceSession[]>(
      `/api/attendance-sessions?classId=${classId}&pageSize=1`,
    );
    const items = Array.isArray(data) ? data : (data as any).items ?? [];
    return items[0] ?? null;
  } catch {
    return null;
  }
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

export interface AiPhotoAttendanceResult {
  isMatch: boolean;
  matchedButWrongClass: boolean;
  message: string | null;
  studentId: string | null;
  studentName: string | null;
  studentCode: string | null;
  record: AttendanceRecord | null;
}

// POST /api/attendance-sessions/{sessionId}/records/ai-photo — 1 ảnh mặt duy nhất, BE tự so khớp
// với toàn bộ BiometricData đã duyệt (không cần truyền studentId) rồi đánh Present cho đúng người
// nếu người đó thuộc lớp/ca thi của session. An toàn để gọi lặp lại nhiều lần cho cùng 1 người
// (BE chỉ update lại record đã có, không tạo trùng) — dùng cho vòng lặp auto-scan bên FaceScanWebView.
export async function markAttendanceByAiPhoto(
  sessionId: string,
  photoDataUrl: string,
): Promise<AiPhotoAttendanceResult> {
  const token = getAuthToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const formData = new FormData();
  formData.append('PhotoFile', { uri: photoDataUrl, type: 'image/jpeg', name: 'scan.jpg' } as any);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${BASE_URL}/api/attendance-sessions/${sessionId}/records/ai-photo`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await res.text();
    let json: any;
    try { json = JSON.parse(rawText); }
    catch { throw new Error(`Server error ${res.status}: ${rawText.slice(0, 200)}`); }

    if (!res.ok) {
      throw new Error(json.message ?? `Scan failed (${res.status})`);
    }
    const data = json.data ?? {};
    return {
      isMatch: !!data.isMatch,
      matchedButWrongClass: !!data.matchedButWrongClass,
      message: data.message ?? null,
      studentId: data.studentId ?? null,
      studentName: data.studentName ?? null,
      studentCode: data.studentCode ?? null,
      record: data.record ?? null,
    };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Scan timed out. Please try again.');
    throw e;
  }
}

export async function getSessionRecords(sessionId: string): Promise<AttendanceRecord[]> {
  const data = await apiRequest<{ items?: AttendanceRecord[] } | AttendanceRecord[]>(
    `/api/attendance-records?sessionId=${sessionId}&pageSize=100`,
  );
  const items: AttendanceRecord[] = Array.isArray(data) ? data : (data as any).items ?? [];
  return items.filter(Boolean);
}

export async function updateAttendanceRecord(
  recordId: string,
  status: 'Present' | 'Absent',
  checkinAt?: string,
): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>(`/api/attendance-records/${recordId}`, {
    method: 'PUT',
    body: JSON.stringify({
      status,
      method: 'Manual',
      ...(status === 'Present' ? { checkinAt: checkinAt ?? new Date().toISOString() } : {}),
    }),
  });
}

export async function closeAttendanceSession(sessionId: string): Promise<AttendanceSession> {
  return apiRequest<AttendanceSession>(`/api/attendance-sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Completed', endTime: new Date().toISOString() }),
  });
}

export async function createAttendanceRecord(
  sessionId: string,
  studentId: string,
  status: 'Present' | 'Absent',
  checkinAt?: string,
): Promise<AttendanceRecord> {
  return apiRequest<AttendanceRecord>('/api/attendance-records', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      studentId,
      status,
      method: 'Manual',
      ...(status === 'Present' ? { checkinAt: checkinAt ?? new Date().toISOString() } : {}),
    }),
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
