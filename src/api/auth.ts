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

export async function loginApi(email: string, password: string): Promise<{ loginData: LoginData; me: MeData }> {
  const loginData = await apiRequest<LoginData>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  setAuthToken(loginData.accessToken);

  const me = await apiRequest<MeData>('/api/users/me');

  return { loginData, me };
}
