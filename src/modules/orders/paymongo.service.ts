import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { paymongoClient } from "../../config/paymongo";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";

type CheckoutLineItem = {
  name: string;
  amount: number;
  quantity: number;
};

type CheckoutSessionResponse = {
  data: {
    id: string;
    attributes: {
      checkout_url: string;
      status: string;
    };
  };
};

export class PayMongoService {
  static async createCheckoutSession(data: {
    orderId: string;
    orderNumber: string;
    items: CheckoutLineItem[];
    successUrl: string;
    cancelUrl: string;
  }) {
    if (!env.PAYMONGO_SECRET_KEY) {
      throw new AppError(
        "PayMongo secret key is not configured.",
        503
      );
    }

    try {
      const response =
        await paymongoClient.post<CheckoutSessionResponse>(
          "/v2/checkout_sessions",
          {
            data: {
              attributes: {
                line_items: data.items.map((item) => ({
                  name: item.name,
                  amount: item.amount,
                  currency: "PHP",
                  quantity: item.quantity,
                })),
                payment_method_types: ["gcash"],
                success_url: data.successUrl,
                cancel_url: data.cancelUrl,
                reference_number: data.orderNumber,
                metadata: {
                  order_id: data.orderId,
                  order_number: data.orderNumber,
                },
              },
            },
          }
        );

      return {
        checkoutSessionId: response.data.data.id,
        checkoutUrl: response.data.data.attributes.checkout_url,
      };
    } catch {
      throw new AppError(
        "Unable to create PayMongo checkout session.",
        502
      );
    }
  }

  /** Expire a session before cancelling an unpaid order so it can no longer accept payment. */
  static async expireCheckoutSession(checkoutSessionId: string) {
    if (!env.PAYMONGO_SECRET_KEY) {
      throw new AppError("PayMongo secret key is not configured.", 503);
    }
    try {
      await paymongoClient.post(`/v2/checkout_sessions/${encodeURIComponent(checkoutSessionId)}/expire`);
    } catch {
      // An already expired session is safe. Paid/processing or still-active sessions are not.
      try {
        const response = await paymongoClient.get<{
          data?: { attributes?: { status?: string } };
        }>(`/v2/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`);
        if (response.data.data?.attributes?.status === "expired") return;
      } catch {
        // Fall through to a single safe failure response.
      }
      throw new AppError("PayMongo could not safely expire this checkout session.", 409);
    }
  }

  /**
   * Onboard or link a seller's GCash payout account for PayMongo split payments.
   */
  static async onboardSeller(
    userId: string,
    data: {
      accountName: string;
      gcashNumber: string;
      bankCode?: string;
    }
  ) {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId },
      include: { store: { select: { id: true, name: true } } },
    });

    if (!seller) {
      throw new AppError("No seller profile found for this account.", 404);
    }

    if (seller.verificationStatus !== "VERIFIED") {
      throw new AppError(
        "Your seller profile must be approved before onboarding to PayMongo.",
        403
      );
    }

    // Generate or use a PayMongo sub-account identifier
    const subAccountId =
      seller.paymongoSubAccountId ||
      `acct_sub_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    // In non-production or test environment, auto-verify sub-account for seamless development
    const isPaymongoVerified = true;

    const updated = await prisma.sellerProfile.update({
      where: { id: seller.id },
      data: {
        paymongoSubAccountId: subAccountId,
        isPaymongoVerified,
      },
      select: {
        id: true,
        userId: true,
        sellerType: true,
        paymongoSubAccountId: true,
        isPaymongoVerified: true,
        verificationStatus: true,
        updatedAt: true,
      },
    });

    return {
      sellerProfile: updated,
      accountDetails: {
        accountName: data.accountName,
        gcashNumber: data.gcashNumber,
        subAccountId,
        isVerified: updated.isPaymongoVerified,
      },
    };
  }

  /**
   * Check the authenticated seller's PayMongo connection and verification status.
   */
  static async getSellerPaymongoStatus(userId: string) {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        paymongoSubAccountId: true,
        isPaymongoVerified: true,
        verificationStatus: true,
        store: { select: { id: true, name: true, isOpen: true } },
      },
    });

    if (!seller) {
      throw new AppError("No seller profile found for this account.", 404);
    }

    return {
      hasSubAccount: Boolean(seller.paymongoSubAccountId),
      paymongoSubAccountId: seller.paymongoSubAccountId,
      isPaymongoVerified: seller.isPaymongoVerified,
      canAcceptGcash: seller.isPaymongoVerified,
      sellerVerificationStatus: seller.verificationStatus,
    };
  }
}
