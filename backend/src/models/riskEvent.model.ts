import { prisma } from "@/config";
import { RiskEvent } from "@prisma/client";
import { LogRiskEventInput } from "@/types/riskEvent";

export const RiskEventModel = {
    log: (data: LogRiskEventInput): Promise<RiskEvent> => {
        return prisma.riskEvent.create({ data });
    },

    findByUser: (userId: bigint): Promise<RiskEvent[]> => {
        return prisma.riskEvent.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
    },
};