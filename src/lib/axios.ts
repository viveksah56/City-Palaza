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

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const original = error.config as InternalAxiosRequestConfig | undefined;
    if (error.response?.status !== 401 || !original || original._sessionRetry || original.url === "/auth/refresh") {
      return Promise.reject(error);
    }

    original._sessionRetry = true;
    refreshPromise ??= axios.post<void>("/api/auth/refresh", undefined, { withCredentials: true }).then(() => undefined).finally(() => { refreshPromise = null; });
    try {
      await refreshPromise;
      return api(original);
    } catch {
      return Promise.reject(error);
    }
  },
);
