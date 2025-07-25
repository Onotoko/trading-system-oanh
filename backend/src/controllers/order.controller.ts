import { Request, Response } from "express";
import { OrderManagementService } from "@/services/order-management.service";

export const OrderController = {
    async create(req: Request, res: Response): Promise<Response> {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ error: "Unauthorized: missing user ID" });
            }

            const order = await OrderManagementService.createOrder({
                ...req.body,
                userId: req.user.id,
            });

            return res.status(201).json(order);
        } catch (err: any) {
            return res.status(400).json({ error: err.message });
        }
    },

    async cancel(req: Request, res: Response): Promise<Response> {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ error: "Unauthorized: missing user ID" });
            }

            const orderIdParam = req.params.id;
            if (!orderIdParam) {
                return res.status(400).json({ error: "Missing order ID" });
            }

            const orderId = BigInt(orderIdParam);
            const userId = req.user.id;

            const result = await OrderManagementService.cancelOrder(userId, orderId);
            return res.json(result);
        } catch (err: any) {
            return res.status(400).json({ error: err.message });
        }
    },

    async history(req: Request, res: Response): Promise<Response> {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ error: "Unauthorized: missing user ID" });
            }

            const result = await OrderManagementService.getOrderHistory(req.user.id);
            return res.json(result);
        } catch (err: any) {
            return res.status(400).json({ error: err.message });
        }
    }
};
