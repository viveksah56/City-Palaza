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
  /** IMEI 1 (or serial) of each device in this line */
  serials: string[];
  /** IMEI 2 by IMEI 1, for display */
  imei2: Record<string, string>;
  discount?: { type: "PERCENT" | "FIXED"; value: string };
};

export type CartDevice = { serial: string; imei2: string | null };
export type CartProduct = Omit<CartItem, "quantity" | "serials" | "imei2" | "discount">;

type CartState = {
  items: CartItem[];
  /** Quantity products add one unit per call; serialized products add the scanned device (or an empty line to pick from). */
  add: (item: CartProduct, device?: CartDevice) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setSerials: (productId: string, devices: CartDevice[]) => void;
  setDiscount: (productId: string, discount: CartItem["discount"]) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

function withDevices(item: CartItem, devices: CartDevice[]): CartItem {
  const imei2: Record<string, string> = {};
  for (const d of devices) if (d.imei2) imei2[d.serial] = d.imei2;
  return { ...item, serials: devices.map((d) => d.serial), imei2, quantity: devices.length };
}

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (item, device) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === item.productId);
      if (item.trackingType === "QUANTITY") {
        if (existing) return { items: s.items.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.min(i.available, i.quantity + 1) } : i)) };
        return { items: [...s.items, { ...item, quantity: 1, serials: [], imei2: {} }] };
      }
      if (!existing) {
        const base: CartItem = { ...item, quantity: 0, serials: [], imei2: {} };
        return { items: [...s.items, device ? withDevices(base, [device]) : base] };
      }
      if (!device || existing.serials.includes(device.serial)) return s;
      const devices = [...existing.serials.map((serial) => ({ serial, imei2: existing.imei2[serial] ?? null })), device];
      return { items: s.items.map((i) => (i.productId === item.productId ? withDevices(i, devices) : i)) };
    }),
  setQuantity: (productId, quantity) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, Math.min(i.available, Math.floor(quantity) || 1)) } : i)) })),
  setSerials: (productId, devices) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? withDevices(i, devices) : i)) })),
  setDiscount: (productId, discount) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, discount } : i)) })),
  remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
  clear: () => set({ items: [] }),
}));
