import { RiskEventSeverity, RiskEventType, Prisma } from "@prisma/client";

export interface LogRiskEventInput {
    userId: bigint;
    eventType: RiskEventType;
    severity: RiskEventSeverity;
    description?: string;
    metadata?: Prisma.InputJsonValue;
}
