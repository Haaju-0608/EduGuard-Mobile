import { apiRequest, uploadRequest } from './client';

export interface BiometricRequest {
  id: string;
  studentId: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  frontImageUrl: string;
  leftImageUrl: string;
  rightImageUrl: string;
  reviewedAt: string | null;
  createdAt: string;
}

export async function submitBiometricRegistration(
  frontUri: string,
  leftUri: string,
  rightUri: string,
  reason = 'Initial face registration',
): Promise<void> {
  const formData = new FormData();
  formData.append('Reason', reason);
  formData.append('FrontFile', { uri: frontUri, type: 'image/jpeg', name: 'front.jpg' } as any);
  formData.append('LeftFile',  { uri: leftUri,  type: 'image/jpeg', name: 'left.jpg'  } as any);
  formData.append('RightFile', { uri: rightUri, type: 'image/jpeg', name: 'right.jpg' } as any);

  await uploadRequest<unknown>('/api/biometric-requests', formData);
}

export async function getMyBiometricRequests(): Promise<BiometricRequest[]> {
  const data = await apiRequest<{ items?: BiometricRequest[] } | BiometricRequest[]>(
    '/api/biometric-requests?pageSize=20&sort=createdAt_desc',
  );
  return Array.isArray(data) ? data : (data as any).items ?? [];
}
