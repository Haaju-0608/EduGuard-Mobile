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

  // Không có timeout trước đây — nếu fetch() không bao giờ resolve/reject (BE trên Render free
  // tier "ngủ" sau 1 thời gian không có traffic, có thể mất 30-60s+ để tỉnh dậy, cộng với việc
  // upload 3 ảnh nặng hơn 1 request thường), màn hình cứ đứng ở "Submitting…" vô thời hạn — không
  // hẳn là lỗi, không hẳn là thành công, người dùng không có cách nào biết chuyện gì đang xảy ra
  // hay để retry. Thêm AbortController để LUÔN kết thúc bằng 1 lỗi rõ ràng trong thời gian hợp lý.
  //
  // 120s (không phải 45s như ban đầu) — endpoint này (POST /api/biometric-requests) nặng hơn hẳn
  // upload thường: cold-start riêng đã có thể tốn 30-60s (comment trên), CỘNG thêm BE gọi AI service
  // tới 4 lần (1 lần trích vector bộ 3 ảnh + 3 lần check trùng từng ảnh) trước khi trả response. 45s
  // gần như luôn hết trước khi BE xử lý xong → abort ở client nhưng BE không có CancellationToken
  // nào theo dõi việc này nên vẫn chạy tiếp và tạo request thành công — app báo "Submission Failed"
  // dù SchoolAdmin vẫn thấy request đó (có ảnh) trong hàng chờ duyệt ngay sau đó.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Upload timed out. The server may be waking up — please try again in a moment. Note: this may have still submitted successfully in the background — check your registration status before resubmitting.');
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

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

  if (!res.ok || json.success === false) {
    const msg = cleanErrorMessage(json, '');
    throw new Error(msg || `Upload failed (${res.status}): ${rawText.slice(0, 300)}`);
  }
  return (json.data ?? json) as T;
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

  // Cùng lý do timeout ở uploadRequest bên trên — BE Render free tier có thể cold-start 30-60s+,
  // không có timeout thì request treo vô thời hạn, không lỗi không thành công.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Request timed out. The server may be waking up — please try again in a moment.');
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

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
