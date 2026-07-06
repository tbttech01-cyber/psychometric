const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export type ApiResult<T = any> = { ok: boolean; status: number; data: T };

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ success: false, message: "Server error" }));

  // A 401 on a request that carried a token means the session this app already
  // considered "logged in" is no longer valid server-side (expired, or a later
  // login elsewhere invalidated it — this app uses a single-active-session
  // model). Don't leave the user stuck on a broken page: clear the stale token
  // and send them back to login with an explanation. (A 401 with no token,
  // e.g. a failed login attempt itself, is normal and left alone.)
  if (res.status === 401 && token && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    removeToken();
    window.location.href = "/login?reason=session-ended";
  }

  return { ok: res.ok, status: res.status, data };
}

export const api = {
  get: <T = any>(path: string, token?: string | null) => request<T>("GET", path, undefined, token),
  post: <T = any>(path: string, body?: unknown, token?: string | null) => request<T>("POST", path, body, token),
  put: <T = any>(path: string, body?: unknown, token?: string | null) => request<T>("PUT", path, body, token),
  delete: <T = any>(path: string, token?: string | null) => request<T>("DELETE", path, undefined, token),
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tbt_admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("tbt_admin_token", token);
}

export function removeToken() {
  localStorage.removeItem("tbt_admin_token");
  localStorage.removeItem("tbt_admin");
}

export function getStoredAdmin(): { _id: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("tbt_admin") || "null");
  } catch {
    return null;
  }
}

export function setStoredAdmin(admin: { _id: string; email: string }) {
  localStorage.setItem("tbt_admin", JSON.stringify(admin));
}

export const API_BASE_URL = API_BASE;

// Export endpoints require the admin's bearer token, so they can't be plain
// <a href> links (a browser navigation carries no Authorization header — the
// user would just get redirected to a raw 401 JSON response). Fetch the file
// with the token attached and trigger the download via a blob URL instead.
export async function downloadFile(path: string, token: string | null, filename: string): Promise<{ ok: boolean; message?: string }> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, message: data.message || "Export failed." };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
