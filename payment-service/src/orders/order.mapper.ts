import type { DiscountOrder, Order, PaymentAttempt } from '@prisma/client';
import { OrderStatus } from '@prisma/client';

export type OrderWithRelations = Order & {
  discountOrder: DiscountOrder | null;
  paymentAttempts: PaymentAttempt[];
};

function tillDateExpired(tillDate: Date | null): boolean {
  if (!tillDate) {
    return false;
  }
  const end = new Date(tillDate);
  end.setUTCHours(23, 59, 59, 999);
  return Date.now() > end.getTime();
}

export function effectiveOrderStatus(order: Order): OrderStatus {
  if (order.status === OrderStatus.paid || order.status === OrderStatus.canceled) {
    return order.status;
  }
  if (order.trashedAt) {
    return OrderStatus.canceled;
  }
  if (tillDateExpired(order.tillDate) && !order.paid) {
    return OrderStatus.expired;
  }
  return order.status;
}

export function toOrderDto(order: OrderWithRelations): Record<string, unknown> {
  const status = effectiveOrderStatus(order);
  return {
    id: order.id,
    userId: order.userId,
    title: order.title,
    price: order.priceMinor,
    currency: order.currency,
    paid: order.paid,
    status,
    productId: order.productId,
    data: order.data,
    tillDate: order.tillDate,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    discountCode: order.discountOrder?.discountTemplateCode ?? null,
    paymentChildren: order.paymentAttempts.map((p) => ({
      id: p.id,
      publicUuid: p.publicUuid,
      providerPaymentId: p.providerPaymentId,
      method: p.method,
      status: p.status,
      amountMinor: p.amountMinor,
      paidAt: p.paidAt,
    })),
  };
}
