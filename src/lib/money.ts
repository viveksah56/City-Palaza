import Decimal from "decimal.js";

// All authoritative money maths uses decimal.js (never JS floats).
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal.Value | { toString(): string };

export const ZERO = new Decimal(0);

export function D(v: MoneyInput): Decimal {
  return v instanceof Decimal ? v : new Decimal(String(v));
}

/** Round to 2 dp, half-up. */
export function money(v: MoneyInput): Decimal {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** String suitable for a Postgres NUMERIC(12,2) column. */
export function toDb(v: MoneyInput): string {
  return money(v).toFixed(2);
}

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(D(v)), ZERO);
}

export { Decimal };
