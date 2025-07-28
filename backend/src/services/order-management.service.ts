import { OrderSide, OrderType } from "@prisma/client";
import { OrderModel } from "@/models/order.model";
import { BalanceModel } from "@/models/balance.model";
import { RiskEventModel } from "@/models/riskEvent.model";
import { RiskManagementService } from "@/services/risk-management.service";
import { MatchingEngineService } from "@/services/matching-engine.service";
import { CreateOrderInput, OrderValidationResult } from "@/types/order";
import { RiskEventType, RiskEventSeverity } from "@prisma/client";
import { parseSymbol, toNumber, isFinalStatus } from "@/utils/common";

export class OrderManagementService {
    static async createOrder(input: CreateOrderInput) {
        // Pre-validation and risk checks
        const validation = await this.validateOrder(input);
        if (!validation.isValid) {
            throw new Error("Order validation failed: " + validation.errors.join(", "));
        }

        // Risk management checks
        await RiskManagementService.checkOrderFrequency(input.userId);

        if (input.type === OrderType.LIMIT && input.price) {
            await RiskManagementService.checkPriceManipulation(
                input.userId,
                input.symbol,
                input.price
            );
        }

        const [baseAsset, quoteAsset] = parseSymbol(input.symbol);
        const quantity = toNumber(input.quantity);

        // Lock funds based on order side
        if (input.side === OrderSide.BUY) {
            const cost = input.type === OrderType.MARKET
                ? quantity * 1000000 // Set high price for market orders
                : toNumber(input.price) * quantity;
            await BalanceModel.lock(input.userId, quoteAsset, cost);
        } else {
            await BalanceModel.lock(input.userId, baseAsset, quantity);
        }

        // Create order
        const order = await OrderModel.create({
            userId: input.userId,
            symbol: input.symbol,
            side: input.side,
            type: input.type,
            quantity,
            price: input.price
        });

        // Trigger matching engine
        await MatchingEngineService.matchOrder(order.id);

        return order;
    }

    static async cancelOrder(userId: bigint, orderId: bigint) {
        const order = await OrderModel.findById(orderId);
        if (!order) throw new Error("Order not found");
        if (order.userId !== userId) throw new Error("Permission denied");

        if (isFinalStatus(order.status)) {
            throw new Error("Cannot cancel a closed order");
        }

        const [baseAsset, quoteAsset] = parseSymbol(order.symbol);
        const remainingQty = toNumber(order.quantity) - toNumber(order.filledQuantity);

        // Unlock remaining funds
        if (order.side === OrderSide.BUY) {
            const remainingCost = toNumber(order.price) * remainingQty;
            await BalanceModel.unlock(userId, quoteAsset, remainingCost);
        } else {
            await BalanceModel.unlock(userId, baseAsset, remainingQty);
        }

        // Log risk event
        await RiskEventModel.create({
            userId,
            eventType: RiskEventType.TRADE,
            severity: RiskEventSeverity.LOW,
            description: `User cancelled order ${orderId}`
        });

        return OrderModel.cancel(orderId);
    }

    static async getOrderHistory(userId: bigint, limit = 50) {
        return OrderModel.findByUser(userId, limit);
    }

    static async validateOrder(input: CreateOrderInput): Promise<OrderValidationResult> {
        const [baseAsset, quoteAsset] = parseSymbol(input.symbol);
        const errors: string[] = [];

        // Basic validation
        if (input.quantity <= 0) {
            errors.push("Quantity must be greater than 0");
        }

        if (input.type === OrderType.LIMIT && (!input.price || input.price <= 0)) {
            errors.push("Price must be greater than 0 for limit orders");
        }

        // Balance validation
        if (input.side === OrderSide.BUY) {
            const cost = input.type === OrderType.MARKET
                ? toNumber(input.quantity) * 1000000 // Conservative estimate for market orders
                : toNumber(input.price) * toNumber(input.quantity);

            const balance = await BalanceModel.get(input.userId, quoteAsset);
            if (!balance || toNumber(balance.available) < cost) {
                errors.push("Insufficient balance for BUY order");
                await this.logRisk(input.userId, "Not enough quote asset");
            }
        }

        if (input.side === OrderSide.SELL) {
            const balance = await BalanceModel.get(input.userId, baseAsset);
            if (!balance || toNumber(balance.available) < toNumber(input.quantity)) {
                errors.push("Insufficient balance for SELL order");
                await this.logRisk(input.userId, "Not enough base asset");
            }
        }

        return { isValid: errors.length === 0, errors };
    }

    private static async logRisk(userId: bigint, description: string) {
        await RiskEventModel.create({
            userId,
            eventType: RiskEventType.INSUFFICIENT_FUNDS,
            severity: RiskEventSeverity.MEDIUM,
            description
        });
    }
}