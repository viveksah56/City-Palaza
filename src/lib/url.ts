export type SearchParams = Record<string, string | string[] | undefined>;

export function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "" ? undefined : s;
}

export function toParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) out[k] = first(v);
  return out;
}

/** Build `/path?a=1&b=2`, applying overrides (undefined removes a key). */
export function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") qs.set(k, v);
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}
