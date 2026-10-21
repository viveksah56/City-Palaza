import { Badge } from "@/components/ui/badge";
import type { StockStatus } from "@/lib/stock";
import { ROLE } from "@/lib/constants/roles";

const STOCK: Record<StockStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
  IN_STOCK: { label: "In stock", variant: "success" },
  LOW_STOCK: { label: "Low stock", variant: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", variant: "destructive" },
};
export function StockBadge({ status }: { status: StockStatus }) {
  const s = STOCK[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const VARIANTS: Record<string, "success" | "warning" | "destructive" | "muted" | "secondary"> = {
  ACTIVE: "success", INACTIVE: "muted", SUSPENDED: "destructive", DISCONTINUED: "destructive",
  COMPLETED: "success", VOIDED: "destructive",
  PAID: "success", PARTIAL: "warning", PENDING: "warning", REFUNDED: "muted",
  IN_STOCK: "success", SOLD: "secondary", RETURNED: "warning", DAMAGED: "destructive", LOST: "destructive",
  [ROLE.ADMIN]: "secondary", [ROLE.EMPLOYEE]: "muted",
};
const LABELS: Record<string, string> = { BANK_TRANSFER: "Bank transfer", ESEWA: "eSewa", KHALTI: "Khalti" };

export function StatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return <Badge variant={VARIANTS[status] ?? "muted"}>{label}</Badge>;
}
