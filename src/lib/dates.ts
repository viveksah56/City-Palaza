import {
  addDays,
  addMonths,
  addYears,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";
import { TZDate } from "@date-fns/tz";
import { APP_TIMEZONE } from "./constants";

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "thisYear", label: "This year" },
  { value: "custom", label: "Custom range" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export type DateRange = {
  preset: RangePreset;
  /** inclusive start */
  from: Date;
  /** EXCLUSIVE end (start of the next day) – use `< to` in queries */
  to: Date;
  label: string;
  granularity: "day" | "month";
};

const isPreset = (v: string | undefined): v is RangePreset => RANGE_PRESETS.some((p) => p.value === v);

function parseYmd(s: string | undefined, tz: string): TZDate | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new TZDate(y, m - 1, d, tz);
}

export function resolveRange(
  presetParam?: string,
  fromParam?: string,
  toParam?: string,
  opts: { now?: Date; tz?: string; fallback?: RangePreset } = {},
): DateRange {
  const tz = opts.tz ?? APP_TIMEZONE;
  const now = new TZDate(opts.now ?? new Date(), tz);
  const today = startOfDay(now);
  let preset: RangePreset = isPreset(presetParam) ? presetParam : (opts.fallback ?? "last7");
  let from: Date;
  let to: Date;

  switch (preset) {
    case "today":
      from = today;
      to = addDays(today, 1);
      break;
    case "yesterday":
      from = subDays(today, 1);
      to = today;
      break;
    case "last30":
      from = subDays(today, 29);
      to = addDays(today, 1);
      break;
    case "thisMonth":
      from = startOfMonth(today);
      to = addMonths(from, 1);
      break;
    case "lastMonth":
      to = startOfMonth(today);
      from = addMonths(to, -1);
      break;
    case "thisYear":
      from = startOfYear(today);
      to = addYears(from, 1);
      break;
    case "custom": {
      const f = parseYmd(fromParam, tz);
      const t = parseYmd(toParam, tz);
      if (f && t && f <= t) {
        from = f;
        to = addDays(t, 1);
      } else {
        preset = "last30";
        from = subDays(today, 29);
        to = addDays(today, 1);
      }
      break;
    }
    case "last7":
    default:
      from = subDays(today, 6);
      to = addDays(today, 1);
  }

  const f = new Date(from.getTime());
  const t = new Date(to.getTime());
  const days = (t.getTime() - f.getTime()) / 86_400_000;
  return {
    preset,
    from: f,
    to: t,
    label: RANGE_PRESETS.find((p) => p.value === preset)!.label,
    granularity: days > 62 ? "month" : "day",
  };
}
