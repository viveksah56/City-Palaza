export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function stockStatus(quantity: number, minStock: number): StockStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= minStock) return "LOW_STOCK";
  return "IN_STOCK";
}
