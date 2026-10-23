import axios, { type InternalAxiosRequestConfig } from "axios";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _sessionRetry?: boolean;
  }
}

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { Accept: "application/json" },
});

let refreshPromise: Promise<void> | null = null;
let redirectingToLogin = false;

const AUTH_ENDPOINTS = new Set([
  "/auth/forgot-password",
  "/auth/login",
  "/auth/logout",
  "/auth/refresh",
  "/auth/reset-password",
]);

function requestPath(url: string | undefined): string {
  const path = (url ?? "").split("?", 1)[0] ?? "";
  return path.startsWith("/api/") ? path.slice(4) : path;
}

function redirectToLogin(): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  if (["/login", "/forgot-password", "/reset-password"].includes(window.location.pathname)) return;

  redirectingToLogin = true;
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.delete("_rsc");
  const next = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.location.assign(`/login?next=${encodeURIComponent(next)}`);
}

async function refreshSession(): Promise<void> {
  try {
    await axios.post<void>("/api/auth/refresh", undefined, { withCredentials: true });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await axios.post<void>("/api/auth/refresh", undefined, { withCredentials: true });
      return;
    }
    throw error;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const original = error.config as InternalAxiosRequestConfig | undefined;
    if (error.response?.status !== 401 || !original || original._sessionRetry || AUTH_ENDPOINTS.has(requestPath(original.url))) {
      return Promise.reject(error);
    }

    original._sessionRetry = true;
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null; });
    try {
      await refreshPromise;
      return api(original);
    } catch (refreshError) {
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) redirectToLogin();
      return Promise.reject(refreshError);
    }
  },
);
