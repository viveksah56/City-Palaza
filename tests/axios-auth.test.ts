import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/axios";

const okResponse = (config: InternalAxiosRequestConfig): AxiosResponse => ({
  data: { ok: true },
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});

const errorResponse = (config: InternalAxiosRequestConfig, status: number): AxiosError => new AxiosError(
  "Request failed",
  "ERR_BAD_REQUEST",
  config,
  undefined,
  { data: { error: "UNAUTHENTICATED" }, status, statusText: "Error", headers: {}, config },
);

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "window");
});

describe("shared Axios session recovery", () => {
  it("refreshes once and retries the original request once", async () => {
    let attempts = 0;
    api.defaults.adapter = async (config) => {
      attempts += 1;
      if (attempts === 1) throw errorResponse(config, 401);
      return okResponse(config);
    };
    vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true } } as AxiosResponse);

    const response = await api.get("/products/search", { params: { q: "case" } });

    expect(response.data).toEqual({ ok: true });
    expect(attempts).toBe(2);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("shares refresh work for simultaneous unauthorized requests", async () => {
    let attempts = 0;
    api.defaults.adapter = async (config) => {
      attempts += 1;
      if (attempts <= 2) throw errorResponse(config, 401);
      return okResponse(config);
    };
    vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true } } as AxiosResponse);

    await Promise.all([api.get("/products/search"), api.get("/customers/search")]);

    expect(attempts).toBe(4);
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("does not retry the original request more than once", async () => {
    let attempts = 0;
    api.defaults.adapter = async (config) => {
      attempts += 1;
      throw errorResponse(config, 401);
    };
    vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true } } as AxiosResponse);

    await expect(api.get("/products/search")).rejects.toMatchObject({ response: { status: 401 } });
    expect(attempts).toBe(2);
  });

  it("does not treat forbidden responses as expired sessions", async () => {
    api.defaults.adapter = async (config) => { throw errorResponse(config, 403); };
    const refresh = vi.spyOn(axios, "post");

    await expect(api.get("/products/search")).rejects.toMatchObject({ response: { status: 403 } });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("redirects to sign-in only when refresh says the session is invalid", async () => {
    const assign = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: "https://cityplaza.test/sales?filter=week&_rsc=internal", pathname: "/sales", assign } } as unknown as Window,
    });
    api.defaults.adapter = async (config) => { throw errorResponse(config, 401); };
    vi.spyOn(axios, "post").mockRejectedValue(errorResponse({} as InternalAxiosRequestConfig, 401));

    await expect(api.get("/products/search")).rejects.toMatchObject({ response: { status: 401 } });

    expect(assign).toHaveBeenCalledWith("/login?reason=expired&next=%2Fsales%3Ffilter%3Dweek");
  });

  it("does not redirect for temporary refresh-service failures", async () => {
    const assign = vi.fn();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: "https://cityplaza.test/sales", pathname: "/sales", assign } } as unknown as Window,
    });
    api.defaults.adapter = async (config) => { throw errorResponse(config, 401); };
    vi.spyOn(axios, "post").mockRejectedValue(errorResponse({} as InternalAxiosRequestConfig, 503));

    await expect(api.get("/products/search")).rejects.toMatchObject({ response: { status: 503 } });

    expect(assign).not.toHaveBeenCalled();
  });
});
