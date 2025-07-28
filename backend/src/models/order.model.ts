import { PrismaClient, OrderStatus, OrderSide, OrderType } from "@prisma/client";
const prisma = new PrismaClient();

export const OrderModel = {
    create(data: {
        userId: bigint;
        symbol: string;
        side: OrderSide;
        type: OrderType;
        quantity: number;
        price?: number;
    }) {
        return prisma.order.create({
            data: {
                ...data,
                filledQuantity: 0,
                status: OrderStatus.PENDING
            }
        });
    },

    findByUser(userId: bigint, limit = 50) {
        return prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit
        });
    },

    findById(orderId: bigint) {
        return prisma.order.findUnique({ where: { id: orderId } });
    },

    cancel(orderId: bigint) {
        return prisma.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.CANCELLED,
                updatedAt: new Date()
            }
        });
    },

    getMatchingOrders(symbol: string, side: OrderSide, limit = 100) {
        return prisma.order.findMany({
            where: {
                symbol,
                side,
                status: { in: [OrderStatus.PENDING, OrderStatus.PARTIAL] }
            },
            orderBy: [
                { price: side === "BUY" ? "desc" : "asc" },
                { createdAt: "asc" }
            ],
            take: limit
        });
    },

    updateFilledQuantity(orderId: bigint, quantity: number) {
        return prisma.order.update({
            where: { id: orderId },
            data: {
                filledQuantity: { increment: quantity },
                updatedAt: new Date()
            }
        });
    },

    updateStatus(orderId: bigint, status: OrderStatus) {
        return prisma.order.update({
            where: { id: orderId },
            data: {
                status,
                updatedAt: new Date()
            }
        });
    },

    // Get open orders for a user
    getOpenOrders(userId: bigint) {
        return prisma.order.findMany({
            where: {
                userId,
                status: { in: [OrderStatus.PENDING, OrderStatus.PARTIAL] }
            },
            orderBy: { createdAt: "desc" }
        });
    },

    // Get orders by symbol and status
    getOrdersBySymbolAndStatus(symbol: string, status: OrderStatus[]) {
        return prisma.order.findMany({
            where: {
                symbol,
                status: { in: status }
            },
            orderBy: [
                { price: "asc" },
                { createdAt: "asc" }
            ]
        });
    }
};