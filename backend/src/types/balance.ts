export interface BalanceUpdateInput {
    userId: bigint;
    asset: string;
    amount: number;
}

export interface BalanceLockInput {
    userId: bigint;
    asset: string;
    amount: number;
}
