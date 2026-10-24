export const APP_NAME = "CityPlaza";
export const DEFAULT_BUSINESS_DETAILS = {
  name: APP_NAME,
  address: "Mirchiaya",
  city: "Sirahah",
  phone: "",
  email: "",
  panNumber: "612865374",
} as const;
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kathmandu";
export const SESSION_COOKIE = "cp_session";
export const REFRESH_COOKIE = "cp_refresh";
export const ACCESS_TOKEN_TTL_MINUTES = 15;
/** A rotated refresh token presented again after this window is treated as replayed (possibly stolen). */
export const REFRESH_REUSE_GRACE_SECONDS = 10;
/** Where we send a browser whose session is gone: clears cookies, then lands on /login with a notice. */
export const SESSION_EXPIRED_LOGOUT_URL = "/api/auth/logout?reason=expired";
export const LOGIN_NOTICES = {
  expired: "Your session has expired. Please sign in again.",
  security: "You were signed out because this session was used from another place. Please sign in again.",
  "signed-out": "You have been signed out.",
} as const;
export type LoginNoticeKey = keyof typeof LOGIN_NOTICES;
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
