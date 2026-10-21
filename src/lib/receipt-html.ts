import { formatCurrency, formatDateTime, fullName } from "./format";
import type { Settings } from "@/server/settings.service";
import type { getSaleForUser } from "@/server/sales.service";

type Sale = NonNullable<Awaited<ReturnType<typeof getSaleForUser>>>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Standalone printable receipt (used by the "Download" button). */
export function receiptHtml(sale: Sale, s: Settings): string {
  const m = (v: unknown) => formatCurrency(v as string, s.currency);
  const rows = sale.items
    .map(
      (i) => `<tr><td>${esc(i.productName)}<br><small>${esc(i.sku)}${i.serials.length ? " · " + i.serials.map((x) => esc(x.serial)).join(", ") : ""}</small></td>
      <td class="r">${i.quantity}</td><td class="r">${m(i.unitPrice)}</td><td class="r">${m(i.discount)}</td><td class="r">${m(i.total)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Receipt ${esc(sale.saleNumber)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#11201e}
h1{margin:0;font-size:22px}small{color:#546a67}table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{padding:6px 4px;border-bottom:1px solid #d9e2df;text-align:left}.r{text-align:right}.tot td{border:0;padding:2px 4px}
.void{color:#b42318;font-weight:700;border:2px solid #b42318;display:inline-block;padding:2px 10px;margin:8px 0}</style></head><body>
<h1>${esc(s.shopName)}</h1><small>${esc([s.address, s.city].filter(Boolean).join(", "))}<br>${esc([s.phone, s.email].filter(Boolean).join(" · "))}</small>
${sale.status === "VOIDED" ? '<div class="void">VOIDED</div>' : ""}
<p><b>${esc(sale.saleNumber)}</b><br>${formatDateTime(sale.createdAt)}<br>Served by ${esc(fullName(sale.employee))}<br>Customer: ${esc(sale.customer?.name ?? "Walk-in")}</p>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Disc.</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
<table class="tot"><tr><td>Subtotal</td><td class="r">${m(sale.subtotal)}</td></tr><tr><td>Discount</td><td class="r">-${m(sale.discount)}</td></tr>
<tr><td>Tax (${sale.taxRate.toString()}%)</td><td class="r">${m(sale.tax)}</td></tr><tr><td><b>Total</b></td><td class="r"><b>${m(sale.total)}</b></td></tr></table>
<p>Payment: ${esc(sale.paymentMethod.replace("_", " "))} · ${esc(sale.paymentStatus)}</p><p><small>Thank you for shopping at ${esc(s.shopName)}.</small></p></body></html>`;
}
