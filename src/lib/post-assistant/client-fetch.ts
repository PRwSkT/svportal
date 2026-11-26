export interface SafeJsonResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T | null;
  errorMessage: string | null;
}

export async function safeReadJson<T = Record<string, unknown>>(
  res: Response
): Promise<SafeJsonResult<T>> {
  const rawText = await res.text().catch(() => '');
  const trimmed = rawText.trim();

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as T & { error?: unknown; message?: unknown };
      if (!res.ok) {
        const msg =
          typeof parsed?.error === 'string' && parsed.error
            ? parsed.error
            : typeof parsed?.message === 'string' && parsed.message
              ? parsed.message
              : `HTTP ${res.status}`;
        return { ok: false, status: res.status, data: parsed, errorMessage: msg };
      }
      return { ok: true, status: res.status, data: parsed, errorMessage: null };
    } catch {
      // Non-JSON body (e.g. Netlify 504/502 HTML error page)
    }
  }

  let errorMessage: string;
  if (res.status === 504) {
    errorMessage = 'เซิร์ฟเวอร์ใช้เวลานานเกินกำหนด (504) กรุณาลองกดใหม่อีกครั้ง';
  } else if (res.status === 502 || res.status === 503) {
    errorMessage = 'เซิร์ฟเวอร์กำลังประมวลผลหนาแน่น (503) กรุณาลองใหม่อีกครั้ง';
  } else if (res.status === 401 || res.status === 403) {
    errorMessage = 'เซสชันหมดอายุหรือไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่';
  } else {
    errorMessage = `เซิร์ฟเวอร์ตอบกลับไม่สมบูรณ์ (HTTP ${res.status}) กรุณาลองใหม่อีกครั้ง`;
  }

  return {
    ok: false,
    status: res.status,
    data: null,
    errorMessage,
  };
}
