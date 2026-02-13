export const DEV_USER_ID = "dev_user_id";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const STRIPE_PRICE_ID =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? "price_placeholder";

export const STRIPE_PRICE_ID_WEEKLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_WEEKLY ?? "";

export const STRIPE_PRICE_ID_MONTHLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY ?? "";

export const STRIPE_PRICE_ID_YEARLY =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_YEARLY ?? "";
