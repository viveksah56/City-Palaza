import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE } from "./constants";
import { D, type MoneyInput } from "./money";

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
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatDateTime(date: Date | string): string {
  return format(new TZDate(new Date(date), APP_TIMEZONE), "dd MMM yyyy, h:mm a");
}

export function formatDate(date: Date | string): string {
  return format(new TZDate(new Date(date), APP_TIMEZONE), "dd MMM yyyy");
}

export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
