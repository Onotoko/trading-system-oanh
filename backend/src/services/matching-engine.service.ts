import { PrismaClient } from "@prisma/client";
import { parseSymbol, toNumber } from "@/utils/common";
import { WebhookService } from "@/services/webhook.service";
import { FeeEngineService } from "@/services/fee-engine.service";
import { OrderBook, OrderBookLevel } from "@/types/order";
import { io } from "@/socket";

const prisma = new PrismaClient();

export class MatchingEngineService {
    static async matchOrder(orderId: bigint) {
        await prisma.$transaction(async (tx) => {
            const taker = await tx.order.findUnique({ where: { id: orderId } });
            if (!taker || taker.status !== "PENDING") return;

            const [baseAsset, quoteAsset] = parseSymbol(taker.symbol);
            const oppositeSide = taker.side === "BUY" ? "SELL" : "BUY";

            // Get matching orders (makers)
            const makers = await tx.order.findMany({
                where: {
                    symbol: taker.symbol,
                    side: oppositeSide,
                    status: { in: ["PENDING", "PARTIAL"] }
                },
                orderBy: [
                    { price: taker.side === "BUY" ? "asc" : "desc" },
                    { createdAt: "asc" }
                ]
            });

            let remaining = toNumber(taker.quantity) - toNumber(taker.filledQuantity);
            const trades = [];

            for (const maker of makers) {
                if (remaining <= 0) break;

                // Price matching logic
                if (taker.type === "LIMIT") {
                    const takerPrice = toNumber(taker.price);
                    const makerPrice = toNumber(maker.price);
                    if (
                        (taker.side === "BUY" && makerPrice > takerPrice) ||
                        (taker.side === "SELL" && makerPrice < takerPrice)
                    ) {
                        continue;
                    }
                }

                const makerRemaining = toNumber(maker.quantity) - toNumber(maker.filledQuantity);
                const fillQty = Math.min(remaining, makerRemaining);
                const price = toNumber(maker.price ?? taker.price);

                const buyer = taker.side === "BUY" ? taker : maker;
                const seller = taker.side === "SELL" ? taker : maker;

                // Calculate fees
                const fees = await FeeEngineService.calculateFees({
                    makerUserId: maker.userId,
                    takerUserId: taker.userId,
                    quantity: fillQty,
                    price
                });

                // Create trade record
                const trade = await tx.trade.create({
                    data: {
                        symbol: taker.symbol,
                        buyerOrderId: buyer.id,
                        sellerOrderId: seller.id,
                        buyerUserId: buyer.userId,
                        sellerUserId: seller.userId,
                        quantity: fillQty,
                        price,
                        buyerFee: fees.takerFee,
                        sellerFee: fees.makerFee
                    }
                });

                trades.push(trade);

                // Update balances
                const amountBase = fillQty;
                const amountQuote = fillQty * price;

                // BUYER: Release locked quote asset, add base asset
                await tx.balance.update({
                    where: { userId_asset: { userId: buyer.userId, asset: quoteAsset } },
                    data: {
                        locked: { decrement: amountQuote + (buyer.id === taker.id ? fees.takerFee : fees.makerFee) }
                    }
                });

                await tx.balance.update({
                    where: { userId_asset: { userId: buyer.userId, asset: baseAsset } },
                    data: {
                        available: { increment: amountBase }
                    }
                });

                // SELLER: Release locked base asset, add quote asset (minus fees)
                await tx.balance.update({
                    where: { userId_asset: { userId: seller.userId, asset: baseAsset } },
                    data: {
                        locked: { decrement: amountBase }
                    }
                });

                await tx.balance.update({
                    where: { userId_asset: { userId: seller.userId, asset: quoteAsset } },
                    data: {
                        available: { increment: amountQuote - (seller.id === taker.id ? fees.takerFee : fees.makerFee) }
                    }
                });

                // Update order filled quantities
                await tx.order.update({
                    where: { id: maker.id },
                    data: {
                        filledQuantity: { increment: fillQty },
                        status: makerRemaining <= fillQty ? "FILLED" : "PARTIAL"
                    }
                });

                await tx.order.update({
                    where: { id: taker.id },
                    data: {
                        filledQuantity: { increment: fillQty }
                    }
                });

                remaining -= fillQty;
            }

            // Update final taker status
            const totalFilled = toNumber(taker.filledQuantity) + (toNumber(taker.quantity) - remaining);
            await tx.order.update({
                where: { id: taker.id },
                data: {
                    status: totalFilled >= toNumber(taker.quantity)
                        ? "FILLED"
                        : totalFilled > 0
                            ? "PARTIAL"
                            : "PENDING"
                }
            });

            // Emit real-time updates
            for (const trade of trades) {
                await this.emitTradeUpdate(trade);
            }

            await this.emitOrderBookUpdate(taker.symbol);
            await WebhookService.publishOrderBookUpdate(taker.symbol);
        });
    }

    static async getOrderBook(symbol: string): Promise<OrderBook> {
        const [bids, asks] = await Promise.all([
            prisma.order.findMany({
                where: {
                    symbol,
                    side: "BUY",
                    status: { in: ["PENDING", "PARTIAL"] }
                },
                orderBy: { price: "desc" }
            }),
            prisma.order.findMany({
                where: {
                    symbol,
                    side: "SELL",
                    status: { in: ["PENDING", "PARTIAL"] }
                },
                orderBy: { price: "asc" }
            })
        ]);

        const aggregateLevels = (orders: any[]): OrderBookLevel[] => {
            const levels = new Map<number, { quantity: number; orders: number }>();

            orders.forEach(order => {
                const price = toNumber(order.price);
                const remaining = toNumber(order.quantity) - toNumber(order.filledQuantity);

                if (levels.has(price)) {
                    const level = levels.get(price)!;
                    level.quantity += remaining;
                    level.orders += 1;
                } else {
                    levels.set(price, { quantity: remaining, orders: 1 });
                }
            });

            return Array.from(levels.entries())
                .map(([price, data]) => ({
                    price,
                    quantity: data.quantity,
                    orders: data.orders
                }))
                .slice(0, 20); // Top 20 levels
        };

        return {
            symbol,
            bids: aggregateLevels(bids),
            asks: aggregateLevels(asks),
            lastUpdate: new Date()
        };
    }

    private static async emitTradeUpdate(trade: any) {
        io.emit(`trade:${trade.symbol}`, {
            symbol: trade.symbol,
            price: toNumber(trade.price),
            quantity: toNumber(trade.quantity),
            timestamp: new Date(),
            side: trade.buyerOrderId ? "BUY" : "SELL"
        });
    }

    private static async emitOrderBookUpdate(symbol: string) {
        const orderBook = await this.getOrderBook(symbol);
        io.emit(`orderbook:${symbol}`, orderBook);
    }
}