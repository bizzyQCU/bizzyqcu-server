import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { AUDIT_ACTIONS, logAudit, requestIp } from "../../utils/audit";
import { buildPagination, skipTake } from "../../utils/pagination";
/**
 * Cross-subsystem policy switches (Phase 3 open questions).
 *
 * 1. A seller may only be approved after the owner's QCU ID is VERIFIED.
 * 2. Approving a seller promotes a BUYER account to SELLER.
 *
 * Flip these to `false` if Dalupang/Manuel decide otherwise. They are kept as
 * named constants so the decision is visible in review, not buried in code.
 */
const REQUIRE_VERIFIED_USER_FOR_SELLER_APPROVAL = true;
const PROMOTE_SELLER_ROLE_ON_APPROVAL = true;
/** Fields that are safe to return to an admin (never passwordHash/otpCode). */
const SAFE_USER_SELECT = {
    id: true,
    qcuIdNumber: true,
    email: true,
    fullName: true,
    memberType: true,
    role: true,
    verificationStatus: true,
    rejectionReason: true,
    verifiedByAdminId: true,
    verifiedAt: true,
    createdAt: true,
    updatedAt: true,
};
export class VerificationService {
    // ---------------------------------------------------------------------------
    // Phase 2 – Verification queue (read)
    // ---------------------------------------------------------------------------
    /**
     * Returns the pending queue for one entity type, oldest first (FIFO).
     * ID photos and live selfies are RA 10173-protected: this service is only
     * reachable through `/api/v1/admin` (requireAuth + requireRole("ADMIN")).
     */
    static async getVerificationQueue(input) {
        const { type, page, limit } = input;
        const { skip, take } = skipTake(page, limit);
        switch (type) {
            case "user": {
                const where = { verificationStatus: "PENDING" };
                const [items, total] = await Promise.all([
                    prisma.user.findMany({
                        where,
                        select: {
                            id: true,
                            qcuIdNumber: true,
                            fullName: true,
                            memberType: true,
                            qcuIdPhotoUrl: true,
                            liveSelfieUrl: true,
                            createdAt: true,
                        },
                        orderBy: { createdAt: "asc" },
                        skip,
                        take,
                    }),
                    prisma.user.count({ where }),
                ]);
                return { type, items, pagination: buildPagination(page, limit, total) };
            }
            case "seller": {
                const where = {
                    verificationStatus: "PENDING",
                };
                const [items, total] = await Promise.all([
                    prisma.sellerProfile.findMany({
                        where,
                        select: {
                            id: true,
                            sellerType: true,
                            supportingDocumentUrl: true,
                            verificationStatus: true,
                            rejectionReason: true,
                            createdAt: true,
                            user: {
                                select: {
                                    id: true,
                                    qcuIdNumber: true,
                                    fullName: true,
                                    email: true,
                                    memberType: true,
                                    verificationStatus: true,
                                    qcuIdPhotoUrl: true,
                                    liveSelfieUrl: true,
                                },
                            },
                            store: { select: { id: true, name: true, slug: true, approvalStatus: true } },
                        },
                        orderBy: { createdAt: "asc" },
                        skip,
                        take,
                    }),
                    prisma.sellerProfile.count({ where }),
                ]);
                return { type, items, pagination: buildPagination(page, limit, total) };
            }
            case "store": {
                const where = { approvalStatus: "PENDING" };
                const [items, total] = await Promise.all([
                    prisma.store.findMany({
                        where,
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            description: true,
                            logoUrl: true,
                            bannerUrl: true,
                            pickupLocation: true,
                            approvalStatus: true,
                            createdAt: true,
                            sellerProfile: {
                                select: {
                                    id: true,
                                    sellerType: true,
                                    verificationStatus: true,
                                    user: {
                                        select: {
                                            id: true,
                                            qcuIdNumber: true,
                                            fullName: true,
                                            email: true,
                                        },
                                    },
                                },
                            },
                        },
                        orderBy: { createdAt: "asc" },
                        skip,
                        take,
                    }),
                    prisma.store.count({ where }),
                ]);
                return { type, items, pagination: buildPagination(page, limit, total) };
            }
            case "product": {
                const where = { approvalStatus: "PENDING" };
                const [items, total] = await Promise.all([
                    prisma.product.findMany({
                        where,
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            price: true,
                            stockQuantity: true,
                            imageUrls: true,
                            isAvailable: true,
                            approvalStatus: true,
                            createdAt: true,
                            category: { select: { id: true, name: true, slug: true } },
                            store: {
                                select: {
                                    id: true,
                                    name: true,
                                    slug: true,
                                    approvalStatus: true,
                                    sellerProfile: {
                                        select: {
                                            id: true,
                                            sellerType: true,
                                            verificationStatus: true,
                                            user: { select: { id: true, fullName: true, email: true } },
                                        },
                                    },
                                },
                            },
                        },
                        orderBy: { createdAt: "asc" },
                        skip,
                        take,
                    }),
                    prisma.product.count({ where }),
                ]);
                return {
                    type,
                    items: items.map((p) => ({ ...p, price: Number(p.price) })),
                    pagination: buildPagination(page, limit, total),
                };
            }
            default: {
                // Exhaustive guard: adding a new type forces a compile error here.
                const neverType = type;
                throw new AppError(`Unsupported verification type: ${String(neverType)}`, 400);
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Phase 3 – Review actions (write + audit)
    // ---------------------------------------------------------------------------
    /** PATCH /admin/verifications/users/:userId */
    static async reviewUser(userId, input) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, fullName: true, role: true, verificationStatus: true },
        });
        if (!user)
            throw new AppError("User not found.", 404);
        this.assertNotSelf(user.id, input.adminId, "user");
        this.assertPending(user.verificationStatus, "User");
        return prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: userId },
                data: {
                    verificationStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                    verifiedByAdminId: input.adminId,
                    verifiedAt: input.status === "VERIFIED" ? new Date() : null,
                },
                select: SAFE_USER_SELECT,
            });
            await logAudit(tx, {
                actorId: input.adminId,
                subsystem: "AUTH",
                action: input.status === "VERIFIED"
                    ? AUDIT_ACTIONS.APPROVED_USER
                    : AUDIT_ACTIONS.REJECTED_USER,
                targetId: userId,
                ipAddress: requestIp(input.ipAddress),
                details: {
                    targetType: "USER",
                    previousStatus: user.verificationStatus,
                    newStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                },
            });
            return updated;
        });
    }
    /** PATCH /admin/verifications/sellers/:sellerProfileId */
    static async reviewSeller(sellerProfileId, input) {
        const seller = await prisma.sellerProfile.findUnique({
            where: { id: sellerProfileId },
            select: {
                id: true,
                userId: true,
                verificationStatus: true,
                store: { select: { id: true, name: true, approvalStatus: true } },
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                        verificationStatus: true,
                    },
                },
            },
        });
        if (!seller)
            throw new AppError("Seller profile not found.", 404);
        this.assertNotSelf(seller.userId, input.adminId, "seller");
        this.assertPending(seller.verificationStatus, "Seller profile");
        if (input.status === "VERIFIED" &&
            REQUIRE_VERIFIED_USER_FOR_SELLER_APPROVAL &&
            seller.user.verificationStatus !== "VERIFIED") {
            throw new AppError("The seller's QCU ID must be VERIFIED before the seller profile can be approved.", 409);
        }
        return prisma.$transaction(async (tx) => {
            const updated = await tx.sellerProfile.update({
                where: { id: sellerProfileId },
                data: {
                    verificationStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                },
                select: {
                    id: true,
                    userId: true,
                    sellerType: true,
                    supportingDocumentUrl: true,
                    verificationStatus: true,
                    rejectionReason: true,
                    updatedAt: true,
                },
            });
            // Cross-subsystem effect: seller approval unlocks the SELLER role so the
            // owner can use Subsystem 2 (store/product) endpoints. Never demote ADMIN.
            let rolePromoted = false;
            if (input.status === "VERIFIED" &&
                PROMOTE_SELLER_ROLE_ON_APPROVAL &&
                seller.user.role === "BUYER") {
                await tx.user.update({
                    where: { id: seller.userId },
                    data: { role: "SELLER" },
                });
                rolePromoted = true;
            }
            await logAudit(tx, {
                actorId: input.adminId,
                subsystem: "AUTH",
                action: input.status === "VERIFIED"
                    ? AUDIT_ACTIONS.APPROVED_SELLER
                    : AUDIT_ACTIONS.REJECTED_SELLER,
                targetId: sellerProfileId,
                ipAddress: requestIp(input.ipAddress),
                details: {
                    targetType: "SELLER_PROFILE",
                    ownerUserId: seller.userId,
                    previousStatus: seller.verificationStatus,
                    newStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                    rolePromoted,
                },
            });
            return { ...updated, rolePromoted };
        });
    }
    /** PATCH /admin/verifications/stores/:storeId */
    static async reviewStore(storeId, input) {
        const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: {
                id: true,
                name: true,
                approvalStatus: true,
                sellerProfile: {
                    select: {
                        id: true,
                        userId: true,
                        verificationStatus: true,
                        user: { select: { fullName: true, email: true } },
                    },
                },
            },
        });
        if (!store)
            throw new AppError("Store not found.", 404);
        this.assertNotSelf(store.sellerProfile.userId, input.adminId, "store");
        this.assertPending(store.approvalStatus, "Store");
        if (input.status === "VERIFIED" && store.sellerProfile.verificationStatus !== "VERIFIED") {
            throw new AppError("The seller profile must be VERIFIED before the store can be approved.", 409);
        }
        return prisma.$transaction(async (tx) => {
            // NOTE: Store has no rejectionReason column (schema is locked), so the
            // reason is preserved in the audit log details instead.
            const updated = await tx.store.update({
                where: { id: storeId },
                data: { approvalStatus: input.status },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    approvalStatus: true,
                    updatedAt: true,
                },
            });
            await logAudit(tx, {
                actorId: input.adminId,
                subsystem: "MARKETPLACE",
                action: input.status === "VERIFIED"
                    ? AUDIT_ACTIONS.APPROVED_STORE
                    : AUDIT_ACTIONS.REJECTED_STORE,
                targetId: storeId,
                ipAddress: requestIp(input.ipAddress),
                details: {
                    targetType: "STORE",
                    sellerProfileId: store.sellerProfile.id,
                    ownerUserId: store.sellerProfile.userId,
                    previousStatus: store.approvalStatus,
                    newStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                },
            });
            return updated;
        });
    }
    /** PATCH /admin/products/:productId */
    static async reviewProduct(productId, input) {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
                id: true,
                name: true,
                approvalStatus: true,
                store: {
                    select: {
                        id: true,
                        name: true,
                        approvalStatus: true,
                        sellerProfile: { select: { userId: true } },
                    },
                },
            },
        });
        if (!product)
            throw new AppError("Product not found.", 404);
        this.assertNotSelf(product.store.sellerProfile.userId, input.adminId, "product");
        this.assertPending(product.approvalStatus, "Product");
        if (input.status === "VERIFIED" && product.store.approvalStatus !== "VERIFIED") {
            throw new AppError("The store must be VERIFIED before its products can be approved.", 409);
        }
        return prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({
                where: { id: productId },
                data: {
                    approvalStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    stockQuantity: true,
                    isAvailable: true,
                    approvalStatus: true,
                    rejectionReason: true,
                    updatedAt: true,
                },
            });
            await logAudit(tx, {
                actorId: input.adminId,
                subsystem: "MARKETPLACE",
                action: input.status === "VERIFIED"
                    ? AUDIT_ACTIONS.APPROVED_PRODUCT
                    : AUDIT_ACTIONS.REJECTED_PRODUCT,
                targetId: productId,
                ipAddress: requestIp(input.ipAddress),
                details: {
                    targetType: "PRODUCT",
                    storeId: product.store.id,
                    previousStatus: product.approvalStatus,
                    newStatus: input.status,
                    rejectionReason: input.status === "REJECTED" ? input.rejectionReason ?? null : null,
                },
            });
            return { ...updated, price: Number(updated.price) };
        });
    }
    // ---------------------------------------------------------------------------
    // Guards
    // ---------------------------------------------------------------------------
    static assertNotSelf(targetUserId, adminId, label) {
        if (targetUserId === adminId) {
            throw new AppError(`An admin cannot review their own ${label} account.`, 400);
        }
    }
    static assertPending(status, label) {
        if (status !== "PENDING") {
            throw new AppError(`${label} has already been reviewed (current status: ${status}). Only PENDING records can be reviewed.`, 409);
        }
    }
}
