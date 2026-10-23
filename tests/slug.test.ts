import { describe, expect, it } from "vitest";
import { uniqueSlug } from "@/lib/slug";

describe("route slugs", () => {
  it("creates a readable slug and adds a suffix when the name is already used", async () => {
    const occupied = new Set(["iphone-15", "iphone-15-2"]);
    const slug = await uniqueSlug("iPhone 15", async (candidate) => occupied.has(candidate));
    expect(slug).toBe("iphone-15-3");
  });

  it("uses a stable fallback when a name has no URL-safe characters", async () => {
    const slug = await uniqueSlug("!!!", async () => false);
    expect(slug).toBe("item");
  });

  it("preserves Nepali names in Unicode route slugs", async () => {
    expect(await uniqueSlug("राम शाह", async () => false)).toBe("राम-शाह");
  });
});
