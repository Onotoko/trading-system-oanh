import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const BalanceModel = {
    get(userId: bigint, asset: string) {
        return prisma.balance.findUnique({
            where: { userId_asset: { userId, asset } }
        });
    },

    increase(userId: bigint, asset: string, amount: number) {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: { available: { increment: amount } }
        });
    },

    decrease(userId: bigint, asset: string, amount: number) {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: { available: { decrement: amount } }
        });
    },

    lock(userId: bigint, asset: string, amount: number) {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: {
                available: { decrement: amount },
                locked: { increment: amount }
            }
        });
    },

    unlock(userId: bigint, asset: string, amount: number) {
        return prisma.balance.update({
            where: { userId_asset: { userId, asset } },
            data: {
                available: { increment: amount },
                locked: { decrement: amount }
            }
        });
    }
};
