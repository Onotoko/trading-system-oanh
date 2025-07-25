import { OrderStatus } from "@prisma/client";

export function parseSymbol(symbol: string): [string, string] {
    const [base, quote] = symbol.split("/");
    if (!base || !quote) throw new Error("Invalid symbol format: expected BASE/QUOTE");
    return [base, quote];
}

export function toNumber(val: unknown): number {
    return typeof val === "number" ? val : Number(val) || 0;
}

export function isFinalStatus(status: OrderStatus): boolean {
    return status === OrderStatus.CANCELLED || status === OrderStatus.FILLED;
}
