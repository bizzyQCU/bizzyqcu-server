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
}