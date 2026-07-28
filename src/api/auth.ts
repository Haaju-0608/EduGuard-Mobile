import * as SecureStore from 'expo-secure-store';
import { apiRequest, setAuthToken } from './client';

export interface LoginData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  fullName: string;
  role: 'Student' | 'Lecturer' | 'SchoolAdmin' | 'SuperAdmin';
  institutionId: string;
}

export interface MeData {
  id: string;
  email: string;
  fullName: string;
  role: 'Student' | 'Lecturer' | 'SchoolAdmin' | 'SuperAdmin';
  studentCode: string | null;
  institutionId: string | null;
  phone: string | null;
  status: string;
}

const SESSION_KEY = 'eduguard_session';

export interface StoredSession {
  token: string;
  user: MeData;
}

export async function saveSession(token: string, user: MeData): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify({ token, user }));
  } catch { /* ignore */ }
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch { /* ignore */ }
}

export async function loginApi(email: string, password: string): Promise<{ loginData: LoginData; me: MeData }> {
  const loginData = await apiRequest<LoginData>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setAuthToken(loginData.accessToken);

  const me = await apiRequest<MeData>('/api/users/me');

  await saveSession(loginData.accessToken, me);

  return { loginData, me };
}
