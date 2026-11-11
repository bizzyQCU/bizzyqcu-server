import { env } from "./env";

/**
 * QCU IDs created by `prisma/seed-test-accounts.ts`.
 * Strictly scoped to `NODE_ENV === "development"` so staging/production
 * and automated security tests continue to enforce 2-step email OTP.
 */
export const DEV_TEST_QCU_IDS = new Set([
    "00-0001", // Admin
    "00-0002", // Verified Buyer
    "00-0003", // Verified Seller
    "00-0004", // Pending Student
]);

export function isDevTestAccountDirectLoginEnabled(qcuIdNumber: string): boolean {
    return env.NODE_ENV === "development" && DEV_TEST_QCU_IDS.has(qcuIdNumber.trim());
}
