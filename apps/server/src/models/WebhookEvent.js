import mongoose, { Schema } from "mongoose";

/**
 * Raw inbound webhook record. `bodyHash` is unique so a replayed (or
 * double-delivered) webhook is detected and ignored instead of being processed
 * twice. Rows are written even when the signature is invalid, so an operator
 * can see rejected traffic.
 */
const webhookEventSchema = new Schema({
    provider: { type: String, required: true, trim: true, index: true },
    bodyHash: { type: String, required: true, unique: true, trim: true },
    providerEventId: { type: String, default: "", trim: true, index: true },
    reference: { type: String, default: "", trim: true, index: true },
    signatureValid: { type: Boolean, default: false, index: true },
    duplicateOf: { type: Schema.Types.ObjectId, ref: "WebhookEvent", default: null },
    payload: { type: Schema.Types.Mixed, default: null },
    processingResult: { type: String, default: "" },
    processedAt: { type: Date, default: null },
}, { timestamps: true });

webhookEventSchema.index({ createdAt: -1 });

export const WebhookEventModel = mongoose.model("WebhookEvent", webhookEventSchema);
