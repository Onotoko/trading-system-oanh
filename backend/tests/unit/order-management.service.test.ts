import { OrderManagementService } from '../../src/services/order-management.service';
import { OrderModel } from '../../src/models/order.model';
import { BalanceModel } from '../../src/models/balance.model';
import { RiskManagementService } from '../../src/services/risk-management.service';
import { MatchingEngineService } from '../../src/services/matching-engine.service';
import { OrderSide, OrderType } from '@prisma/client';

jest.mock('@/models/order.model');
jest.mock('@/models/balance.model');
jest.mock('@/services/risk-management.service');
jest.mock('@/services/matching-engine.service');

describe('OrderManagementService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createOrder', () => {
        const validOrderInput = {
            userId: BigInt(1),
            symbol: 'BTCUSDT',
            side: OrderSide.BUY,
            type: OrderType.LIMIT,
            quantity: 1,
            price: 50000
        };

        it('should create order successfully', async () => {
            const mockOrder = { id: BigInt(1), ...validOrderInput };

            // Mock validation
            jest.spyOn(OrderManagementService, 'validateOrder')
                .mockResolvedValue({ isValid: true, errors: [] });

            // Mock models
            (BalanceModel.lock as jest.Mock).mockResolvedValue(true);
            (OrderModel.create as jest.Mock).mockResolvedValue(mockOrder);
            (MatchingEngineService.matchOrder as jest.Mock).mockResolvedValue(undefined);

            const result = await OrderManagementService.createOrder(validOrderInput);

            expect(result).toEqual(mockOrder);
            expect(RiskManagementService.checkOrderFrequency).toHaveBeenCalledWith(validOrderInput.userId);
            expect(RiskManagementService.checkPriceManipulation).toHaveBeenCalledWith(
                validOrderInput.userId,
                validOrderInput.symbol,
                validOrderInput.price
            );
            expect(BalanceModel.lock).toHaveBeenCalledWith(
                validOrderInput.userId,
                'USDT',
                50000
            );
            expect(MatchingEngineService.matchOrder).toHaveBeenCalledWith(mockOrder.id);
        });

        it('should throw error when validation fails', async () => {
            jest.spyOn(OrderManagementService, 'validateOrder')
                .mockResolvedValue({
                    isValid: false,
                    errors: ['Insufficient balance']
                });

            await expect(
                OrderManagementService.createOrder(validOrderInput)
            ).rejects.toThrow('Order validation failed: Insufficient balance');

            expect(BalanceModel.lock).not.toHaveBeenCalled();
        });

        it('should handle sell orders correctly', async () => {
            const sellOrder = {
                ...validOrderInput,
                side: OrderSide.SELL
            };

            jest.spyOn(OrderManagementService, 'validateOrder')
                .mockResolvedValue({ isValid: true, errors: [] });

            (BalanceModel.lock as jest.Mock).mockResolvedValue(true);
            (OrderModel.create as jest.Mock).mockResolvedValue({ id: BigInt(1), ...sellOrder });

            await OrderManagementService.createOrder(sellOrder);

            expect(BalanceModel.lock).toHaveBeenCalledWith(
                sellOrder.userId,
                'BTC',
                1
            );
        });
    });

    describe('cancelOrder', () => {
        it('should cancel order successfully', async () => {
            const userId = BigInt(1);
            const orderId = BigInt(1);
            const mockOrder = {
                id: orderId,
                userId,
                symbol: 'BTCUSDT',
                side: OrderSide.BUY,
                status: 'PENDING',
                quantity: 1,
                filledQuantity: 0,
                price: 50000
            };

            (OrderModel.findById as jest.Mock).mockResolvedValue(mockOrder);
            (BalanceModel.unlock as jest.Mock).mockResolvedValue(true);
            (OrderModel.cancel as jest.Mock).mockResolvedValue({ ...mockOrder, status: 'CANCELLED' });

            const result = await OrderManagementService.cancelOrder(userId, orderId);

            expect(BalanceModel.unlock).toHaveBeenCalledWith(userId, 'USDT', 50000);
            expect(OrderModel.cancel).toHaveBeenCalledWith(orderId);
        });

        it('should throw error when order not found', async () => {
            (OrderModel.findById as jest.Mock).mockResolvedValue(null);

            await expect(
                OrderManagementService.cancelOrder(BigInt(1), BigInt(1))
            ).rejects.toThrow('Order not found');
        });

        it('should throw error when user does not own order', async () => {
            const mockOrder = {
                id: BigInt(1),
                userId: BigInt(2), // Different user
                status: 'PENDING'
            };

            (OrderModel.findById as jest.Mock).mockResolvedValue(mockOrder);

            await expect(
                OrderManagementService.cancelOrder(BigInt(1), BigInt(1))
            ).rejects.toThrow('Permission denied');
        });
    });

    describe('validateOrder', () => {
        it('should validate buy order successfully', async () => {
            const orderInput = {
                userId: BigInt(1),
                symbol: 'BTCUSDT',
                side: OrderSide.BUY,
                type: OrderType.LIMIT,
                quantity: 1,
                price: 50000
            };

            (BalanceModel.get as jest.Mock).mockResolvedValue({
                available: 60000,
                locked: 0
            });

            const result = await OrderManagementService.validateOrder(orderInput);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail validation for insufficient balance', async () => {
            const orderInput = {
                userId: BigInt(1),
                symbol: 'BTCUSDT',
                side: OrderSide.BUY,
                type: OrderType.LIMIT,
                quantity: 1,
                price: 50000
            };

            (BalanceModel.get as jest.Mock).mockResolvedValue({
                available: 30000, // Insufficient
                locked: 0
            });

            const result = await OrderManagementService.validateOrder(orderInput);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Insufficient balance for BUY order');
        });

        it('should fail validation for invalid quantity', async () => {
            const orderInput = {
                userId: BigInt(1),
                symbol: 'BTCUSDT',
                side: OrderSide.BUY,
                type: OrderType.LIMIT,
                quantity: 0,
                price: 50000
            };

            const result = await OrderManagementService.validateOrder(orderInput);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Quantity must be greater than 0');
        });

        it('should fail validation for limit order without price', async () => {
            const orderInput = {
                userId: BigInt(1),
                symbol: 'BTCUSDT',
                side: OrderSide.BUY,
                type: OrderType.LIMIT,
                quantity: 1,
                price: 0
            };

            const result = await OrderManagementService.validateOrder(orderInput);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Price must be greater than 0 for limit orders');
        });
    });
});
