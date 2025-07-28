import { RiskManagementService } from '../../src/services/risk-management.service';
import { RiskEventModel } from '../../src/models/riskEvent.model';
import { prismaMock } from '../setup';

jest.mock('@/models/riskEvent.model');

describe('RiskManagementService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkPositionLimit', () => {
        it('should pass when position is within limit', async () => {
            const userId = BigInt(1);
            const asset = 'BTC';
            const maxLimit = 1000;

            prismaMock.balance.findUnique.mockResolvedValue({
                available: 300,
                locked: 200
            } as any);

            await expect(
                RiskManagementService.checkPositionLimit(userId, asset, maxLimit)
            ).resolves.not.toThrow();

            expect(RiskEventModel.create).not.toHaveBeenCalled();
        });

        it('should throw error when position exceeds limit', async () => {
            const userId = BigInt(1);
            const asset = 'BTC';
            const maxLimit = 1000;

            prismaMock.balance.findUnique.mockResolvedValue({
                available: 600,
                locked: 500
            } as any);

            await expect(
                RiskManagementService.checkPositionLimit(userId, asset, maxLimit)
            ).rejects.toThrow('Position limit exceeded for BTC');

            expect(RiskEventModel.create).toHaveBeenCalledWith({
                userId,
                eventType: 'INSUFFICIENT_FUNDS',
                severity: 'HIGH',
                description: `User exceeded position limit for ${asset}: 1100/${maxLimit}`
            });
        });
    });

    describe('checkOrderFrequency', () => {
        it('should pass when order frequency is normal', async () => {
            const userId = BigInt(1);

            prismaMock.order.findMany.mockResolvedValue(
                Array(10).fill({}) as any
            );

            await expect(
                RiskManagementService.checkOrderFrequency(userId)
            ).resolves.not.toThrow();
        });

        it('should throw error when too many orders', async () => {
            const userId = BigInt(1);

            prismaMock.order.findMany.mockResolvedValue(
                Array(25).fill({}) as any
            );

            await expect(
                RiskManagementService.checkOrderFrequency(userId)
            ).rejects.toThrow('Too many orders in short time');

            expect(RiskEventModel.create).toHaveBeenCalledWith({
                userId,
                eventType: 'SUSPICIOUS_ACTIVITY',
                severity: 'CRITICAL',
                description: 'User placed 25 orders in 60s'
            });
        });
    });

    describe('checkPriceManipulation', () => {
        it('should pass when price is within normal range', async () => {
            const userId = BigInt(1);
            const symbol = 'BTCUSDT';
            const price = 105;

            prismaMock.trade.findMany.mockResolvedValue([
                { price: 100 },
                { price: 102 },
                { price: 98 }
            ] as any);

            await expect(
                RiskManagementService.checkPriceManipulation(userId, symbol, price)
            ).resolves.not.toThrow();
        });

        it('should throw error when price deviates too much', async () => {
            const userId = BigInt(1);
            const symbol = 'BTCUSDT';
            const price = 150; // 50% deviation from 100

            prismaMock.trade.findMany.mockResolvedValue([
                { price: 100 },
                { price: 102 },
                { price: 98 }
            ] as any);

            await expect(
                RiskManagementService.checkPriceManipulation(userId, symbol, price)
            ).rejects.toThrow('Price deviates too much from market average');

            expect(RiskEventModel.create).toHaveBeenCalledWith({
                userId,
                eventType: 'SUSPICIOUS_ACTIVITY',
                severity: 'CRITICAL',
                description: 'Suspicious price deviation: 150 vs avg 100'
            });
        });

        it('should skip check when no recent trades exist', async () => {
            const userId = BigInt(1);
            const symbol = 'BTCUSDT';
            const price = 150;

            prismaMock.trade.findMany.mockResolvedValue([]);

            await expect(
                RiskManagementService.checkPriceManipulation(userId, symbol, price)
            ).resolves.not.toThrow();

            expect(RiskEventModel.create).not.toHaveBeenCalled();
        });
    });
});
