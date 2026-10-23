Here is your complete **Lead Architect Starter Kit** for **BizzyQCU**.

We will use **Node.js + Express + TypeScript + Prisma ORM (PostgreSQL)**. Why Prisma + PostgreSQL instead of MongoDB for this specific SIA project? Because you are dealing with **Subsystems integration, financial transactions (PayMongo split payments), inventory stock locking, and strict relational states**. With Prisma, once you run `npx prisma generate`, all 8 of your teammates get strict TypeScript autocomplete for every table and column—meaning they cannot accidentally misspell a field name or break another subsystem's data.

---

## Part 1: Project Initialization & Folder Structure

Run these commands to initialize the repository that you will push to GitHub for your team:

```bash
mkdir bizzyqcu-backend && cd bizzyqcu-backend
npm init -y

# Install Core Dependencies
npm install express cors dotenv zod @prisma/client @simplewebauthn/server axios multer cloudinary

# Install TypeScript & Dev Dependencies
npm install -D typescript @types/node @types/express @types/cors @types/multer tsx prisma

# Initialize TypeScript and Prisma
npx tsc --init
npx prisma init

```

Set up this exact folder structure so nobody steps on anyone else's toes:

```text
bizzyqcu-backend/
├── prisma/
│   ├── schema.prisma          # 🔒 LOCKED: Only Dalupang edits this
│   └── seed.ts                # Dummy QCU data for testing
├── src/
│   ├── config/
│   │   ├── db.ts              # Prisma client instance
│   │   ├── env.ts             # Environment variable validator
│   │   └── paymongo.ts        # PayMongo Axios client (Dalupang)
│   ├── middlewares/
│   │   ├── error.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── auth.middleware.ts # Vizconde builds RBAC here
│   ├── modules/
│   │   ├── auth/              # 📁 Subsystem 1: Vizconde & Manuel
│   │   ├── marketplace/       # 📁 Subsystem 2: Luarca & Ojeda
│   │   ├── orders/            # 📁 Subsystem 3: Reyes & Ponce
│   │   └── admin/             # 📁 Subsystem 4: Guades & Castro
│   ├── utils/
│   │   ├── AppError.ts
│   │   └── asyncHandler.ts
│   └── server.ts              # Main entry point
├── .env.example
└── package.json

```

---

## Part 2: Complete Database Schema (`prisma/schema.prisma`)

This single file covers **every single requirement** in your SIA proposal across all 4 subsystems. Paste this into `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // Use Neon.tech or Supabase free tier so all 9 members can connect easily
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS (Strict states across all 4 Subsystems)
// ============================================================================

enum QcuMemberType {
  STUDENT
  FACULTY
  STAFF
}

enum UserRole {
  BUYER
  SELLER
  ADMIN
}

enum VerificationStatus {
  PENDING
  VERIFIED
  REJECTED
}

enum SellerType {
  STUDENT_ENTERPRISE      // BSE OJT Businesses
  RECOGNIZED_ORGANIZATION // QCU Student Orgs
  INDEPENDENT_SELLER      // Enrolled QCU Students selling on their own
}

enum DeliveryMethod {
  ROOM_TO_ROOM
  PICKUP
}

enum PaymentMethod {
  CASH
  GCASH_PAYMONGO
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  CANCELLED
}

enum OrderStatus {
  PENDING_PAYMENT
  PENDING_CONFIRMATION
  PREPARING
  READY_FOR_PICKUP
  OUT_FOR_DELIVERY
  COMPLETED
  CANCELLED
}

enum ComplaintStatus {
  OPEN
  UNDER_REVIEW
  RESOLVED
  DISMISSED
}

// ============================================================================
// SUBSYSTEM 1: USER VERIFICATION & AUTHENTICATION
// Assigned to: Vizconde & Manuel (Core WebAuthn by Dalupang)
// ============================================================================

model User {
  id                  String             @id @default(uuid())
  qcuIdNumber         String             @unique // e.g., "24-0001" (Account identifier)
  email               String             @unique
  fullName            String
  memberType          QcuMemberType      // Faculty/Staff can only be BUYER
  role                UserRole           @default(BUYER)

  // Verification & Identity Data (RA 10173 protected - viewable by Admin only)
  qcuIdPhotoUrl       String             // Submitted photo of QCU ID
  liveSelfieUrl       String             // Captured via browser camera API
  verificationStatus  VerificationStatus @default(PENDING)
  rejectionReason     String?
  verifiedByAdminId   String?
  verifiedAt          DateTime?

  // Fallback Auth (For devices without passkey support)
  passwordHash        String?
  otpCode             String?
  otpExpiresAt        DateTime?
  currentChallenge    String?            // Temporary challenge for WebAuthn registration/login

  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  // Relations across Subsystems
  passkeys            PasskeyCredential[]
  sellerProfile       SellerProfile?
  cart                Cart?
  buyerOrders         Order[]            @relation("BuyerOrders")
  sentMessages        OrderMessage[]
  complaintsFiled     Complaint[]        @relation("Complainant")
  auditLogs           AuditLog[]
}

model PasskeyCredential {
  id                  String   @id // Credential ID from WebAuthn (Base64URL)
  userId              String
  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  publicKey           Bytes    // Public key bytes
  counter             BigInt   @default(0)
  deviceType          String?  // "singleDevice" or "multiDevice"
  backedUp            Boolean  @default(false)
  transports          String[] // e.g., ["internal", "hybrid"]
  deviceName          String?  // e.g., "Chrome on Android"
  createdAt           DateTime @default(now())
  lastUsedAt          DateTime?
}

model SellerProfile {
  id                      String             @id @default(uuid())
  userId                  String             @unique
  user                    User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sellerType              SellerType

  // Verification Document URL (OJT Endorsement, Org Recognition, or Proof of Enrollment)
  supportingDocumentUrl   String
  verificationStatus      VerificationStatus @default(PENDING)
  rejectionReason         String?

  // PayMongo Sub-account Onboarding (Required for GCash; without it, Cash only)
  paymongoSubAccountId    String?            @unique
  isPaymongoVerified      Boolean            @default(false)

  createdAt               DateTime           @default(now())
  updatedAt               DateTime           @updatedAt

  store                   Store?
}

// ============================================================================
// SUBSYSTEM 2: MARKETPLACE & ENTERPRISE MANAGEMENT
// Assigned to: Luarca & Ojeda
// ============================================================================

model Store {
  id                  String             @id @default(uuid())
  sellerProfileId     String             @unique
  sellerProfile       SellerProfile      @relation(fields: [sellerProfileId], references: [id], onDelete: Cascade)
  name                String             @unique
  slug                String             @unique
  description         String
  logoUrl             String?
  bannerUrl           String?
  pickupLocation      String?            // Default campus pickup spot (e.g., "QCU Student Center Lobby")
  isOpen              Boolean            @default(true)
  approvalStatus      VerificationStatus @default(PENDING)

  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  products            Product[]
  orders              Order[]
}

model Category {
  id                  String    @id @default(uuid())
  name                String    @unique // e.g., "Food & Beverages", "Org Merchandise", "Academic Services"
  slug                String    @unique
  products            Product[]
}

model Product {
  id                  String             @id @default(uuid())
  storeId             String
  store               Store              @relation(fields: [storeId], references: [id], onDelete: Cascade)
  categoryId          String
  category            Category           @relation(fields: [categoryId], references: [id])

  name                String
  description         String
  price               Decimal            @db.Decimal(10, 2)
  stockQuantity       Int                @default(0)
  imageUrls           String[]
  isAvailable         Boolean            @default(true)

  // Subject to Administrator Approval before going live
  approvalStatus      VerificationStatus @default(PENDING)
  rejectionReason     String?

  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  cartItems           CartItem[]
  orderItems          OrderItem[]
}

// ============================================================================
// SUBSYSTEM 3: ORDER, PAYMENT & DELIVERY MANAGEMENT
// Assigned to: Reyes & Ponce (PayMongo Core by Dalupang)
// ============================================================================

model Cart {
  id                  String     @id @default(uuid())
  userId              String     @unique
  user                User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  items               CartItem[]
  updatedAt           DateTime   @updatedAt
}

model CartItem {
  id                  String   @id @default(uuid())
  cartId              String
  cart                Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  productId           String
  product             Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  quantity            Int      @default(1)

  @@unique([cartId, productId])
}

model Order {
  id                  String         @id @default(uuid())
  orderNumber         String         @unique // e.g., "BZQ-20261023-0001"
  buyerId             String
  buyer               User           @relation("BuyerOrders", fields: [buyerId], references: [id])
  storeId             String
  store               Store          @relation(fields: [storeId], references: [id])

  totalAmount         Decimal        @db.Decimal(10, 2)
  paymentMethod       PaymentMethod
  orderStatus         OrderStatus    @default(PENDING_CONFIRMATION)

  // Campus Delivery or Pickup Details
  deliveryMethod      DeliveryMethod
  campusBuilding      String?        // e.g., "Academic Building 1 (Belmonte)"
  campusRoomNumber    String?        // e.g., "Room 402"
  pickupInstructions  String?
  deliveryNotes       String?

  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  items               OrderItem[]
  payment             PaymentTransaction?
  messages            OrderMessage[]
  complaints          Complaint[]
}

model OrderItem {
  id                  String   @id @default(uuid())
  orderId             String
  order               Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId           String
  product             Product  @relation(fields: [productId], references: [id])
  productNameSnapshot String   // Snapshot in case seller renames product later
  unitPriceSnapshot   Decimal  @db.Decimal(10, 2)
  quantity            Int
  subtotal            Decimal  @db.Decimal(10, 2)
}

model PaymentTransaction {
  id                      String        @id @default(uuid())
  orderId                 String        @unique
  order                   Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  amount                  Decimal       @db.Decimal(10, 2)
  method                  PaymentMethod
  status                  PaymentStatus @default(PENDING)

  // PayMongo Specific Fields (Null if CASH)
  paymongoCheckoutId      String?       @unique
  paymongoPaymentIntentId String?       @unique
  sellerSubAccountId      String?       // Where the split payment was routed
  webhookPayload          Json?         // Raw PayMongo confirmation log for Admin monitoring
  paidAt                  DateTime?

  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt
}

model OrderMessage {
  id                  String   @id @default(uuid())
  orderId             String
  order               Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  senderId            String
  sender              User     @relation(fields: [senderId], references: [id])
  message             String
  createdAt           DateTime @default(now())
}

// ============================================================================
// SUBSYSTEM 4: PLATFORM MANAGEMENT & ANALYTICS
// Assigned to: Guades & Castro
// ============================================================================

model Complaint {
  id                  String          @id @default(uuid())
  complainantId       String
  complainant         User            @relation("Complainant", fields: [complainantId], references: [id])
  orderId             String?
  order               Order?          @relation(fields: [orderId], references: [id])
  subject             String
  description         String
  evidenceUrls        String[]
  status              ComplaintStatus @default(OPEN)
  adminResolutionNote String?
  resolvedByAdminId   String?
  resolvedAt          DateTime?

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
}

model AuditLog {
  id                  String   @id @default(uuid())
  actorId             String
  actor               User     @relation(fields: [actorId], references: [id])
  subsystem           String   // "AUTH", "MARKETPLACE", "ORDERS", "ADMIN"
  action              String   // e.g., "APPROVED_USER_ID", "APPROVED_PRODUCT", "DISPUTE_RESOLVED"
  targetId            String?  // ID of the User, Store, Product, or Order affected
  details             Json?
  ipAddress           String?
  createdAt           DateTime @default(now())
}

```

---

## Part 3: Core Utilities (Your Foundation Files)

Create these 4 small files first so your teammates never have to write repetitive `try/catch` blocks or custom validation logic.

### 1. `src/config/db.ts`

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

### 2. `src/utils/AppError.ts`

```typescript
export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
```

### 3. `src/utils/asyncHandler.ts`

```typescript
import { Request, Response, NextFunction } from "express";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

### 4. `src/middlewares/validate.middleware.ts`

```typescript
import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";

export const validate =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
```

---

## Part 4: The "Golden Template" Module (For Your Teammates to Copy)

To make sure **Vizconde, Manuel, Luarca, Ojeda, Reyes, Ponce, Guades, and Castro** write uniform, clean code, give them this 4-file pattern inside `src/modules/marketplace/` as an example.

Tell them:

- **Support Members (Manuel, Ojeda, Ponce, Castro):** Focus on `*.validation.ts` and basic CRUD functions in `*.service.ts` / `*.controller.ts`.
- **Notable Members (Vizconde, Luarca, Reyes, Guades):** Focus on complex multi-table transactions, state machines, and filtering inside `*.service.ts`.

### File 1: `src/modules/marketplace/marketplace.validation.ts`

```typescript
import { z } from "zod";

export const createProductSchema = z.object({
  body: z.object({
    storeId: z.string().uuid("Invalid store ID"),
    categoryId: z.string().uuid("Invalid category ID"),
    name: z.string().min(3, "Product name must be at least 3 characters"),
    description: z.string().min(10, "Description is too short"),
    price: z.number().positive("Price must be greater than 0"),
    stockQuantity: z.number().int().nonnegative("Stock cannot be negative"),
    imageUrls: z
      .array(z.string().url())
      .min(1, "At least 1 product image is required"),
  }),
});

export const getProductsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    sellerType: z
      .enum([
        "STUDENT_ENTERPRISE",
        "RECOGNIZED_ORGANIZATION",
        "INDEPENDENT_SELLER",
      ])
      .optional(),
  }),
});
```

### File 2: `src/modules/marketplace/marketplace.service.ts`

```typescript
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

export class MarketplaceService {
  // Example for Support Member (Ojeda): Create Product (Subject to Admin Approval)
  static async createProduct(data: {
    storeId: string;
    categoryId: string;
    name: string;
    description: string;
    price: number;
    stockQuantity: number;
    imageUrls: string[];
  }) {
    const store = await prisma.store.findUnique({
      where: { id: data.storeId },
    });

    if (!store || store.approvalStatus !== "VERIFIED") {
      throw new AppError(
        "Store does not exist or is not yet verified by an Admin.",
        403,
      );
    }

    // Products always start as PENDING until Subsystem 4 (Admin) approves them
    return await prisma.product.create({
      data: {
        ...data,
        approvalStatus: "PENDING",
      },
    });
  }

  // Example for Notable Member (Luarca): Dynamic Search & Multi-Parameter Filtering
  static async getActiveProducts(filters: {
    search?: string;
    categoryId?: string;
    sellerType?:
      | "STUDENT_ENTERPRISE"
      | "RECOGNIZED_ORGANIZATION"
      | "INDEPENDENT_SELLER";
  }) {
    return await prisma.product.findMany({
      where: {
        approvalStatus: "VERIFIED", // Only show admin-approved products
        isAvailable: true,
        stockQuantity: { gt: 0 },
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.search && {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }),
        ...(filters.sellerType && {
          store: {
            sellerProfile: {
              sellerType: filters.sellerType,
            },
          },
        }),
      },
      include: {
        category: { select: { name: true, slug: true } },
        store: {
          select: {
            name: true,
            slug: true,
            pickupLocation: true,
            sellerProfile: {
              select: { sellerType: true, isPaymongoVerified: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
```

### File 3: `src/modules/marketplace/marketplace.controller.ts`

```typescript
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { MarketplaceService } from "./marketplace.service";

export class MarketplaceController {
  static createProduct = asyncHandler(async (req: Request, res: Response) => {
    const product = await MarketplaceService.createProduct(req.body);
    res.status(201).json({
      success: true,
      message: "Product submitted and awaiting administrator approval.",
      data: product,
    });
  });

  static getProducts = asyncHandler(async (req: Request, res: Response) => {
    const products = await MarketplaceService.getActiveProducts(
      req.query as any,
    );
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  });
}
```

### File 4: `src/modules/marketplace/marketplace.routes.ts`

```typescript
import { Router } from "express";
import { MarketplaceController } from "./marketplace.controller";
import { validate } from "../../middlewares/validate.middleware";
import {
  createProductSchema,
  getProductsQuerySchema,
} from "./marketplace.validation";

const router = Router();

router.get(
  "/products",
  validate(getProductsQuerySchema),
  MarketplaceController.getProducts,
);
router.post(
  "/products",
  validate(createProductSchema),
  MarketplaceController.createProduct,
);

export default router;
```

---

## Part 5: Main Entry Point (`src/server.ts`)

This wires all 4 subsystems together cleanly so each pair only mounts their own router:

```typescript
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AppError } from "./utils/AppError";

// Subsystem Routers
// import authRoutes from './modules/auth/auth.routes';               // Subsystem 1 (Vizconde & Manuel)
import marketplaceRoutes from "./modules/marketplace/marketplace.routes"; // Subsystem 2 (Luarca & Ojeda)
// import orderRoutes from './modules/orders/orders.routes';          // Subsystem 3 (Reyes & Ponce)
// import adminRoutes from './modules/admin/admin.routes';            // Subsystem 4 (Guades & Castro)

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Mount the 4 Subsystems
// app.use('/api/v1/auth', authRoutes);
app.use("/api/v1/marketplace", marketplaceRoutes);
// app.use('/api/v1/orders', orderRoutes);
// app.use('/api/v1/admin', adminRoutes);

// Global Error Handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }
  console.error("[UNHANDLED ERROR]:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `🚀 BizzyQCU Supersystem API running on http://localhost:${PORT}`,
  );
});
```

---

## Next Step for You (Before Handing Off to the Team)

1. Create a free PostgreSQL database on **Neon.tech** or **Supabase**, paste the connection string into `.env` as `DATABASE_URL`, and run:

```bash
npx prisma migrate dev --name init_bizzyqcu_supersystem

```

2. Would you like me to write **your specific Lead files** next—specifically the **WebAuthn Passkey Helper (`@simplewebauthn/server`)** and the **PayMongo Split-Payment / Webhook Service**—so you can drop them straight into `src/config/` for Vizconde and Reyes to call?
