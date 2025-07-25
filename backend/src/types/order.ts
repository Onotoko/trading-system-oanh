import { OrderSide, OrderType } from "@prisma/client";
import { Prisma } from "@prisma/client";

export interface CreateOrderInput {
    userId: bigint;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: Prisma.Decimal;
    price?: Prisma.Decimal;
}

export interface UpdateFilledQuantityInput {
    orderId: bigint;
    quantity: Prisma.Decimal;
}
