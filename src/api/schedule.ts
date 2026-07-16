import { apiRequest } from './client';

export interface MyClass {
  id: string;
  name: string;
  code?: string;
}

export interface ExamSlot {
  id: string;
  classId?: string;
  examName: string;
  startTime: string;
  endTime: string;
  status: 'Scheduled' | 'InProgress' | 'Completed' | 'Cancelled';
  expectedDurationMinutes?: number;
  lecturer?: { id?: string; fullName?: string } | null;
}

export async function getMyClasses(): Promise<MyClass[]> {
  const data = await apiRequest<MyClass[] | { items?: MyClass[] }>('/api/classes/my-classes');
  return Array.isArray(data) ? data : (data as any).items ?? [];
}

export async function getExamSlotsByClass(classId: string): Promise<ExamSlot[]> {
  const data = await apiRequest<ExamSlot[] | { items?: ExamSlot[] }>(`/api/exam-slots/class/${classId}`);
  return Array.isArray(data) ? data : (data as any).items ?? [];
}
