import { prisma } from "@/config";
import { Trade } from "@prisma/client";
import { CreateTradeInput } from "@/types/trade";

export const TradeModel = {
    create: (data: CreateTradeInput): Promise<Trade> => {
        return prisma.trade.create({ data });
    },

    findByOrder: (orderId: bigint): Promise<Trade[]> => {
        return prisma.trade.findMany({
            where: {
                OR: [
                    { buyerOrderId: orderId },
                    { sellerOrderId: orderId }
                ]
            }
        });
    },

    findByUser: (userId: bigint): Promise<Trade[]> => {
        return prisma.trade.findMany({
            where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
            orderBy: { executedAt: "desc" },
        });
    },
};