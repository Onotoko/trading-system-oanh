import { OrderSide, OrderType, OrderStatus } from "@prisma/client";

export interface CreateOrderInput {
    userId: bigint;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
}

export interface CancelOrderInput {
    orderId: bigint;
    userId: bigint;
}

export interface OrderValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}

export interface OrderBookEntry {
    price: number;
    quantity: number;
}
