import { env } from "../../config/env";
import { paymongoClient } from "../../config/paymongo";
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
}
