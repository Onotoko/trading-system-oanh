import { OrderManagementService } from '../../src/services/order-management.service';
import { MatchingEngineService } from '../../src/services/matching-engine.service';
import { FeeEngineService } from '../../src/services/fee-engine.service';
import { OrderSide, OrderType } from '@prisma/client';
import { prismaMock } from '../setup';

describe('Trading Flow Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should complete full trading flow from order creation to matching', async () => {
        // Setup initial data
        const buyer = { userId: BigInt(1), symbol: 'BTCUSDT' };
        const seller = { userId: BigInt(2), symbol: 'BTCUSDT' };

        // Mock balances
        prismaMock.balance.findUnique
            .mockResolvedValueOnce({ available: 60000, locked: 0 } as any) // Buyer USDT balance
            .mockResolvedValueOnce({ available: 2, locked: 0 } as any);    // Seller BTC balance

        // Mock order creation
        const buyOrder = {
            id: BigInt(1),
            userId: buyer.userId,
            symbol: 'BTCUSDT',
            side: OrderSide.BUY,
            type: OrderType.LIMIT,
            quantity: 1,
            price: 50000,
            filledQuantity: 0,
            status: 'PENDING'
        };

        const sellOrder = {
            id: BigInt(2),
            userId: seller.userId,
            symbol: 'BTCUSDT',
            side: OrderSide.SELL,
            type: OrderType.LIMIT,
            quantity: 1,
            price: 49000,
            filledQuantity: 0,
            status: 'PENDING'
        };

        // Mock transaction for matching
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                order: {
                    findUnique: jest.fn().mockResolvedValue(buyOrder),
                    findMany: jest.fn().mockResolvedValue([sellOrder]),
                    update: jest.fn().mockResolvedValue({})
                },
                trade: {
                    create: jest.fn().mockResolvedValue({
                        id: BigInt(1),
                        symbol: 'BTCUSDT',
                        price: 49000,
                        quantity: 1,
                        buyerOrderId: buyOrder.id,
                        sellerOrderId: sellOrder.id,
                        buyerUserId: buyer.userId,
                        sellerUserId: seller.userId
                    })
                },
                balance: {
                    update: jest.fn().mockResolvedValue({})
                }
            } as any;
            return callback(mockTx);
        });

        // Mock fee calculation
        jest.spyOn(FeeEngineService, 'calculateFees').mockResolvedValue({
            makerFee: 24.5,  // 49000 * 0.0005
            takerFee: 98     // 49000 * 0.002
        });

        // Mock risk management
        jest.spyOn(require('@/services/risk-management.service').RiskManagementService, 'checkOrderFrequency')
            .mockResolvedValue(undefined);
        jest.spyOn(require('@/services/risk-management.service').RiskManagementService, 'checkPriceManipulation')
            .mockResolvedValue(undefined);

        // Mock balance operations
        jest.spyOn(require('@/models/balance.model').BalanceModel, 'lock')
            .mockResolvedValue(true);
        jest.spyOn(require('@/models/balance.model').BalanceModel, 'get')
            .mockResolvedValue({ available: 60000, locked: 0 });

        // Mock order model
        jest.spyOn(require('@/models/order.model').OrderModel, 'create')
            .mockResolvedValue(buyOrder);

        // Execute the flow
        const createdOrder = await OrderManagementService.createOrder({
            userId: buyer.userId,
            symbol: 'BTCUSDT',
            side: OrderSide.BUY,
            type: OrderType.LIMIT,
            quantity: 1,
            price: 50000
        });

        // Verify order was created
        expect(createdOrder).toEqual(buyOrder);

        // Verify matching engine was called
        await MatchingEngineService.matchOrder(buyOrder.id);

        // Verify transaction was executed
        expect(prismaMock.$transaction).toHaveBeenCalled();
        expect(FeeEngineService.calculateFees).toHaveBeenCalledWith({
            makerUserId: seller.userId,
            takerUserId: buyer.userId,
            quantity: 1,
            price: 49000
        });
    });

    it('should handle partial fills correctly', async () => {
        const taker = {
            id: BigInt(1),
            userId: BigInt(1),
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: 2,        // Wants to buy 2 BTC
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
            quantity: 1,        // Only selling 1 BTC
            filledQuantity: 0,
            price: 49000,
            status: 'PENDING'
        };

        prismaMock.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                order: {
                    findUnique: jest.fn().mockResolvedValue(taker),
                    findMany: jest.fn().mockResolvedValue([maker]),
                    update: jest.fn()
                        .mockResolvedValueOnce({}) // maker update
                        .mockResolvedValueOnce({}) // taker update
                        .mockResolvedValueOnce({}) // final taker status update
                },
                trade: {
                    create: jest.fn().mockResolvedValue({
                        id: BigInt(1),
                        symbol: 'BTCUSDT',
                        price: 49000,
                        quantity: 1,
                        buyerOrderId: taker.id,
                        sellerOrderId: maker.id
                    })
                },
                balance: {
                    update: jest.fn().mockResolvedValue({})
                }
            } as any;
            return callback(mockTx);
        });

        jest.spyOn(FeeEngineService, 'calculateFees').mockResolvedValue({
            makerFee: 24.5,
            takerFee: 98
        });

        await MatchingEngineService.matchOrder(taker.id);

        // Verify that the transaction was called correctly
        expect(prismaMock.$transaction).toHaveBeenCalled();

        // Extract the transaction callback to test its behavior
        const transactionCallback = prismaMock.$transaction.mock.calls[0][0];

        // Create a proper mock transaction object with all required Prisma methods
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
                    quantity: 1
                })
            },
            balance: {
                update: jest.fn().mockResolvedValue({})
            }
        } as any;

        await transactionCallback(mockTx);

        expect(mockTx.order.update).toHaveBeenCalledWith({
            where: { id: maker.id },
            data: {
                filledQuantity: { increment: 1 },
                status: "FILLED" // maker fully filled
            }
        });
    });

    it('should handle multiple maker orders for large taker order', async () => {
        const taker = {
            id: BigInt(1),
            userId: BigInt(1),
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: 3,
            filledQuantity: 0,
            price: 50000,
            status: 'PENDING'
        };

        const makers = [
            {
                id: BigInt(2),
                userId: BigInt(2),
                symbol: 'BTCUSDT',
                side: 'SELL',
                quantity: 1,
                filledQuantity: 0,
                price: 49000,
                status: 'PENDING'
            },
            {
                id: BigInt(3),
                userId: BigInt(3),
                symbol: 'BTCUSDT',
                side: 'SELL',
                quantity: 2,
                filledQuantity: 0,
                price: 49500,
                status: 'PENDING'
            }
        ];

        prismaMock.$transaction.mockImplementation(async (callback: any) => {
            const mockTx = {
                order: {
                    findUnique: jest.fn().mockResolvedValue(taker),
                    findMany: jest.fn().mockResolvedValue(makers),
                    update: jest.fn().mockResolvedValue({})
                },
                trade: {
                    create: jest.fn()
                        .mockResolvedValueOnce({
                            id: BigInt(1),
                            symbol: 'BTCUSDT',
                            price: 49000,
                            quantity: 1,
                            buyerOrderId: taker.id,
                            sellerOrderId: BigInt(2)
                        })
                        .mockResolvedValueOnce({
                            id: BigInt(2),
                            symbol: 'BTCUSDT',
                            price: 49500,
                            quantity: 2,
                            buyerOrderId: taker.id,
                            sellerOrderId: BigInt(3)
                        })
                },
                balance: {
                    update: jest.fn().mockResolvedValue({})
                }
            } as any;
            return callback(mockTx);
        });

        jest.spyOn(FeeEngineService, 'calculateFees')
            .mockResolvedValueOnce({ makerFee: 24.5, takerFee: 98 })
            .mockResolvedValueOnce({ makerFee: 49.5, takerFee: 198 });

        await MatchingEngineService.matchOrder(taker.id);

        // Verify that 2 trades were created by checking transaction calls
        expect(prismaMock.$transaction).toHaveBeenCalled();

        // Extract and test the transaction callback
        const transactionCallback = prismaMock.$transaction.mock.calls[0][0];

        const mockTx = {
            order: {
                findUnique: jest.fn().mockResolvedValue(taker),
                findMany: jest.fn().mockResolvedValue(makers),
                update: jest.fn().mockResolvedValue({})
            },
            trade: {
                create: jest.fn()
                    .mockResolvedValueOnce({
                        id: BigInt(1),
                        symbol: 'BTCUSDT',
                        price: 49000,
                        quantity: 1,
                        buyerOrderId: taker.id,
                        sellerOrderId: BigInt(2)
                    })
                    .mockResolvedValueOnce({
                        id: BigInt(2),
                        symbol: 'BTCUSDT',
                        price: 49500,
                        quantity: 2,
                        buyerOrderId: taker.id,
                        sellerOrderId: BigInt(3)
                    })
            },
            balance: {
                update: jest.fn().mockResolvedValue({})
            }
        } as any;

        await transactionCallback(mockTx);

        expect(mockTx.trade.create).toHaveBeenCalledTimes(2);
        expect(FeeEngineService.calculateFees).toHaveBeenCalledTimes(2);
    });
});