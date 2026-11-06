import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config.js";
import { errorHandler } from "./lib/http.js";
import { adminRouter } from "./routes/adminRoutes.js";
import { analyticsRouter } from "./routes/analyticsRoutes.js";
import { monetizationRouter } from "./routes/monetizationRoutes.js";
import { paymentAdminRouter } from "./routes/paymentAdminRoutes.js";
import { paymentRouter } from "./routes/paymentRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { commonRouter } from "./routes/commonRoutes.js";
import { publicRouter } from "./routes/publicRoutes.js";
import { studentRouter } from "./routes/studentRoutes.js";
import { teacherRouter } from "./routes/teacherRoutes.js";
import { resourceRouter } from "./routes/resourceRoutes.js";
import { aiRouter } from "./routes/aiRoutes.js";

export const app = express();

// Trust reverse proxy for accurate client IP identification on Render, Vercel, Cloudflare
app.set("trust proxy", 1);

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());

const rawOrigins = [
    env.CLIENT_URL,
    env.ADMIN_CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
];
const allowedOrigins = new Set(
    rawOrigins
        .flatMap((item) => (item ? item.split(",") : []))
        .map((url) => url.trim().replace(/\/+$/, ""))
        .filter(Boolean),
);

app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }
        const cleaned = origin.replace(/\/+$/, "");
        if (allowedOrigins.has(cleaned)) {
            return callback(null, true);
        }
        // Allow local development ports
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleaned)) {
            return callback(null, true);
        }
        callback(null, false);
    },
    credentials: true,
}));
// The raw buffer is kept so gateway webhook signatures can be verified against
// the exact bytes the provider signed. Express parses the JSON as usual; the
// buffer is simply retained on the request.
app.use(express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(cookieParser());
app.use(morgan("dev"));
const isDev = env.NODE_ENV === "development";
app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 1000 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." },
}), authRouter);
app.use("/api/public", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 2000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." },
}), publicRouter);
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "learnhub-api",
        time: new Date().toISOString(),
    });
});
app.use("/api/common", commonRouter);
// Registered before the main admin router so analytics paths resolve here.
app.use("/api/admin/analytics", analyticsRouter);
// Registered before the main admin router for the same reason.
app.use("/api/admin/monetization", monetizationRouter);
// Admin payment dashboard and refund management (Module 4).
app.use("/api/admin/payments", paymentAdminRouter);
app.use("/api/admin", adminRouter);
// Student checkout, transaction history, receipts and gateway webhooks.
app.use("/api/payments", paymentRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/student", studentRouter);
app.use("/api/resources", resourceRouter);
app.use("/api/ai", aiRouter);
app.use(errorHandler);
