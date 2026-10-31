import { formatDate } from "@/lib/format";
import { D, type Decimal, type MoneyInput } from "@/lib/money";

type DeviceSource = { serialSnapshot: string[]; imei2Snapshot?: string[] };
type WarrantySource = { tag: string; endsAt: Date; status: string };

/** One printable line per sold device: "IMEI 1: … · IMEI 2: …" (or "Serial: …" when it is not an IMEI). */
export function deviceLines(item: DeviceSource): string[] {
  return item.serialSnapshot.map((serial, i) => {
    const second = item.imei2Snapshot?.[i];
    return second ? `IMEI 1: ${serial} · IMEI 2: ${second}` : `IMEI/Serial: ${serial}`;
  });
}

/** "Warranty until 23 Oct 2027 · W-tag" lines for active warranties only. */
export function warrantyLines(warranties: WarrantySource[] | undefined): string[] {
  return (warranties ?? []).filter((w) => w.status === "ACTIVE").map((w) => `Warranty until ${formatDate(w.endsAt)} · ${w.tag}`);
}

/**
 * Difference between what was charged and subtotal − discount. Always zero for new sales;
 * non-zero only on legacy sales that were booked with VAT before tax tracking was removed.
 */
export function legacyAdjustment(sale: { subtotal: MoneyInput; discount: MoneyInput; total: MoneyInput }): Decimal {
  return D(sale.total).minus(D(sale.subtotal).minus(D(sale.discount)));
}

export const RECEIPT_FORMATS = ["a4", "thermal"] as const;
export type ReceiptFormat = (typeof RECEIPT_FORMATS)[number];
export function parseReceiptFormat(value: string | null | undefined): ReceiptFormat {
  return value === "thermal" ? "thermal" : "a4";
}
