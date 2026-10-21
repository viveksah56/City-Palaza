export const APP_NAME = "CityPalaza";
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kathmandu";
export const SESSION_COOKIE = "cp_session";
export const REFRESH_COOKIE = "cp_refresh";
export const ACCESS_TOKEN_TTL_MINUTES = 15;
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const DEFAULT_PAGE_SIZE = 20;

export const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "ESEWA", "KHALTI", "OTHER"] as const;
export const PAYMENT_STATUSES = ["PAID", "PARTIAL", "PENDING", "REFUNDED"] as const;
export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  ESEWA: "eSewa",
  KHALTI: "Khalti",
  OTHER: "Other",
};
export const TRACKING_LABELS = { QUANTITY: "Quantity", SERIALIZED: "Serial number", IMEI: "IMEI" } as const;
export const TX_TYPES = ["INITIAL_STOCK", "PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "DAMAGE", "LOST"] as const;
