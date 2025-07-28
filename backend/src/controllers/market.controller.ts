import { Request, Response } from "express";
import { MatchingEngineService } from "@/services/matching-engine.service";
import { TradeModel } from "@/models/trade.model";
import { prisma } from "@/config";

export const MarketController = {
    // Get order book for a symbol
    async getOrderBook(req: Request, res: Response): Promise<Response> {
        try {
            const { symbol } = req.params;

            if (!symbol) {
                return res.status(400).json({ error: "Symbol is required" });
            }

            const orderBook = await MatchingEngineService.getOrderBook(symbol);
            return res.json(orderBook);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Get recent trades for a symbol
    async getTrades(req: Request, res: Response): Promise<Response> {
        try {
            const { symbol } = req.params;
            const limit = parseInt(req.query.limit as string) || 50;

            if (!symbol) {
                return res.status(400).json({ error: "Symbol is required" });
            }

            const trades = await TradeModel.getBySymbol(symbol, limit);

            const formattedTrades = trades.map(trade => ({
                id: trade.id,
                symbol: trade.symbol,
                price: Number(trade.price),
                quantity: Number(trade.quantity),
                timestamp: trade.executedAt,
                buyerFee: Number(trade.buyerFee),
                sellerFee: Number(trade.sellerFee)
            }));

            return res.json(formattedTrades);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Get market statistics
    async getStats(req: Request, res: Response): Promise<Response> {
        try {
            const { symbol } = req.params;

            if (!symbol) {
                return res.status(400).json({ error: "Symbol is required" });
            }

            // Get 24h statistics
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const [recentTrades, volume24h] = await Promise.all([
                prisma.trade.findMany({
                    where: {
                        symbol,
                        executedAt: { gte: dayAgo }
                    },
                    orderBy: { executedAt: "desc" },
                    take: 1000
                }),
                prisma.trade.aggregate({
                    where: {
                        symbol,
                        executedAt: { gte: dayAgo }
                    },
                    _sum: {
                        quantity: true
                    }
                })
            ]);

            const prices = recentTrades.map(t => Number(t.price));
            const currentPrice = prices[0] || 0;
            const openPrice = prices[prices.length - 1] || currentPrice;
            const highPrice = Math.max(...prices) || currentPrice;
            const lowPrice = Math.min(...prices) || currentPrice;
            const change = currentPrice - openPrice;
            const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;

            return res.json({
                symbol,
                currentPrice,
                openPrice,
                highPrice,
                lowPrice,
                change,
                changePercent,
                volume24h: Number(volume24h._sum.quantity) || 0,
                trades24h: recentTrades.length,
                lastUpdate: new Date()
            });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Get all available trading pairs
    async getSymbols(req: Request, res: Response): Promise<Response> {
        try {
            const symbols = await prisma.trade.groupBy({
                by: ['symbol'],
                _count: {
                    symbol: true
                }
            });

            const symbolData = await Promise.all(
                symbols.map(async (s) => {
                    const lastTrade = await prisma.trade.findFirst({
                        where: { symbol: s.symbol },
                        orderBy: { executedAt: "desc" }
                    });

                    return {
                        symbol: s.symbol,
                        lastPrice: lastTrade ? Number(lastTrade.price) : 0,
                        trades: s._count.symbol
                    };
                })
            );

            return res.json(symbolData);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }
};