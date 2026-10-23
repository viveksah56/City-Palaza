import { ZodError } from "zod";

export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INSUFFICIENT_STOCK"
  | "DISCOUNT_NOT_ALLOWED"
  | "SERIAL_UNAVAILABLE"
  | "DUPLICATE"
  | "CONFLICT"
  | "EMPTY_SALE";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type PrismaKnown = { code: string; meta?: Record<string, unknown> };
/** Duck-typed so this module (and unit tests) don't need the generated Prisma client. */
function isPrismaKnownError(e: unknown): e is PrismaKnown {
  return typeof e === "object" && e !== null && (e as { name?: string }).name === "PrismaClientKnownRequestError" && typeof (e as PrismaKnown).code === "string";
}

const UNIQUE_LABELS: Record<string, string> = {
  sku: "A product with this SKU already exists.",
  barcode: "A product with this barcode already exists.",
  email: "This email address is already in use.",
  phone: "This phone number is already in use.",
  serial: "One of the IMEI / serial numbers already exists.",
  name: "This name is already in use.",
  slug: "A similar record was created at the same time. Please try again.",
  saleNumber: "Sale number collision, please try again.",
};

export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  if (e instanceof DomainError) return { ok: false, error: e.message };
  if (e instanceof ZodError) {
    return {
      ok: false,
      error: e.issues[0]?.message ?? "Please check the form and try again.",
      fieldErrors: e.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  if (isPrismaKnownError(e)) {
    if (e.code === "P2002") {
      const target = String((e.meta?.target as string[] | string | undefined) ?? "");
      const hit = Object.keys(UNIQUE_LABELS).find((k) => target.includes(k));
      return { ok: false, error: hit ? UNIQUE_LABELS[hit]! : "This record already exists." };
    }
    if (e.code === "P2003") return { ok: false, error: "This record is still referenced by other data." };
    if (e.code === "P2025") return { ok: false, error: "The record no longer exists." };
    if (e.code === "P2010" || e.code === "P2004") {
      return { ok: false, error: "Not enough stock available for this operation." };
    }
  }
  console.error("[action error]", e);
  return { ok: false, error: "Something went wrong on our side. Please try again." };
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return toActionError(e);
  }
}
