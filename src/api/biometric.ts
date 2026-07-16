import { BASE_URL, getAuthToken } from './client';

export async function submitBiometricRegistration(
  frontUri: string,
  leftUri: string,
  rightUri: string,
): Promise<void> {
  const formData = new FormData();
  formData.append('reason', 'Initial face registration');
  formData.append('frontFile', { uri: frontUri, type: 'image/jpeg', name: 'front.jpg' } as any);
  formData.append('leftFile',  { uri: leftUri,  type: 'image/jpeg', name: 'left.jpg'  } as any);
  formData.append('rightFile', { uri: rightUri, type: 'image/jpeg', name: 'right.jpg' } as any);

  const token = getAuthToken();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(`${BASE_URL}/api/biometric-requests`, {
    method: 'POST',
    headers, // No Content-Type — RN sets multipart boundary automatically
    body: formData,
  });

  const rawText = await res.text();
  console.log('[biometric] status:', res.status, 'body:', rawText);

  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Server error ${res.status}: ${rawText.slice(0, 300)}`);
  }

  // Trust HTTP status: 2xx = success regardless of response body shape
  if (!res.ok) {
    const errorsStr = Array.isArray(json.errors)
      ? json.errors.map((e: any) => (typeof e === 'string' ? e : JSON.stringify(e))).join('; ')
      : null;
    const msg = json.message ?? errorsStr ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
}
