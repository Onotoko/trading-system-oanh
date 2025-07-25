import { PrismaClient, RiskEventSeverity, RiskEventType } from "@prisma/client";
const prisma = new PrismaClient();

export const RiskEventModel = {
    create(data: {
        userId: bigint;
        eventType: RiskEventType;
        severity: RiskEventSeverity;
        description?: string;
        metadata?: any;
    }) {
        return prisma.riskEvent.create({ data });
    },

    getRecentUnresolved(userId: bigint, limit = 10) {
        return prisma.riskEvent.findMany({
            where: { userId, resolved: false },
            orderBy: { createdAt: "desc" },
            take: limit
        });
    },

    resolve(id: bigint) {
        return prisma.riskEvent.update({
            where: { id },
            data: { resolved: true }
        });
    }
};
