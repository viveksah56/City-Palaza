import { create } from "zustand";

/** TEMPORARY client state only. Prices here are for display; the server recomputes everything. */
export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  sku: string;
  unitPrice: string;
  maxDiscountPercent: string;
  trackingType: "QUANTITY" | "SERIALIZED" | "IMEI";
  available: number;
  quantity: number;
  serials: string[];
  discount?: { type: "PERCENT" | "FIXED"; value: string };
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity" | "serials">) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setSerials: (productId: string, serials: string[]) => void;
  setDiscount: (productId: string, discount: CartItem["discount"]) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (item) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === item.productId);
      if (existing) {
        if (item.trackingType !== "QUANTITY") return s;
        return { items: s.items.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.min(i.available, i.quantity + 1) } : i)) };
      }
      return { items: [...s.items, { ...item, quantity: item.trackingType === "QUANTITY" ? 1 : 0, serials: [] }] };
    }),
  setQuantity: (productId, quantity) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(i.available, Math.floor(quantity) || 1)) } : i)) })),
  setSerials: (productId, serials) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, serials, quantity: serials.length } : i)) })),
  setDiscount: (productId, discount) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, discount } : i)) })),
  remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ items: [] }),
}));
