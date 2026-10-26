/**
 * Central audit-action vocabulary (Subsystem 4).
 *
 * The scaffold used APPROVED_USER / REJECTED_USER while the schema comment
 * mentions APPROVED_USER_ID.  Both Castro (audit log viewer) and Guades must
 * read from one list, so every action string lives here.  If the team picks the
 * `_ID` suffix later, only this object changes.
 */
export const AUDIT_ACTIONS = {
    APPROVED_USER: "APPROVED_USER",
    REJECTED_USER: "REJECTED_USER",
    REJECTED_DUPLICATE_USER: "REJECTED_DUPLICATE_USER",
    DISPUTE_REOPENED: "DISPUTE_REOPENED",
    APPROVED_SELLER: "APPROVED_SELLER",
    REJECTED_SELLER: "REJECTED_SELLER",
    APPROVED_STORE: "APPROVED_STORE",
    REJECTED_STORE: "REJECTED_STORE",
    APPROVED_PRODUCT: "APPROVED_PRODUCT",
    REJECTED_PRODUCT: "REJECTED_PRODUCT",
};
/**
 * Writes one AuditLog row.
 *
 * MUST be called with the transaction client (`tx`) of the same
 * `prisma.$transaction` that mutates the reviewed record, so the status change
 * and its audit trail commit or roll back together.
 */
export async function logAudit(tx, input) {
    return tx.auditLog.create({
        data: {
            actorId: input.actorId,
            subsystem: input.subsystem,
            action: input.action,
            targetId: input.targetId ?? null,
            details: input.details,
            ipAddress: input.ipAddress ?? null,
        },
        select: { id: true, action: true, targetId: true, createdAt: true },
    });
}
/** Normalises `req.ip` / `x-forwarded-for` into a short, safe string. */
export function requestIp(ip) {
    if (!ip)
        return null;
    // Express may return IPv4-mapped IPv6 (::ffff:127.0.0.1).
    return ip.replace(/^::ffff:/, "").slice(0, 64);
}
