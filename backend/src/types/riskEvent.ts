import { RiskEventType, RiskEventSeverity } from "@prisma/client";

export interface CreateRiskEventInput {
    userId: bigint;
    eventType: RiskEventType;
    severity: RiskEventSeverity;
    description?: string;
    metadata?: any;
}
