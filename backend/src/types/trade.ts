export interface CreateTradeInput {
    symbol: string;
    buyerOrderId: bigint;
    sellerOrderId: bigint;
    buyerUserId: bigint;
    sellerUserId: bigint;
    quantity: number;
    price: number;
    buyerFee: number;
    sellerFee: number;
}

export interface TradeSummary {
    symbol: string;
    lastPrice: number;
    volume24h: number;
}
