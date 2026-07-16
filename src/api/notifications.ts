import { apiRequest } from './client';

export type NotifType =
  | 'AttendanceSessionStarted'
  | 'ExamReminder'
  | 'ViolationDetected'
  | 'BiometricRequestStatus'
  | 'LowBalanceAlert'
  | 'ServiceSuspended';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  type: NotifType;
  sentVia?: string;
  referenceId?: string | null;
  referenceType?: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  totalCount: number;
  unreadCount: number;
}

export async function getNotifications(
  page = 1,
  pageSize = 20,
): Promise<NotificationPage> {
  const data = await apiRequest<NotificationPage | NotificationItem[]>(
    `/api/notifications/me?page=${page}&pageSize=${pageSize}`,
  );

  // Handle both paginated envelope and flat array
  if (Array.isArray(data)) {
    return { items: data, totalCount: data.length, unreadCount: data.filter((n) => !n.isRead).length };
  }
  return data as NotificationPage;
}

export async function getUnreadCount(): Promise<number> {
  const data = await apiRequest<{ unreadCount: number } | number>(
    '/api/notifications/me/unread-count',
  );
  return typeof data === 'number' ? data : (data as any).unreadCount ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest<unknown>(`/api/notifications/${id}/read`, { method: 'PUT' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<unknown>('/api/notifications/read-all', { method: 'PUT' });
}
