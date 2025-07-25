import { Prisma } from "@prisma/client";

export interface CreateTradeInput {
    symbol: string;
    buyerOrderId: bigint;
    sellerOrderId: bigint;
    buyerUserId: bigint;
    sellerUserId: bigint;
    quantity: Prisma.Decimal;
    price: Prisma.Decimal;
    buyerFee: Prisma.Decimal;
    sellerFee: Prisma.Decimal;
}
