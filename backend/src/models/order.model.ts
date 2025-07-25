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
        return prisma.order.create({ data });
    },

    findByUser(userId: bigint) {
        return prisma.order.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" }
        });
    },

    findById(orderId: bigint) {
        return prisma.order.findUnique({ where: { id: orderId } });
    },
    cancel(orderId: bigint) {
        return prisma.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.CANCELLED }
        });
    },

    getMatchingOrders(symbol: string, side: OrderSide) {
        // Lấy order có trạng thái PENDING hoặc PARTIAL
        return prisma.order.findMany({
            where: {
                symbol,
                side,
                status: { in: [OrderStatus.PENDING, OrderStatus.PARTIAL] }
            },
            orderBy: [
                { price: side === "BUY" ? "desc" : "asc" },
                { createdAt: "asc" }
            ]
        });
    },

    updateFilledQuantity(orderId: bigint, quantity: number) {
        return prisma.order.update({
            where: { id: orderId },
            data: {
                filledQuantity: { increment: quantity }
            }
        });
    },

    updateStatus(orderId: bigint, status: OrderStatus) {
        return prisma.order.update({
            where: { id: orderId },
            data: { status }
        });
    }
};
