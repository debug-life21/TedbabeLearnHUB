import { env } from "../config.js";
import { ApiError } from "../lib/http.js";
import * as chapa from "./chapa.js";
import * as telebirr from "./telebirr.js";

/**
 * Payment provider registry.
 *
 * Every adapter implements the same contract so the payment service never
 * branches on provider identity:
 *   id, label, feePercent,
 *   capabilities   { initialize, verify, webhook, refund, recurring }
 *   isConfigured() -> boolean
 *   initialize({ order, transaction, student, returnUrl, notifyUrl })
 *   verify({ transaction }) -> { status, amountSantim, feeSantim, ... }
 *   parseWebhook({ headers, rawBody, body }) -> { signatureValid, reference, status, ... }
 *   refund({ transaction, amountSantim, reason })
 *
 * Provider capabilities genuinely differ (Chapa has a sandbox and no public
 * refund API; Telebirr has no hosted checkout in the Cross-App flow and needs
 * IP whitelisting). `capabilities` is therefore data, not an assumption, and the
 * UI reads it instead of hard-coding provider behaviour.
 */
const adapters = new Map([
    [chapa.id, chapa],
    [telebirr.id, telebirr],
]);

export const providerIds = [...adapters.keys()];

export function getProvider(providerId) {
    const adapter = adapters.get(String(providerId || "").toLowerCase());
    if (!adapter) {
        throw new ApiError(400, `Unknown payment provider "${providerId}".`);
    }
    return adapter;
}

/** Safe-to-expose metadata. Never includes keys or secrets. */
export function listProviders() {
    return [...adapters.values()].map((adapter) => ({
        id: adapter.id,
        label: adapter.label,
        configured: adapter.isConfigured(),
        capabilities: adapter.capabilities,
        environment: env.PAYMENT_ENVIRONMENT,
        feePercent: Number.isFinite(adapter.feePercent) ? adapter.feePercent : 0,
    }));
}

/** Providers that can actually take a payment right now. */
export function configuredProviders() {
    return listProviders().filter((provider) => provider.configured && provider.capabilities.initialize);
}
