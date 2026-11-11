import { prisma } from "../src/config/db";
import { hashPassword } from "../src/utils/password";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to wipe and seed a production database.");
  }

  console.log("🌱 Seeding BizzyQCU database...");

  // 1. Clean existing data in reverse order of foreign keys
  await prisma.auditLog.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.orderMessage.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.store.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.passkeyCredential.deleteMany();
  await prisma.user.deleteMany();

  const hashedPw = await hashPassword("admin12345");
  const buyerPw = await hashPassword("buyer12345");
  const sellerPw = await hashPassword("seller12345");

  // 2. Create Users
  const adminUser = await prisma.user.create({
    data: {
      qcuIdNumber: "24-0001",
      email: "admin@bizzyqcu.edu.ph",
      fullName: "Admin Officer",
      memberType: "STAFF",
      role: "ADMIN",
      verificationStatus: "VERIFIED",
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
      passwordHash: hashedPw,
    },
  });

  const buyerUser = await prisma.user.create({
    data: {
      qcuIdNumber: "24-0002",
      email: "buyer@bizzyqcu.edu.ph",
      fullName: "Juan Dela Cruz",
      memberType: "STUDENT",
      role: "BUYER",
      verificationStatus: "VERIFIED",
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400",
      passwordHash: buyerPw,
    },
  });

  const sellerUser = await prisma.user.create({
    data: {
      qcuIdNumber: "24-0003",
      email: "seller@bizzyqcu.edu.ph",
      fullName: "Maria Santos",
      memberType: "STUDENT",
      role: "SELLER",
      verificationStatus: "VERIFIED",
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
      liveSelfieUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
      passwordHash: sellerPw,
    },
  });

  const pendingUser = await prisma.user.create({
    data: {
      qcuIdNumber: "24-0004",
      email: "pedro.penduko@bizzyqcu.edu.ph",
      fullName: "Pedro Penduko",
      memberType: "STUDENT",
      role: "BUYER",
      verificationStatus: "PENDING",
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800",
      liveSelfieUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
      passwordHash: buyerPw,
    },
  });

  await prisma.user.create({
    data: {
      qcuIdNumber: "24-0012",
      email: "clarisse.mendoza@bizzyqcu.edu.ph",
      fullName: "Clarisse Mendoza",
      memberType: "STUDENT",
      role: "BUYER",
      verificationStatus: "PENDING",
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1578357078586-491adf1aa5ba?w=800",
      liveSelfieUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
      passwordHash: buyerPw,
    },
  });

  await prisma.user.create({
    data: {
      qcuIdNumber: "24-0028",
      email: "mark.villanueva@bizzyqcu.edu.ph",
      fullName: "Mark Villanueva",
      memberType: "FACULTY",
      role: "BUYER",
      verificationStatus: "PENDING",
      qcuIdPhotoUrl: "https://images.unsplash.com/photo-1589330694653-dad6d3240e2b?w=800",
      liveSelfieUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800",
      passwordHash: buyerPw,
    },
  });

  // 3. Create Seller Profiles & Stores
  const sellerProfile = await prisma.sellerProfile.create({
    data: {
      userId: sellerUser.id,
      sellerType: "STUDENT_ENTERPRISE",
      supportingDocumentUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
      verificationStatus: "VERIFIED",
      paymongoSubAccountId: "sub_acc_mock_9876",
      isPaymongoVerified: true,
    },
  });

  const pendingSellerProfile = await prisma.sellerProfile.create({
    data: {
      userId: pendingUser.id,
      sellerType: "INDEPENDENT_SELLER",
      supportingDocumentUrl: "https://images.unsplash.com/photo-1568667256549-094345857637?w=800",
      verificationStatus: "PENDING",
    },
  });

  const store = await prisma.store.create({
    data: {
      sellerProfileId: sellerProfile.id,
      name: "QCU Merch & Bites",
      slug: "qcu-merch-and-bites",
      description: "Official student enterprise selling premium QCU merchandise and fresh campus snacks.",
      logoUrl: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400",
      bannerUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200",
      pickupLocation: "Academic Building 1 Lobby",
      contactNumber: "09171234567",
      approvalStatus: "VERIFIED",
      isOpen: true,
    },
  });

  await prisma.store.create({
    data: {
      sellerProfileId: pendingSellerProfile.id,
      name: "Pedro's Campus Print & Supplies",
      slug: "pedros-campus-print-supplies",
      description: "Low-cost document printing, bookbinding, and school stationery supplies on campus.",
      logoUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600",
      bannerUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200",
      pickupLocation: "Library Ground Floor",
      contactNumber: "09189876543",
      approvalStatus: "PENDING",
      isOpen: false,
    },
  });

  // 4. Categories & Products
  const catMerch = await prisma.category.create({
    data: { name: "Merchandise & Stationery", slug: "merch-stationery" },
  });
  const catFood = await prisma.category.create({
    data: { name: "Food & Beverages", slug: "food-beverages" },
  });

  await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: catMerch.id,
      name: "QCU Laser-Engraved Ballpoint Pen",
      description: "Metallic executive ballpoint pen with matte finish and laser-etched Quezon City University logo.",
      price: 85.0,
      stockQuantity: 100,
      imageUrls: [
        "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800",
        "https://images.unsplash.com/photo-1585336261026-7756f7ef06b9?w=800",
      ],
      approvalStatus: "PENDING",
      isAvailable: true,
    },
  });

  const product1 = await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: catMerch.id,
      name: "QCU Campus Classic Hoodie",
      description: "Comfortable heavyweight fleece hoodie with embroidered QCU insignia.",
      price: 450.0,
      stockQuantity: 25,
      imageUrls: ["https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600"],
      approvalStatus: "VERIFIED",
      isAvailable: true,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: catMerch.id,
      name: "QCU Lanyard & Card Case",
      description: "Durable sublimation lanyard with premium safety clip and ID case.",
      price: 120.0,
      stockQuantity: 50,
      imageUrls: ["https://images.unsplash.com/photo-1585336261026-7756f7ef06b9?w=600"],
      approvalStatus: "VERIFIED",
      isAvailable: true,
    },
  });

  const product3 = await prisma.product.create({
    data: {
      storeId: store.id,
      categoryId: catFood.id,
      name: "Artisan Fudgy Brownies (Box of 6)",
      description: "Decadent dark chocolate brownies baked fresh daily on campus.",
      price: 180.0,
      stockQuantity: 15,
      imageUrls: ["https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600"],
      approvalStatus: "VERIFIED",
      isAvailable: true,
    },
  });

  // 5. Orders & Transactions
  const order1 = await prisma.order.create({
    data: {
      orderNumber: "BZQ-20261109-0001",
      buyerId: buyerUser.id,
      storeId: store.id,
      totalAmount: 450.0,
      paymentMethod: "CASH",
      orderStatus: "COMPLETED",
      deliveryMethod: "PICKUP",
      pickupInstructions: "Meet at Student Center by 1:30 PM",
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order1.id,
      productId: product1.id,
      productNameSnapshot: product1.name,
      unitPriceSnapshot: product1.price,
      quantity: 1,
      subtotal: 450.0,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      orderId: order1.id,
      amount: 450.0,
      method: "CASH",
      status: "PAID",
      paidAt: new Date(Date.now() - 3600000 * 24),
    },
  });

  // Order 2: 120.0 + 450.0 = 570.0 PHP
  const order2 = await prisma.order.create({
    data: {
      orderNumber: "BZQ-20261109-0002",
      buyerId: buyerUser.id,
      storeId: store.id,
      totalAmount: 570.0,
      paymentMethod: "GCASH_PAYMONGO",
      orderStatus: "PREPARING",
      deliveryMethod: "ROOM_TO_ROOM",
      campusBuilding: "Academic Building 1 (Belmonte)",
      campusRoomNumber: "Room 402",
      deliveryNotes: "Please leave with Class President if class is ongoing",
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order2.id,
      productId: product2.id,
      productNameSnapshot: product2.name,
      unitPriceSnapshot: product2.price,
      quantity: 1,
      subtotal: 120.0,
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: order2.id,
      productId: product1.id,
      productNameSnapshot: product1.name,
      unitPriceSnapshot: product1.price,
      quantity: 1,
      subtotal: 450.0,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      orderId: order2.id,
      amount: 570.0,
      method: "GCASH_PAYMONGO",
      status: "PAID",
      paymongoCheckoutId: "cs_test_9238472938479238",
      paymongoPaymentIntentId: "pi_test_0129384712093841",
      sellerSubAccountId: "sub_acc_mock_9876",
      paidAt: new Date(Date.now() - 3600000 * 4),
      webhookPayload: {
        id: "evt_test_webhook_01",
        type: "payment.paid",
        data: {
          attributes: {
            amount: 57000,
            currency: "PHP",
            fee: 1425,
            net_amount: 55575,
            source: { type: "gcash" },
            payout: { destination: "sub_acc_mock_9876" },
          },
        },
      },
    },
  });

  const order3 = await prisma.order.create({
    data: {
      orderNumber: "BZQ-20261109-0003",
      buyerId: buyerUser.id,
      storeId: store.id,
      totalAmount: 180.0,
      paymentMethod: "CASH",
      orderStatus: "PENDING_CONFIRMATION",
      deliveryMethod: "PICKUP",
      pickupInstructions: "Student Center lobby stairs",
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order3.id,
      productId: product3.id,
      productNameSnapshot: product3.name,
      unitPriceSnapshot: product3.price,
      quantity: 1,
      subtotal: 180.0,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      orderId: order3.id,
      amount: 180.0,
      method: "CASH",
      status: "PENDING",
    },
  });

  // 6. Complaints & Report Tickets
  await prisma.complaint.create({
    data: {
      complainantId: buyerUser.id,
      orderId: order1.id,
      subject: "Item arrived damaged with broken seam",
      description: "The hood seam on the classic hoodie came completely undone upon unboxing. Requesting replacement or refund from the seller.",
      evidenceUrls: [
        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600",
      ],
      status: "OPEN",
    },
  });

  const complaint2 = await prisma.complaint.create({
    data: {
      complainantId: buyerUser.id,
      orderId: order3.id,
      subject: "Seller did not show up at designated campus pickup point",
      description: "Waited 30 minutes at the Student Center stairs during the agreed pickup slot. Seller did not respond to messages.",
      evidenceUrls: [],
      status: "UNDER_REVIEW",
      adminResolutionNote: "Admin contacted seller for explanation.",
      resolvedByAdminId: adminUser.id,
    },
  });

  const complaint3 = await prisma.complaint.create({
    data: {
      complainantId: sellerUser.id,
      subject: "Unauthorized logo usage by external pop-up booth",
      description: "A temporary booth near Gate 2 was distributing printed materials bearing our student enterprise's registered branding.",
      evidenceUrls: ["https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600"],
      status: "RESOLVED",
      adminResolutionNote: "Campus security informed; booth personnel ceased unauthorized brand distribution.",
      resolvedByAdminId: adminUser.id,
      resolvedAt: new Date(Date.now() - 3600000 * 12),
    },
  });

  await prisma.complaint.create({
    data: {
      complainantId: buyerUser.id,
      subject: "Dispute over cash delivery fee charge",
      description: "Runner demanded an extra 50 PHP on cash delivery despite order stating free campus delivery.",
      evidenceUrls: [],
      status: "DISMISSED",
      adminResolutionNote: "Order notes explicitly indicated special room delivery surcharges apply for top floors.",
      resolvedByAdminId: adminUser.id,
      resolvedAt: new Date(Date.now() - 3600000 * 20),
    },
  });

  // 7. System Activity & Audit Logs
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      subsystem: "AUTH",
      action: "APPROVED_USER",
      targetId: buyerUser.id,
      details: {
        targetType: "USER",
        qcuIdNumber: buyerUser.qcuIdNumber,
        newStatus: "VERIFIED",
      },
      ipAddress: "127.0.0.1",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      subsystem: "MARKETPLACE",
      action: "APPROVED_STORE",
      targetId: store.id,
      details: {
        storeName: store.name,
        sellerProfileId: sellerProfile.id,
        approvalStatus: "VERIFIED",
      },
      ipAddress: "127.0.0.1",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      subsystem: "MARKETPLACE",
      action: "APPROVED_PRODUCT",
      targetId: product1.id,
      details: {
        productName: product1.name,
        price: 450,
        approvalStatus: "VERIFIED",
      },
      ipAddress: "127.0.0.1",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      subsystem: "ADMIN",
      action: "REVIEWED_COMPLAINT",
      targetId: complaint2.id,
      details: {
        targetType: "COMPLAINT",
        newStatus: "UNDER_REVIEW",
        adminResolutionNote: "Admin contacted seller for explanation.",
      },
      ipAddress: "127.0.0.1",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      subsystem: "ADMIN",
      action: "RESOLVED_COMPLAINT",
      targetId: complaint3.id,
      details: {
        targetType: "COMPLAINT",
        newStatus: "RESOLVED",
        adminResolutionNote: "Campus security informed; booth personnel ceased unauthorized brand distribution.",
      },
      ipAddress: "127.0.0.1",
    },
  });

  console.log("✅ Seeding completed successfully!");
  console.log("Credentials:");
  console.log("  Admin: admin@bizzyqcu.edu.ph (QCU ID: 24-0001) / admin12345");
  console.log("  Buyer: buyer@bizzyqcu.edu.ph (QCU ID: 24-0002) / buyer12345");
  console.log("  Seller: seller@bizzyqcu.edu.ph (QCU ID: 24-0003) / seller12345");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
