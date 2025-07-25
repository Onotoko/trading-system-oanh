import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

export const TradeModel = {
    create(data: {
        symbol: string;
        buyerOrderId: bigint;
        sellerOrderId: bigint;
        buyerUserId: bigint;
        sellerUserId: bigint;
        quantity: number;
        price: number;
        buyerFee: number;
        sellerFee: number;
    }) {
        return prisma.trade.create({
            data: {
                symbol: data.symbol,
                buyerOrderId: data.buyerOrderId,
                sellerOrderId: data.sellerOrderId,
                buyerUserId: data.buyerUserId,
                sellerUserId: data.sellerUserId,
                quantity: new Prisma.Decimal(data.quantity),
                price: new Prisma.Decimal(data.price),
                buyerFee: new Prisma.Decimal(data.buyerFee),
                sellerFee: new Prisma.Decimal(data.sellerFee)
            }
        });
    },
    getBySymbol(symbol: string, limit = 100) {
        return prisma.trade.findMany({
            where: { symbol },
            orderBy: { executedAt: "desc" },
            take: limit
        });
    }
};
