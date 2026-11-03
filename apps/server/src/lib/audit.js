import { AuditLogModel } from "../models/AuditLog.js";

/**
 * Append an audit log entry. Used by the payment, monetization and analytics
 * admin surfaces. Never throws: an audit failure must not roll back the
 * business action it describes.
 */
export async function writeAudit(actorId, action, targetType, targetId, details = {}) {
    if (!actorId) {
        return null;
    }
    try {
        return await AuditLogModel.create({
            actor: actorId,
            action,
            targetType,
            targetId: String(targetId),
            details,
        });
    }
    catch (error) {
        console.error("[audit] failed to write audit log", { action, targetType, targetId, error: error?.message });
        return null;
    }
}
