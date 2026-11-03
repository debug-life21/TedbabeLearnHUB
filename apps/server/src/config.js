import dotenv from "dotenv";
import { z } from "zod";
dotenv.config();
if (process.env["JWT-SECRET"] && !process.env.JWT_SECRET) {
    process.env.JWT_SECRET = process.env["JWT-SECRET"];
}
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
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
    SMTP_FROM: z.string().default("TedbabeLearnHUB <noreply@learnhub.et>"),
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
    JWT_SECRET: z.string().min(16).default("learnhub_dev_secret_please_change_in_production"),
    JWT_EXPIRES_IN: z.string().default("7d"),
    // Email API providers (HTTPS-based, bypass SMTP port blocks on Render free tier)
    RESEND_API_KEY: z.string().default(""),
    RESEND_FROM: z.string().default(""),
    SENDGRID_API_KEY: z.string().default(""),
    BREVO_API_KEY: z.string().default(""),
}).superRefine((values, context) => {
    if (values.STORAGE_PROVIDER === "r2") {
        for (const name of ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
            if (!values[name].trim()) {
                context.addIssue({
                    code: "custom",
                    path: [name],
                    message: `${name} is required when STORAGE_PROVIDER=r2.`,
                });
            }
        }
    }
    if (values.NODE_ENV === "production" && values.JWT_SECRET === "learnhub_dev_secret_please_change_in_production") {
        console.warn("[SECURITY] WARNING: JWT_SECRET is using the default dev value in production. Set a strong JWT_SECRET environment variable immediately.");
    }
});
export const env = envSchema.parse(process.env);
env.MONGODB_URI = env.MONGO_URI || env.MONGODB_URI;
export const isProduction = env.NODE_ENV === "production";
