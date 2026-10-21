import { create } from "zustand";

/** TEMPORARY client state only. Prices here are for display; the server recomputes everything. */
export type CartItem = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: string;
  discountPercent: string;
  trackingType: "QUANTITY" | "SERIALIZED" | "IMEI";
  available: number;
  quantity: number;
  serials: string[];
};

type CartState = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity" | "serials">) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setSerials: (productId: string, serials: string[]) => void;
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
  remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ items: [] }),
}));
