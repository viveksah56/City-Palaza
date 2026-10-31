/** Normalise a serial/IMEI typed or scanned by a human. */
export function normalizeSerial(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/** Luhn check (used by IMEI). */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function isValidImei(value: string): boolean {
  return /^\d{15}$/.test(value) && luhnValid(value);
}

/** Build a Luhn-valid 15-digit IMEI from a 14-digit body (dev seed & tests). */
export function imeiFromBody(body14: string): string {
  if (!/^\d{14}$/.test(body14)) throw new Error("IMEI body must be 14 digits");
  for (let d = 0; d <= 9; d++) {
    const candidate = `${body14}${d}`;
    if (luhnValid(candidate)) return candidate;
  }
  throw new Error("unreachable");
}

export function isValidSerial(value: string): boolean {
  return /^[A-Z0-9]{4,40}$/.test(value);
}

import { DomainError } from "./errors";

/** Normalise + validate a list of serials/IMEIs for a tracking type; rejects duplicates in the list. */
export function normalizeSerials(input: string[], tracking: "QUANTITY" | "SERIALIZED" | "IMEI"): string[] {
  const out = input.map(normalizeSerial).filter(Boolean);
  const dupes = out.filter((s, i) => out.indexOf(s) !== i);
  if (dupes.length) throw new DomainError("DUPLICATE", `Duplicate in your list: ${[...new Set(dupes)].join(", ")}`);
  for (const s of out) {
    if (tracking === "IMEI" && !isValidImei(s)) throw new DomainError("VALIDATION", `"${s}" is not a valid 15-digit IMEI.`);
    if (tracking === "SERIALIZED" && !isValidSerial(s)) throw new DomainError("VALIDATION", `"${s}" is not a valid serial number (4-40 letters/digits).`);
  }
  return out;
}

export type DeviceEntry = { serial: string; imei2: string | null };

/**
 * Accepts the strings produced by `splitSerials`: either a single IMEI/serial ("356938035643809")
 * or a dual-SIM pair joined by "/" or "|" ("356938035643809/356938035643817").
 * Validates, normalises and rejects duplicates across IMEI 1 and IMEI 2.
 */
export function normalizeDevices(input: string[], tracking: "QUANTITY" | "SERIALIZED" | "IMEI"): DeviceEntry[] {
  const devices: DeviceEntry[] = [];
  for (const raw of input) {
    const parts = raw.split(/[/|]/).map(normalizeSerial).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length > 2) throw new DomainError("VALIDATION", `"${raw}" has more than two IMEIs.`);
    const [serial, imei2] = parts as [string, string | undefined];
    if (imei2 && tracking !== "IMEI") throw new DomainError("VALIDATION", "A second IMEI is only allowed for IMEI-tracked products.");
    if (imei2 && imei2 === serial) throw new DomainError("VALIDATION", `IMEI 1 and IMEI 2 are the same (${serial}).`);
    devices.push({ serial, imei2: imei2 ?? null });
  }
  const flat = devices.flatMap((d) => (d.imei2 ? [d.serial, d.imei2] : [d.serial]));
  const dupes = flat.filter((s, i) => flat.indexOf(s) !== i);
  if (dupes.length) throw new DomainError("DUPLICATE", `Duplicate in your list: ${[...new Set(dupes)].join(", ")}`);
  for (const s of flat) {
    if (tracking === "IMEI" && !isValidImei(s)) throw new DomainError("VALIDATION", `"${s}" is not a valid 15-digit IMEI.`);
    if (tracking === "SERIALIZED" && !isValidSerial(s)) throw new DomainError("VALIDATION", `"${s}" is not a valid serial number (4-40 letters/digits).`);
  }
  return devices;
}

/** "IMEI 1 / IMEI 2" display helper used on receipts and cart lines. */
export function formatDevice(serial: string, imei2?: string | null): string {
  return imei2 ? `${serial} / ${imei2}` : serial;
}
