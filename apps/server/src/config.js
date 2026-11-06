import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
if (process.env["JWT-SECRET"] && !process.env.JWT_SECRET) {
  process.env.JWT_SECRET = process.env["JWT-SECRET"];
}
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    MONGO_URI: z.string().optional(),
    MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/learnhub"),
    CLIENT_URL: z.string().default("http://localhost:5173"),
    ADMIN_CLIENT_URL: z.string().default("http://localhost:5174"),
    GOOGLE_CLIENT_ID: z.string().default(""),
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().default(465), // 465=SSL (secure:true), 587=STARTTLS (secure:false)
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    // Empty by default: the From address then falls back to the authenticated
    // sender (SMTP_USER). Sending as a domain you do not own makes Gmail and
    // most providers reject the message outright.
    SMTP_FROM: z.string().default(""),
    STORAGE_PROVIDER: z.enum(["local", "r2"]).default("local"),
    R2_ACCOUNT_ID: z.string().default(""),
    R2_BUCKET: z.string().default(""),
    R2_ACCESS_KEY_ID: z.string().default(""),
    R2_SECRET_ACCESS_KEY: z.string().default(""),
    // Admin credentials — REQUIRED in production via environment variables
    ADMIN_EMAIL: z.string().default(""),
    ADMIN_PASSWORD: z.string().default(""),
    SEED_DEMO_DATA: z.enum(["true", "false"]).default("false"),
    // JWT_SECRET must be strong in production; dev fallback is intentionally weak to signal misconfiguration
    JWT_SECRET: z
      .string()
      .min(16)
      .default("learnhub_dev_secret_please_change_in_production"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    // Email API providers (HTTPS-based, bypass SMTP port blocks on Render free tier)
    RESEND_API_KEY: z.string().default(""),
    RESEND_FROM: z.string().default(""),
    SENDGRID_API_KEY: z.string().default(""),
    BREVO_API_KEY: z.string().default(""),
    // ----------------------------------------------------------------
    // Payments (Module 3). PAYMENTS_ENABLED must be "true" before any paid
    // checkout, webhook or reconciliation route will respond.
    // ----------------------------------------------------------------
    PAYMENTS_ENABLED: z.enum(["true", "false"]).default("false"),
    // sandbox | live — travels with every order/transaction for reporting.
    PAYMENT_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
    // Public HTTPS base URL of this API. Required to build gateway callback and
    // notify URLs (e.g. https://learnhub-api.onrender.com).
    SERVER_PUBLIC_URL: z.string().default(""),
    // ----------------------------------------------------------------
    // Chapa — self-serve sandbox keys from https://dashboard.chapa.co
    // Initialize: POST {CHAPA_BASE_URL}/transaction/initialize
    // Verify:     GET  {CHAPA_BASE_URL}/transaction/verify/<tx_ref>
    // Webhook signature: x-chapa-signature = HMAC-SHA256(raw body, webhook secret)
    // ----------------------------------------------------------------
    CHAPA_SECRET_KEY: z.string().default(""),
    CHAPA_WEBHOOK_SECRET: z.string().default(""),
    CHAPA_BASE_URL: z.string().default("https://api.chapa.co/v1"),
    // Chapa's published domestic fee. Used only to estimate gateway fees in
    // revenue reporting until actual per-transaction fees are reconciled.
    CHAPA_FEE_PERCENT: z.coerce.number().default(2.5),
    // ----------------------------------------------------------------
    // Telebirr — every value below is issued by Ethio Telecom during merchant
    // onboarding. TELEBIRR_BASE_URL is intentionally empty: the production
    // gateway endpoint is provided by Ethio Telecom, not guessed here.
    // ----------------------------------------------------------------
    TELEBIRR_BASE_URL: z.string().default(""),
    TELEBIRR_FABRIC_APP_ID: z.string().default(""),
    TELEBIRR_APP_SECRET: z.string().default(""),
    TELEBIRR_MERCHANT_APP_ID: z.string().default(""),
    TELEBIRR_MERCHANT_CODE: z.string().default(""),
    // PEM strings. Supports literal "\n" escapes so they survive .env files.
    TELEBIRR_PRIVATE_KEY: z.string().default(""),
    TELEBIRR_PUBLIC_KEY: z.string().default(""),
    TELEBIRR_NOTIFY_URL: z.string().default(""),
    TELEBIRR_RETURN_URL: z.string().default(""),
    TELEBIRR_FEE_PERCENT: z.coerce.number().default(0),
  })
  .superRefine((values, context) => {
    if (values.STORAGE_PROVIDER === "r2") {
      for (const name of [
        "R2_ACCOUNT_ID",
        "R2_BUCKET",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
      ]) {
        if (!values[name].trim()) {
          context.addIssue({
            code: "custom",
            path: [name],
            message: `${name} is required when STORAGE_PROVIDER=r2.`,
          });
        }
      }
    }
    if (
      values.NODE_ENV === "production" &&
      values.JWT_SECRET === "learnhub_dev_secret_please_change_in_production"
    ) {
      console.warn(
        "[SECURITY] WARNING: JWT_SECRET is using the development default in production. Replace it with a strong random secret immediately.",
      );
    } else if (
      values.NODE_ENV === "production" &&
      values.JWT_SECRET.length < 32
    ) {
      console.warn(
        "[SECURITY] WARNING: JWT_SECRET is shorter than 32 characters. Use a longer random secret when rotating production credentials.",
      );
    }
    if (values.PAYMENTS_ENABLED === "true") {
      if (!values.SERVER_PUBLIC_URL.trim()) {
        console.warn(
          "[PAYMENTS] WARNING: PAYMENTS_ENABLED=true but SERVER_PUBLIC_URL is empty. Gateway callback and notify URLs cannot be built, so webhooks will never arrive.",
        );
      } else if (!/^https:\/\//i.test(values.SERVER_PUBLIC_URL.trim())) {
        console.warn(
          "[PAYMENTS] WARNING: SERVER_PUBLIC_URL is not HTTPS. Both Chapa and Telebirr require HTTPS callback URLs.",
        );
      }
      if (!values.CHAPA_SECRET_KEY.trim() && !values.TELEBIRR_BASE_URL.trim()) {
        console.warn(
          "[PAYMENTS] WARNING: PAYMENTS_ENABLED=true but no provider is configured (CHAPA_SECRET_KEY and TELEBIRR_BASE_URL are both empty). Checkout will be unavailable.",
        );
      }
      if (
        values.PAYMENT_ENVIRONMENT === "live" &&
        values.TELEBIRR_BASE_URL.trim() &&
        !values.TELEBIRR_PRIVATE_KEY.trim()
      ) {
        console.warn(
          "[PAYMENTS] WARNING: Telebirr is configured in live mode without TELEBIRR_PRIVATE_KEY. Request signing will fail.",
        );
      }
    }
  });
export const env = envSchema.parse(process.env);
env.MONGODB_URI = env.MONGO_URI || env.MONGODB_URI;
export const isProduction = env.NODE_ENV === "production";
