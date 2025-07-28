import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface FeeTier {
    volume: number;
    makerFee: number;
    takerFee: number;
}

// TODO missing a model to store the fees
const feeTiers: FeeTier[] = [
    { volume: 0, makerFee: 0.0015, takerFee: 0.002 },
    { volume: 100_000, makerFee: 0.001, takerFee: 0.0015 },
    { volume: 1_000_000, makerFee: 0.0008, takerFee: 0.001 }
];

export class FeeEngineService {
    /**
     * Calculate fees for a trade
     */
    static async calculateFees({
        makerUserId,
        takerUserId,
        quantity,
        price
    }: {
        makerUserId: bigint;
        takerUserId: bigint;
        quantity: number;
        price: number;
    }): Promise<{
        makerFee: number;
        takerFee: number;
    }> {
        const volume = quantity * price;

        const [makerVolume, takerVolume] = await Promise.all([
            this.getUserVolume(makerUserId),
            this.getUserVolume(takerUserId)
        ]);

        const makerTier = this.getTier(makerVolume);
        const takerTier = this.getTier(takerVolume);

        return {
            makerFee: volume * makerTier.makerFee,
            takerFee: volume * takerTier.takerFee
        };
    }

    /**
     * Get user volume over last 30 days (or lifetime)
     */
    static async getUserVolume(userId: bigint): Promise<number> {
        const trades = await prisma.trade.findMany({
            where: {
                OR: [
                    { buyerUserId: userId },
                    { sellerUserId: userId }
                ],
                executedAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        });

        return trades.reduce((sum, t) => sum + Number(t.price) * Number(t.quantity), 0);
    }

    /**
     * Pick fee tier based on volume
     */
    static getTier(volume: number): FeeTier {
        return feeTiers
            .slice()
            .reverse()
            .find((tier) => volume >= tier.volume)!;
    }
}
