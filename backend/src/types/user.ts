import { KycStatus } from "@prisma/client";

export interface CreateUserInput {
    email: string;
    username?: string;
    passwordHash: string;
}

export interface UpdateKycStatusInput {
    userId: bigint;
    status: KycStatus;
}

export interface UpdateFeeTierInput {
    userId: bigint;
    tier: number;
}
