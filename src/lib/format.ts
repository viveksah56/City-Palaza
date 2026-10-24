import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE } from "./constants";
import { D, Decimal, type MoneyInput } from "./money";

const SYMBOLS: Record<string, string> = { NPR: "Rs", INR: "₹", USD: "$", EUR: "€" };

/** Indian/Nepali digit grouping (1,23,456.00) without ever touching floats. */
export function formatCurrency(value: MoneyInput | null | undefined, currency = "NPR"): string {
  const d = D(value ?? 0).toDecimalPlaces(2);
  const [int = "0", frac = "00"] = d.abs().toFixed(2).split(".");
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${d.isNegative() ? "-" : ""}${symbol} ${grouped}.${frac}`.replace("  ", " ");
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-NP").format(n);
}

export function formatCompactNumber(n: number): string {
  return formatNumberCompact(n);
}

const NPR_UNITS = [
  { value: D(10_000_000), suffix: "Cr" },
  { value: D(100_000), suffix: "L" },
  { value: D(1_000), suffix: "K" },
] as const;

function trimDecimal(value: string): string {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function groupNumber(value: string): string {
  const [integer = "0", fraction] = value.split(".");
  const last3 = integer.slice(-3);
  const rest = integer.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function compactNumber(value: MoneyInput | null | undefined, showSign: boolean, decimals: number, currency: boolean): string {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) return "–";
  let amount;
  try {
    amount = D(value);
    if (!amount.isFinite()) return "–";
  } catch {
    return "–";
  }
  const negative = amount.isNegative();
  const sign = negative ? "-" : showSign && amount.greaterThan(0) ? "+" : "";
  const abs = amount.abs();
  const prefix = currency ? "Rs\u00a0" : "";
  if (abs.lessThan(1_000)) {
    const exact = trimDecimal(abs.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals));
    return `${sign}${prefix}${currency ? groupNumber(exact) : exact}`;
  }

  let unitIndex = NPR_UNITS.findIndex((unit) => abs.greaterThanOrEqualTo(unit.value));
  if (unitIndex < 0) return `${sign}${prefix}${abs.toString()}`;
  let scaled = abs.div(NPR_UNITS[unitIndex]!.value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  if (scaled.greaterThanOrEqualTo(100) && unitIndex > 0) {
    unitIndex -= 1;
    scaled = abs.div(NPR_UNITS[unitIndex]!.value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  }
  const number = trimDecimal(scaled.toFixed(decimals));
  return `${sign}${prefix}${number}${NPR_UNITS[unitIndex]!.suffix}`;
}

export function formatNumberCompact(value: number | string | null | undefined): string {
  return compactNumber(value, false, 2, false);
}

export function formatNPR(value: MoneyInput | null | undefined): string {
  return formatCurrency(value, "NPR");
}

export function formatNPRCompact(
  value: MoneyInput | null | undefined,
  options: { showSign?: boolean; decimals?: number } = {},
): string {
  return compactNumber(value, options.showSign ?? false, options.decimals ?? 2, true);
}

export function formatDateTime(date: Date | string): string {
  return format(new TZDate(new Date(date), APP_TIMEZONE), "dd MMM yyyy, h:mm a");
}

export function formatDate(date: Date | string): string {
  return format(new TZDate(new Date(date), APP_TIMEZONE), "dd MMM yyyy");
}

export function formatDateInput(date: Date | string): string {
  return format(new TZDate(new Date(date), APP_TIMEZONE), "yyyy-MM-dd");
}

export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

export function slugify(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}
