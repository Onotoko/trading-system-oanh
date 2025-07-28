import { OrderSide, OrderType } from "@prisma/client";

export interface CreateOrderInput {
    userId: bigint;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
}

export interface OrderValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface OrderBookLevel {
    price: number;
    quantity: number;
    orders: number;
}

export interface OrderBook {
    symbol: string;
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
    lastUpdate: Date;
}

export interface TradeData {
    id: bigint;
    symbol: string;
    price: number;
    quantity: number;
    side: OrderSide;
    timestamp: Date;
    buyerUserId: bigint;
    sellerUserId: bigint;
}

export interface UserOrderHistory {
    id: bigint;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    filledQuantity: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface BalanceInfo {
    asset: string;
    available: number;
    locked: number;
    total: number;
}

export interface RiskEvent {
    id: bigint;
    userId: bigint;
    eventType: string;
    severity: string;
    description: string;
    resolved: boolean;
    createdAt: Date;
}