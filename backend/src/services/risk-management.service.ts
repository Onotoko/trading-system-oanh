import { RiskEventModel } from "@/models/riskEvent.model";
import { PrismaClient, RiskEventSeverity, RiskEventType } from "@prisma/client";

const prisma = new PrismaClient();

export class RiskManagementService {
    /**
     * Check if user exceeds position limit on given asset
     */
    static async checkPositionLimit(userId: bigint, asset: string, maxLimit: number) {
        const balance = await prisma.balance.findUnique({
            where: { userId_asset: { userId, asset } }
        });

        const total = Number(balance?.available || 0) + Number(balance?.locked || 0);

        if (total > maxLimit) {
            await RiskEventModel.create({
                userId,
                eventType: RiskEventType.INSUFFICIENT_FUNDS,
                severity: RiskEventSeverity.HIGH,
                description: `User exceeded position limit for ${asset}: ${total}/${maxLimit}`
            });

            throw new Error(`Position limit exceeded for ${asset}`);
        }
    }

    /**
     * Detect if user creates too many orders in short time
     */
    static async checkOrderFrequency(userId: bigint, windowSec = 60, maxOrders = 20) {
        const recentOrders = await prisma.order.findMany({
            where: {
                userId,
                createdAt: {
                    gte: new Date(Date.now() - windowSec * 1000)
                }
            }
        });

        if (recentOrders.length > maxOrders) {
            await RiskEventModel.create({
                userId,
                eventType: RiskEventType.SUSPICIOUS_ACTIVITY,
                severity: RiskEventSeverity.CRITICAL,
                description: `User placed ${recentOrders.length} orders in ${windowSec}s`
            });

            throw new Error("Too many orders in short time");
        }
    }

    /**
     * Detect price manipulation: very high/low deviation
     */
    static async checkPriceManipulation(userId: bigint, symbol: string, price: number) {
        const recentTrades = await prisma.trade.findMany({
            where: { symbol },
            orderBy: { executedAt: "desc" },
            take: 10
        });

        if (recentTrades.length === 0) return;

        const avgPrice =
            recentTrades.reduce((sum, t) => sum + Number(t.price), 0) / recentTrades.length;

        const deviation = Math.abs(price - avgPrice) / avgPrice;

        if (deviation > 0.2) {
            await RiskEventModel.create({
                userId,
                eventType: RiskEventType.SUSPICIOUS_ACTIVITY,
                severity: RiskEventSeverity.CRITICAL,
                description: `Suspicious price deviation: ${price} vs avg ${avgPrice}`
            });

            throw new Error("Price deviates too much from market average");
        }
    }
}
