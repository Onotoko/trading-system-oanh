import { FeeEngineService } from '../../src/services/fee-engine.service';
import { prismaMock } from '../setup';

describe('FeeEngineService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateFees', () => {
        it('should calculate fees correctly for low volume users', async () => {
            // Mock getUserVolume to return low volume
            jest.spyOn(FeeEngineService, 'getUserVolume')
                .mockResolvedValueOnce(1000) // maker volume
                .mockResolvedValueOnce(2000); // taker volume

            const result = await FeeEngineService.calculateFees({
                makerUserId: BigInt(1),
                takerUserId: BigInt(2),
                quantity: 100,
                price: 50
            });

            expect(result).toEqual({
                makerFee: 5000 * 0.0015, // volume * maker fee rate
                takerFee: 5000 * 0.002   // volume * taker fee rate
            });
        });

        it('should calculate fees correctly for high volume users', async () => {
            jest.spyOn(FeeEngineService, 'getUserVolume')
                .mockResolvedValueOnce(150000) // maker volume - tier 2
                .mockResolvedValueOnce(1500000); // taker volume - tier 3

            const result = await FeeEngineService.calculateFees({
                makerUserId: BigInt(1),
                takerUserId: BigInt(2),
                quantity: 100,
                price: 50
            });

            expect(result).toEqual({
                makerFee: 5000 * 0.001,  // tier 2 maker fee
                takerFee: 5000 * 0.001   // tier 3 taker fee
            });
        });
    });

    describe('getUserVolume', () => {
        it('should calculate user volume correctly', async () => {
            const userId = BigInt(1);
            const mockTrades = [
                { price: 100, quantity: 10 },
                { price: 50, quantity: 20 },
                { price: 75, quantity: 5 }
            ];

            prismaMock.trade.findMany.mockResolvedValue(mockTrades as any);

            const volume = await FeeEngineService.getUserVolume(userId);

            expect(volume).toBe(100 * 10 + 50 * 20 + 75 * 5); // 2375
            expect(prismaMock.trade.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [
                        { buyerUserId: userId },
                        { sellerUserId: userId }
                    ],
                    executedAt: {
                        gte: expect.any(Date)
                    }
                }
            });
        });
    });

    describe('getTier', () => {
        it('should return correct tier for different volumes', () => {
            expect(FeeEngineService.getTier(0)).toEqual({
                volume: 0,
                makerFee: 0.0015,
                takerFee: 0.002
            });

            expect(FeeEngineService.getTier(150000)).toEqual({
                volume: 100_000,
                makerFee: 0.001,
                takerFee: 0.0015
            });

            expect(FeeEngineService.getTier(2000000)).toEqual({
                volume: 1_000_000,
                makerFee: 0.0008,
                takerFee: 0.001
            });
        });
    });
});
