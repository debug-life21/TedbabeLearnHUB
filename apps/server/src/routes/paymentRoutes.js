import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth.js";
import { ApiError, asyncHandler } from "../lib/http.js";
import {
    buildReceipt,
    cancelStudentSubscription,
    cancelOrder,
    createOrder,
    ensurePaymentsEnabled,
    getStudentOrder,
    listStudentOrders,
    listStudentSubscriptions,
    paymentConfig,
    processWebhook,
    startCheckout,
    verifyOrder,
} from "../services/paymentService.js";

/**
 * Student payment surface (Modules 3 and 5) plus the gateway webhook endpoints.
 *
 * Everything a student can read is scoped to `req.user.id`, so an order or
 * receipt belonging to someone else is a 404/403 rather than a data leak.
 * Webhooks are unauthenticated by necessity — their authenticity comes from the
 * provider signature check inside the payment service, never from a session.
 */
export const paymentRouter = Router();

// `requireRole` only authorises an already-authenticated request; it does not
// resolve a token itself. Every student route therefore pairs both guards. The
// webhook route below is deliberately left unauthenticated.
const asStudent = [requireAuth, requireRole("student")];

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid identifier.");

const orderItem = z.object({
    itemType: z.enum(["course", "plan"]),
    itemId: objectId,
    quantity: z.coerce.number().int().min(1).max(10).optional(),
});

const createOrderSchema = z.object({
    items: z.array(orderItem).min(1).max(10),
    promotionCode: z.string().trim().max(40).optional().default(""),
    providerId: z.string().trim().max(40).optional().default(""),
});

const checkoutSchema = z.object({
    orderId: objectId,
    providerId: z.string().trim().min(1).max(40),
    returnUrl: z.string().trim().max(500).optional(),
    cancelUrl: z.string().trim().max(500).optional(),
});

const listQuerySchema = z.object({
    status: z.enum(["pending", "processing", "paid", "failed", "cancelled", "expired", "refunded", "partially_refunded"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Any signed-in user may read which payment methods are available; the response
// never contains a key or a secret.
paymentRouter.get("/config", requireAuth, asyncHandler(async (_req, res) => {
    res.json(paymentConfig());
}));

// ---------------------------------------------------------------------------
// Orders and checkout (student)
// ---------------------------------------------------------------------------

paymentRouter.post("/orders", ...asStudent, asyncHandler(async (req, res) => {
    const data = createOrderSchema.parse(req.body ?? {});
    const order = await createOrder({
        studentId: req.user.id,
        items: data.items,
        promotionCode: data.promotionCode,
        providerId: data.providerId,
    });
    res.status(201).json({ order });
}));

paymentRouter.get("/orders", ...asStudent, asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query ?? {});
    res.json({ orders: await listStudentOrders(req.user.id, query) });
}));

paymentRouter.get("/subscriptions", ...asStudent, asyncHandler(async (req, res) => {
    res.json({ subscriptions: await listStudentSubscriptions(req.user.id) });
}));

paymentRouter.post("/subscriptions/:subscriptionId/cancel", ...asStudent, asyncHandler(async (req, res) => {
    const subscriptionId = objectId.parse(req.params.subscriptionId);
    res.json({ subscription: await cancelStudentSubscription({ subscriptionId, studentId: req.user.id }) });
}));

paymentRouter.get("/orders/:orderId", ...asStudent, asyncHandler(async (req, res) => {
    const orderId = objectId.parse(req.params.orderId);
    res.json(await getStudentOrder({ orderId, studentId: req.user.id }));
}));

paymentRouter.post("/checkout", ...asStudent, asyncHandler(async (req, res) => {
    const data = checkoutSchema.parse(req.body ?? {});
    const result = await startCheckout({
        studentId: req.user.id,
        orderId: data.orderId,
        providerId: data.providerId,
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
    });
    res.json({
        order: result.order,
        transaction: {
            id: String(result.transaction._id),
            reference: result.transaction.reference,
            provider: result.transaction.provider,
            status: result.transaction.status,
            amountSantim: result.transaction.amountSantim,
            currency: result.transaction.currency,
        },
        checkoutUrl: result.checkoutUrl,
        instructions: result.instructions,
        reused: result.reused,
    });
}));

// Step 7 of the Module 5 flow: the client never decides the outcome, it only
// asks the server to check with the gateway.
paymentRouter.post("/orders/:orderId/verify", ...asStudent, asyncHandler(async (req, res) => {
    const orderId = objectId.parse(req.params.orderId);
    const result = await verifyOrder({ orderId, studentId: req.user.id });
    res.json({
        order: result.order,
        transaction: result.transaction,
        fulfilled: result.fulfilled,
        settled: result.settled,
        mismatch: Boolean(result.mismatch),
    });
}));

paymentRouter.post("/orders/:orderId/cancel", ...asStudent, asyncHandler(async (req, res) => {
    const orderId = objectId.parse(req.params.orderId);
    res.json({ order: await cancelOrder({ orderId, studentId: req.user.id }) });
}));

// ---------------------------------------------------------------------------
// Receipts (student)
// ---------------------------------------------------------------------------

paymentRouter.get("/transactions/:transactionId/receipt", ...asStudent, asyncHandler(async (req, res) => {
    const transactionId = objectId.parse(req.params.transactionId);
    const receipt = await buildReceipt({ transactionId, studentId: req.user.id });
    res.json({ receipt });
}));

// ---------------------------------------------------------------------------
// Webhooks (unauthenticated; authenticated by provider signature)
// ---------------------------------------------------------------------------

paymentRouter.post("/webhook/:providerId", asyncHandler(async (req, res) => {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
    const result = await processWebhook({
        providerId: req.params.providerId,
        headers: req.headers,
        rawBody,
        body: req.body,
    });
    // Gateways retry on non-2xx, so an acknowledged-but-ignored event still
    // returns 200 to stop redelivery storms.
    res.json({ received: true, ...result });
}));

// ---------------------------------------------------------------------------
// Operator hooks
// ---------------------------------------------------------------------------

paymentRouter.get("/capabilities", requireAuth, asyncHandler(async (_req, res) => {
    ensurePaymentsEnabled();
    const config = paymentConfig();
    res.json({ environment: config.environment, providers: config.providers });
}));

paymentRouter.use((_req, _res, next) => next(new ApiError(404, "Unknown payment endpoint.")));
