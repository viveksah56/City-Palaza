import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); },
  unstable_rethrow: (e: unknown) => { if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e; },
}));

const { run, DomainError } = await import("@/lib/errors");

describe("run() and expired sessions", () => {
  it("logs the user out (redirect to the logout route) when an action finds the session gone", async () => {
    await expect(run(async () => { throw new DomainError("UNAUTHENTICATED", "expired"); })).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/api/auth/logout?reason=expired" });
  });

  it("still turns ordinary domain errors into friendly results", async () => {
    await expect(run(async () => { throw new DomainError("FORBIDDEN", "No."); })).resolves.toEqual({ ok: false, error: "No." });
    await expect(run(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it("does not swallow redirects thrown inside an action", async () => {
    await expect(run(async () => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/x" }); })).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/x" });
  });
});
