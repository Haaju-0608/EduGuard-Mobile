export const BASE_URL = 'https://eduguard-api-gdhg.onrender.com';

let _token: string | null = null;
let _onAuthError: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function getAuthToken() {
  return _token;
}

export function setOnAuthError(cb: () => void) {
  _onAuthError = cb;
}

function triggerAuthError() {
  if (_onAuthError) _onAuthError();
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  invalid_credentials:   'Incorrect email or password.',
  user_not_found:        'No account found with this email.',
  account_not_found:     'No account found with this email.',
  account_disabled:      'Your account has been disabled. Please contact support.',
  account_suspended:     'Your account has been suspended. Please contact support.',
  account_locked:        'Your account is locked. Please contact support.',
  email_not_verified:    'Please verify your email before signing in.',
  too_many_attempts:     'Too many failed attempts. Please wait a moment and try again.',
  rate_limited:          'Too many requests. Please wait a moment and try again.',
  token_expired:         'Your session has expired. Please sign in again.',
  unauthorized:          'You are not authorized to perform this action.',
  forbidden:             'Access denied.',
};

function cleanErrorMessage(json: any, fallback: string): string {
  const raw: string = json.message ?? json.msg ?? '';

  // Server sometimes embeds JSON inside the message string, e.g.:
  // "Fail to login: {"code":400,"error_code":"invalid_credentials","msg":"..."}"
  const braceIdx = raw.indexOf('{');
  if (braceIdx !== -1) {
    try {
      const inner = JSON.parse(raw.slice(braceIdx));
      // Map known error_code to friendly message first
      if (inner.error_code && ERROR_CODE_MESSAGES[inner.error_code]) {
        return ERROR_CODE_MESSAGES[inner.error_code];
      }
      const clean = inner.msg ?? inner.message ?? inner.error;
      if (clean) return clean;
    } catch { /* fall through */ }
  }

  // Also check top-level error_code
  if (json.error_code && ERROR_CODE_MESSAGES[json.error_code]) {
    return ERROR_CODE_MESSAGES[json.error_code];
  }

  return raw || fallback;
}

export async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    // Content-Type intentionally omitted — RN sets it with the correct multipart boundary
  };

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  const rawText = await res.text();
  console.log(`[upload] ${path} → ${res.status}`, rawText.slice(0, 500));

  if (res.status === 401) {
    triggerAuthError();
    throw new Error('Session expired. Please sign in again.');
  }

  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Server error ${res.status}: ${rawText.slice(0, 200)}`);
  }

  if (!json.success) {
    const msg = cleanErrorMessage(json, '');
    throw new Error(msg || `Upload failed (${res.status}): ${rawText.slice(0, 300)}`);
  }
  return json.data as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    ...(options.headers as Record<string, string> | undefined ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    triggerAuthError();
    throw new Error('Session expired. Please sign in again.');
  }

  const json: ApiEnvelope<T> = await res.json();

  if (!json.success) {
    throw new Error(cleanErrorMessage(json, 'Request failed'));
  }

  return json.data as T;
}
