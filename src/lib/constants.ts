export const APP_NAME = "CityPalaza";
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kathmandu";
export const SESSION_COOKIE = "cp_session";
export const REFRESH_COOKIE = "cp_refresh";
export const ACCESS_TOKEN_TTL_MINUTES = 15;
const configuredSessionMaxAgeHours = Number(process.env.SESSION_MAX_AGE_HOURS);
export const SESSION_MAX_AGE_HOURS = Number.isInteger(configuredSessionMaxAgeHours) && configuredSessionMaxAgeHours > 0
  ? configuredSessionMaxAgeHours
  : 24;
export const DEFAULT_PAGE_SIZE = 20;
export const LOW_STOCK_NOTIFICATIONS_CACHE_TAG = "low-stock-notifications";

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
