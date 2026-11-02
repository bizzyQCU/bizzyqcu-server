import { OrderStatus, UserRole } from "../../config/db";
import { AppError } from "../../utils/AppError";

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PENDING_CONFIRMATION", "CANCELLED"],
  PENDING_CONFIRMATION: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const ROLE_ALLOWED_STATUSES: Record<UserRole, OrderStatus[]> = {
  BUYER: ["CANCELLED"],
  SELLER: [
    "PREPARING",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED", // <-- IDINAGDAG ITO
  ],
  ADMIN: [
    "PENDING_PAYMENT",
    "PENDING_CONFIRMATION",
    "PREPARING",
    "READY_FOR_PICKUP",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ],
};

export function assertValidTransition(
  from: OrderStatus,
  to: OrderStatus
): void {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new AppError(
      `Invalid order transition: ${from} → ${to}.`,
      409
    );
  }
}

export function assertRoleCanSetStatus(
  role: UserRole,
  status: OrderStatus
): void {
  if (!ROLE_ALLOWED_STATUSES[role].includes(status)) {
    throw new AppError(
      `Role ${role} is not allowed to set status ${status}.`,
      403
    );
  }
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}