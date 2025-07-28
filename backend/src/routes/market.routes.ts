import express from "express";
import { MarketController } from "@/controllers/market.controller";

const router = express.Router();

// Get all trading symbols
router.get("/symbols", MarketController.getSymbols);

// Get order book for a symbol
router.get("/orderbook/:symbol", MarketController.getOrderBook);

// Get recent trades for a symbol
router.get("/trades/:symbol", MarketController.getTrades);

// Get market statistics for a symbol
router.get("/stats/:symbol", MarketController.getStats);

export default router;