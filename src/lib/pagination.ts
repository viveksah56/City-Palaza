import { DEFAULT_PAGE_SIZE } from "./constants";
import { first, type SearchParams } from "./url";

export type PageQuery = { page: number; pageSize: number; skip: number; take: number };
export type SortOrder = "asc" | "desc";

export function parseSort<const T extends readonly string[]>(sp: SearchParams, allowed: T, fallback: T[number]): { sort: T[number]; order: SortOrder } {
  const requested = first(sp.sort);
  const sort = allowed.find((key) => key === requested) ?? fallback;
  return { sort, order: first(sp.order) === "asc" ? "asc" : "desc" };
}

export function parsePage(sp: SearchParams, defaultSize = DEFAULT_PAGE_SIZE): PageQuery {
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(first(sp.pageSize) ?? String(defaultSize), 10) || defaultSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type Paged<T> = { rows: T[]; total: number; page: number; pageSize: number; totalPages: number };

export function paged<T>(rows: T[], total: number, q: PageQuery): Paged<T> {
  return { rows, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}
