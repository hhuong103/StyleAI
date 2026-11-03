export type ApiResult<T> = {
  data: T;
  meta: {
    request_id: string;
    page?: number;
    page_size?: number;
    total?: number;
  };
};
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
let csrf: string | undefined;
let csrfPending: Promise<string> | undefined;
let refreshPending: Promise<boolean> | undefined;

async function getCsrf(): Promise<string> {
  if (csrf) return csrf;
  csrfPending ??= fetch("/api/v1/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (r) => {
      if (!r.ok) throw new Error("Không thể khởi tạo phiên bảo mật.");
      return (await r.json()).data.csrf_token as string;
    })
    .then((value) => {
      csrf = value;
      return value;
    })
    .finally(() => {
      csrfPending = undefined;
    });
  return csrfPending;
}
export function clearSession() {
  csrf = undefined;
}
async function refreshSession() {
  refreshPending ??= (async () => {
    const token = await getCsrf();
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "X-CSRF-Token": token },
      credentials: "same-origin",
    });
    return response.ok;
  })().finally(() => {
    refreshPending = undefined;
  });
  return refreshPending;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiResult<T>> {
  const method = options.method || "GET";
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (method !== "GET") headers.set("X-CSRF-Token", await getCsrf());
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      signal:
        options.signal ??
        AbortSignal.timeout(
          path.includes("/catalog-imports") ? 120_000 : 20_000,
        ),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Không kết nối được máy chủ. Nội dung của bạn vẫn được giữ lại.",
    );
  }
  if (response.status === 204)
    return {
      data: undefined as T,
      meta: { request_id: response.headers.get("X-Request-ID") || "" },
    };
  const payload = await response.json();
  if (!response.ok) {
    if (
      retry &&
      response.status === 401 &&
      (!path.startsWith("/auth/") || path === "/auth/me") &&
      (await refreshSession())
    )
      return api<T>(path, options, false);
    if (retry && payload.error?.code === "CSRF_INVALID") {
      csrf = undefined;
      return api<T>(path, options, false);
    }
    throw new ApiError(
      response.status,
      payload.error?.code || "REQUEST_FAILED",
      payload.error?.message || "Yêu cầu thất bại.",
      payload.error?.details,
    );
  }
  return payload as ApiResult<T>;
}
export const json = (value: unknown) => JSON.stringify(value);
export const idempotency = () => ({ "Idempotency-Key": crypto.randomUUID() });
