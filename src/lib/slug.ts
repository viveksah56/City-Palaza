import { slugify } from "@/lib/format";

export async function uniqueSlug(candidate: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(candidate) || "item";
  let slug = base;
  let suffix = 2;
  while (await exists(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}
