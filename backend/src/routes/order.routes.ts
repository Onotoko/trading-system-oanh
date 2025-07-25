import express from "express";
import { OrderController } from "@/controllers/order.controller";

const router = express.Router();

router.post("/orders", OrderController.create);
router.delete("/orders/:id", OrderController.cancel);
router.get("/orders/history", OrderController.history);

export default router;
