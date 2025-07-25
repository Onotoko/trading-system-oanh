import { prisma } from "@/config";
import { BalanceActionInput } from "@/types/balance";

export const BalanceModel = {
    get: (userId: bigint, asset: string) => {
        return prisma.balance.findUnique({ where: { userId_asset: { userId, asset } } });
    },

    increase: ({ userId, asset, amount }: BalanceActionInput) => {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: { available: { increment: amount } },
        });
    },

    decrease: ({ userId, asset, amount }: BalanceActionInput) => {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: { available: { decrement: amount } },
        });
    },

    lock: ({ userId, asset, amount }: BalanceActionInput) => {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: {
                available: { decrement: amount },
                locked: { increment: amount },
            },
        });
    },

    unlock: ({ userId, asset, amount }: BalanceActionInput) => {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: {
                available: { increment: amount },
                locked: { decrement: amount },
            },
        });
    },
};