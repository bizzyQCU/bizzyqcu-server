import { prisma } from "../src/config/db";
import { hashPassword } from "../src/utils/password";

function buildTestEmail(tag: string): string {
  const base = process.env.TEST_EMAIL_BASE?.trim().toLowerCase();
  if (base && base.includes("@")) {
    const [local, domain] = base.split("@");
    const cleanLocal = local.split("+")[0];
    return `${cleanLocal}+${tag}@${domain}`;
  }
  return `${tag}@bizzyqcu.edu.ph`;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed default test credentials in production.");
  }

  const rawPassword = process.env.TEST_ACCOUNT_PASSWORD || "12345678";
  const passwordHash = await hashPassword(rawPassword);

  const accounts = [
    {
      qcuIdNumber: "00-0001",
      email: buildTestEmail("admin"),
      fullName: "Test Admin",
      memberType: "STAFF" as const,
      role: "ADMIN" as const,
      verificationStatus: "VERIFIED" as const,
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    },
    {
      qcuIdNumber: "00-0002",
      email: buildTestEmail("buyer"),
      fullName: "Test Student Buyer",
      memberType: "STUDENT" as const,
      role: "BUYER" as const,
      verificationStatus: "VERIFIED" as const,
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
    },
    {
      qcuIdNumber: "00-0003",
      email: buildTestEmail("seller"),
      fullName: "Test Student Seller",
      memberType: "STUDENT" as const,
      role: "SELLER" as const,
      verificationStatus: "VERIFIED" as const,
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    },
    {
      qcuIdNumber: "00-0004",
      email: buildTestEmail("pending"),
      fullName: "Test Pending Student",
      memberType: "STUDENT" as const,
      role: "BUYER" as const,
      verificationStatus: "PENDING" as const,
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1578357078586-491adf1aa5ba?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    },
  ];

  const seededUsers = [];

  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { qcuIdNumber: account.qcuIdNumber },
      update: {
        email: account.email,
        fullName: account.fullName,
        memberType: account.memberType,
        role: account.role,
        verificationStatus: account.verificationStatus,
        passwordHash,
      },
      create: {
        ...account,
        passwordHash,
      },
      select: {
        id: true,
        qcuIdNumber: true,
        email: true,
        role: true,
        verificationStatus: true,
      },
    });
    seededUsers.push(user);

    if (account.role === "SELLER") {
      const sellerProfile = await prisma.sellerProfile.upsert({
        where: { userId: user.id },
        update: {
          sellerType: "STUDENT_ENTERPRISE",
          verificationStatus: "VERIFIED",
          isPaymongoVerified: true,
        },
        create: {
          userId: user.id,
          sellerType: "STUDENT_ENTERPRISE",
          supportingDocumentUrl:
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
          verificationStatus: "VERIFIED",
          paymongoSubAccountId: "sub_acc_test_0003",
          isPaymongoVerified: true,
        },
        select: { id: true },
      });

      await prisma.store.upsert({
        where: { sellerProfileId: sellerProfile.id },
        update: {
          approvalStatus: "VERIFIED",
          isOpen: true,
        },
        create: {
          sellerProfileId: sellerProfile.id,
          name: "BizzyQCU Test Enterprise",
          slug: "bizzyqcu-test-enterprise",
          description: "Default test store for verified student seller credentials.",
          logoUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400",
          bannerUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200",
          pickupLocation: "Academic Building 1 Lobby",
          contactNumber: "09170000003",
          approvalStatus: "VERIFIED",
          isOpen: true,
        },
        select: { id: true },
      });
    }
  }

  console.log("Test accounts ready (password:", rawPassword, "):");
  console.table(seededUsers);
}

main()
  .catch((err) => {
    console.error("Failed to seed test accounts:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
