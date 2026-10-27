import { prisma, Prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { AUDIT_ACTIONS, logAudit, requestIp } from "../../utils/audit";
import { buildPagination } from "../../utils/pagination";

interface DuplicateCandidate {
  id: string;
  qcuIdNumber: string;
  email: string;
  fullName: string;
  memberType: string;
  role: string;
  verificationStatus: string;
  qcuIdPhotoUrl: string;
  liveSelfieUrl: string;
  createdAt: Date;
}

interface DuplicateCluster {
  clusterId: string;
  signals: string[];
  sameNormalizedName: string[];
  repeatedQcuIdPhotoUrl: string[];
  repeatedLiveSelfieUrl: string[];
  users: DuplicateCandidate[];
}

/** Union-Find so a user linked by name AND by photo lands in one cluster. */
class DisjointSet {
  private parent = new Map<string, string>();

  add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id) ?? id;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}

const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const safeUserSelect = {
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
} satisfies Prisma.UserSelect;

export class DisputesService {
  // ---------------------------------------------------------------------------
  // GET /admin/duplicates
  // ---------------------------------------------------------------------------
  /**
   * Finds lookalike accounts using three signals:
   *  1. same normalised full name (case/punctuation/word-order insensitive)
   *  2. the same qcuIdPhotoUrl reused by more than one account
   *  3. the same liveSelfieUrl reused by more than one account
   *
   * `qcuIdNumber` and `email` are already @unique, so true duplicates cannot be
   * registered; this endpoint surfaces the attempts that slipped through.
   */
  static async getDuplicates(input: { page: number; limit: number }) {
    const users = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: {
        id: true,
        qcuIdNumber: true,
        email: true,
        fullName: true,
        memberType: true,
        role: true,
        verificationStatus: true,
        qcuIdPhotoUrl: true,
        liveSelfieUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 2000,
    });

    const dsu = new DisjointSet();
    const byName = new Map<string, string[]>();
    const byIdPhoto = new Map<string, string[]>();
    const bySelfie = new Map<string, string[]>();

    for (const user of users) {
      dsu.add(user.id);

      const normalized = normalizeName(user.fullName);
      if (normalized) {
        byName.set(normalized, [...(byName.get(normalized) ?? []), user.id]);
      }
      if (user.qcuIdPhotoUrl) {
        byIdPhoto.set(user.qcuIdPhotoUrl, [
          ...(byIdPhoto.get(user.qcuIdPhotoUrl) ?? []),
          user.id,
        ]);
      }
      if (user.liveSelfieUrl) {
        bySelfie.set(user.liveSelfieUrl, [
          ...(bySelfie.get(user.liveSelfieUrl) ?? []),
          user.id,
        ]);
      }
    }

    const linkGroups = (groups: Map<string, string[]>) => {
      for (const ids of groups.values()) {
        for (let i = 1; i < ids.length; i += 1) dsu.union(ids[0], ids[i]);
      }
    };
    linkGroups(byName);
    linkGroups(byIdPhoto);
    linkGroups(bySelfie);

    const userById = new Map<string, any>(users.map((u: any) => [u.id, u]));
    const clustersById = new Map<string, string[]>();
    for (const user of users) {
      const root = dsu.find(user.id);
      clustersById.set(root, [...(clustersById.get(root) ?? []), user.id]);
    }

    const duplicateClusters: DuplicateCluster[] = [];
    for (const ids of clustersById.values()) {
      if (ids.length < 2) continue;

      const members = ids
        .map((id) => userById.get(id))
        .filter((u): u is DuplicateCandidate => Boolean(u))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const names = new Set(members.map((m) => normalizeName(m.fullName)));
      const photos = new Set(members.map((m) => m.qcuIdPhotoUrl).filter(Boolean));
      const selfies = new Set(members.map((m) => m.liveSelfieUrl).filter(Boolean));

      const sameNormalizedName = [...names].filter(
        (name) => (byName.get(name)?.length ?? 0) > 1
      );
      const repeatedQcuIdPhotoUrl = [...photos].filter(
        (url) => (byIdPhoto.get(url)?.length ?? 0) > 1
      );
      const repeatedLiveSelfieUrl = [...selfies].filter(
        (url) => (bySelfie.get(url)?.length ?? 0) > 1
      );

      const signals: string[] = [];
      if (sameNormalizedName.length) signals.push("SAME_NORMALIZED_NAME");
      if (repeatedQcuIdPhotoUrl.length) signals.push("REPEATED_QCU_ID_PHOTO");
      if (repeatedLiveSelfieUrl.length) signals.push("REPEATED_LIVE_SELFIE");

      duplicateClusters.push({
        clusterId: members[0].id,
        signals,
        sameNormalizedName,
        repeatedQcuIdPhotoUrl,
        repeatedLiveSelfieUrl,
        users: members,
      });
    }

    duplicateClusters.sort(
      (a, b) =>
        b.users.length - a.users.length ||
        a.users[0].createdAt.getTime() - b.users[0].createdAt.getTime()
    );

    const total = duplicateClusters.length;
    const start = (input.page - 1) * input.limit;
    const items = duplicateClusters.slice(start, start + input.limit);

    return {
      items,
      pagination: buildPagination(input.page, input.limit, total),
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /admin/duplicates/:userId
  // ---------------------------------------------------------------------------
  static async rejectDuplicate(input: {
    adminId: string;
    userId: string;
    rejectionReason: string;
    duplicateOfUserId?: string;
    ipAddress?: string | null;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, fullName: true, role: true, verificationStatus: true },
    });
    if (!user) throw new AppError("User not found.", 404);
    if (user.id === input.adminId) {
      throw new AppError("An admin cannot reject their own account as a duplicate.", 400);
    }
    if (user.role === "ADMIN") {
      throw new AppError("Admin accounts cannot be rejected as duplicates.", 400);
    }
    if (user.verificationStatus === "REJECTED") {
      throw new AppError("This account is already REJECTED.", 409);
    }

    if (input.duplicateOfUserId) {
      if (input.duplicateOfUserId === input.userId) {
        throw new AppError("duplicateOfUserId cannot be the same as the account being rejected.", 400);
      }
      const original = await prisma.user.findUnique({
        where: { id: input.duplicateOfUserId },
        select: { id: true },
      });
      if (!original) throw new AppError("Original account (duplicateOfUserId) not found.", 404);
    }

    return prisma.$transaction(async (tx: any) => {
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: {
          verificationStatus: "REJECTED",
          rejectionReason: input.rejectionReason,
          verifiedByAdminId: input.adminId,
          verifiedAt: null,
        },
        select: safeUserSelect,
      });

      await logAudit(tx, {
        actorId: input.adminId,
        subsystem: "AUTH",
        action: AUDIT_ACTIONS.REJECTED_DUPLICATE_USER,
        targetId: input.userId,
        ipAddress: requestIp(input.ipAddress),
        details: {
          targetType: "USER",
          previousStatus: user.verificationStatus,
          newStatus: "REJECTED",
          rejectionReason: input.rejectionReason,
          duplicateOfUserId: input.duplicateOfUserId ?? null,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // POST /admin/disputes/:userId/reopen
  // ---------------------------------------------------------------------------
  /**
   * Schema is locked, so a dispute is not a separate table: reopening is stored
   * as the status transition REJECTED -> PENDING plus an AuditLog row
   * (subsystem ADMIN, action DISPUTE_REOPENED) that keeps the previous reason.
   */
  static async reopenDispute(input: {
    adminId: string;
    userId: string;
    reason?: string;
    ipAddress?: string | null;
  }) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        fullName: true,
        role: true,
        verificationStatus: true,
        rejectionReason: true,
      },
    });
    if (!user) throw new AppError("User not found.", 404);
    if (user.id === input.adminId) {
      throw new AppError("An admin cannot reopen a dispute on their own account.", 400);
    }
    if (user.verificationStatus !== "REJECTED") {
      throw new AppError(
        `Only REJECTED accounts can be reopened (current status: ${user.verificationStatus}).`,
        409
      );
    }

    return prisma.$transaction(async (tx: any) => {
      const updated = await tx.user.update({
        where: { id: input.userId },
        data: {
          verificationStatus: "PENDING",
          rejectionReason: null,
          verifiedByAdminId: null,
          verifiedAt: null,
        },
        select: safeUserSelect,
      });

      await logAudit(tx, {
        actorId: input.adminId,
        subsystem: "ADMIN",
        action: AUDIT_ACTIONS.DISPUTE_REOPENED,
        targetId: input.userId,
        ipAddress: requestIp(input.ipAddress),
        details: {
          targetType: "USER",
          previousStatus: "REJECTED",
          newStatus: "PENDING",
          previousRejectionReason: user.rejectionReason ?? null,
          reason: input.reason ?? null,
        },
      });

      return updated;
    });
  }
}
