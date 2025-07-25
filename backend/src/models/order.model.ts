import { Prisma, Order, OrderStatus } from "@prisma/client";
import { prisma } from "@/config";
import { CreateOrderInput, UpdateFilledQuantityInput } from "@/types/order";

export const OrderModel = {
    create: (data: CreateOrderInput): Promise<Order> => {
        return prisma.order.create({ data });
    },

    cancel: (id: bigint): Promise<Order> => {
        return prisma.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED } });
    },

    findActiveBySymbol: (symbol: string): Promise<Order[]> => {
        return prisma.order.findMany({
            where: {
                symbol,
                status: { in: [OrderStatus.PENDING, OrderStatus.PARTIAL] },
            },
            orderBy: [{ price: "desc" }, { createdAt: "asc" }],
        });
    },

    updateFilled: ({ orderId, quantity }: UpdateFilledQuantityInput): Promise<Order> => {
        return prisma.order.update({
            where: { id: orderId },
            data: { filledQuantity: quantity },
        });
    },
};