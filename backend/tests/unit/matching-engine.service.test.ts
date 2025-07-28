import { MatchingEngineService } from '../../src/services/matching-engine.service';
import { WebhookService } from '../../src/services/webhook.service';
import { FeeEngineService } from '../../src/services/fee-engine.service';
import { prismaMock } from '../setup';

jest.mock('@/services/webhook.service');
jest.mock('@/services/fee-engine.service');

describe('MatchingEngineService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('matchOrder', () => {
        it('should match buy order with sell order', async () => {
            const orderId = BigInt(1);
            const taker = {
                id: BigInt(1),
                userId: BigInt(1),
                symbol: 'BTCUSDT',
                side: 'BUY',
                type: 'LIMIT',
                quantity: 1,
                filledQuantity: 0,
                price: 50000,
                status: 'PENDING'
            };

            const maker = {
                id: BigInt(2),
                userId: BigInt(2),
                symbol: 'BTCUSDT',
                side: 'SELL',
                type: 'LIMIT',
                quantity: 1,
                filledQuantity: 0,
                price: 49000,
                status: 'PENDING'
            };

            // Mock transaction
            prismaMock.$transaction.mockImplementation(async (callback: any) => {
                const mockTx = {
                    order: {
                        findUnique: jest.fn().mockResolvedValue(taker),
                        findMany: jest.fn().mockResolvedValue([maker]),
                        update: jest.fn().mockResolvedValue({})
                    },
                    trade: {
                        create: jest.fn().mockResolvedValue({
                            id: BigInt(1),
                            symbol: 'BTCUSDT',
                            price: 49000,
                            quantity: 1,
                            buyerOrderId: BigInt(1),
                            sellerOrderId: BigInt(2)
                        })
                    },
                    balance: {
                        update: jest.fn().mockResolvedValue({})
                    }
                };
                return callback(mockTx);
            });

            // Mock fee calculation
            (FeeEngineService.calculateFees as jest.Mock).mockResolvedValue({
                makerFee: 25,
                takerFee: 50
            });

            await MatchingEngineService.matchOrder(orderId);

            expect(prismaMock.$transaction).toHaveBeenCalled();
            expect(FeeEngineService.calculateFees).toHaveBeenCalled();
            expect(WebhookService.publishOrderBookUpdate).toHaveBeenCalledWith('BTCUSDT');
        });

        it('should not match when taker order is not pending', async () => {
            const orderId = BigInt(1);

            prismaMock.$transaction.mockImplementation(async (callback: any) => {
                const mockTx = {
                    order: {
                        findUnique: jest.fn().mockResolvedValue({
                            status: 'FILLED'
                        })
                    }
                };
                return callback(mockTx);
            });

            await MatchingEngineService.matchOrder(orderId);

            expect(FeeEngineService.calculateFees).not.toHaveBeenCalled();
        });

        it('should not match when price conditions are not met', async () => {
            const orderId = BigInt(1);
            const taker = {
                id: BigInt(1),
                userId: BigInt(1),
                symbol: 'BTCUSDT',
                side: 'BUY',
                type: 'LIMIT',
                quantity: 1,
                filledQuantity: 0,
                price: 40000, // Lower than maker price
                status: 'PENDING'
            };

            const maker = {
                id: BigInt(2),
                userId: BigInt(2),
                symbol: 'BTCUSDT',
                side: 'SELL',
                type: 'LIMIT',
                quantity: 1,
                filledQuantity: 0,
                price: 50000, // Higher than taker willing to pay
                status: 'PENDING'
            };

            prismaMock.$transaction.mockImplementation(async (callback: any) => {
                const mockTx = {
                    order: {
                        findUnique: jest.fn().mockResolvedValue(taker),
                        findMany: jest.fn().mockResolvedValue([maker]),
                        update: jest.fn().mockResolvedValue({})
                    }
                };
                return callback(mockTx);
            });

            await MatchingEngineService.matchOrder(orderId);

            expect(FeeEngineService.calculateFees).not.toHaveBeenCalled();
        });
    });

    describe('getOrderBook', () => {
        it('should return aggregated order book', async () => {
            const symbol = 'BTCUSDT';
            const bids = [
                { price: 50000, quantity: 1, filledQuantity: 0 },
                { price: 50000, quantity: 0.5, filledQuantity: 0 },
                { price: 49000, quantity: 2, filledQuantity: 0 }
            ];
            const asks = [
                { price: 51000, quantity: 1, filledQuantity: 0 },
                { price: 52000, quantity: 1.5, filledQuantity: 0 }
            ];

            prismaMock.order.findMany
                .mockResolvedValueOnce(bids as any)
                .mockResolvedValueOnce(asks as any);

            const orderBook = await MatchingEngineService.getOrderBook(symbol);

            expect(orderBook).toEqual({
                symbol,
                bids: [
                    { price: 50000, quantity: 1.5, orders: 2 },
                    { price: 49000, quantity: 2, orders: 1 }
                ],
                asks: [
                    { price: 51000, quantity: 1, orders: 1 },
                    { price: 52000, quantity: 1.5, orders: 1 }
                ],
                lastUpdate: expect.any(Date)
            });
        });
    });
});
