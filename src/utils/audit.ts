import { Prisma } from "../config/db";

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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditSubsystem = "AUTH" | "MARKETPLACE" | "ORDERS" | "ADMIN";

export interface AuditInput {
  /** Admin performing the action (req.user.id). */
  actorId: string;
  /** Which subsystem owns the affected record. */
  subsystem: AuditSubsystem;
  /** One of AUDIT_ACTIONS (or a Castro-owned action string). */
  action: AuditAction | string;
  /** ID of the User / SellerProfile / Store / Product affected. */
  targetId?: string | null;
  /** Extra context stored as JSON (never put secrets or ID photos here). */
  details?: Prisma.InputJsonObject;
  /** Request IP, when available. */
  ipAddress?: string | null;
}

/**
 * Writes one AuditLog row.
 *
 * MUST be called with the transaction client (`tx`) of the same
 * `prisma.$transaction` that mutates the reviewed record, so the status change
 * and its audit trail commit or roll back together.
 */
export async function logAudit(tx: any, input: AuditInput) {
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
export function requestIp(ip?: string | null): string | null {
  if (!ip) return null;
  // Express may return IPv4-mapped IPv6 (::ffff:127.0.0.1).
  return ip.replace(/^::ffff:/, "").slice(0, 64);
}
