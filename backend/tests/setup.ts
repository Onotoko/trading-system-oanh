import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

export const prismaMock = mockDeep<PrismaClient>();

jest.mock('@prisma/client', () => ({
    ...jest.requireActual('@prisma/client'),
    PrismaClient: jest.fn(() => prismaMock)
}));

jest.mock('@/socket', () => ({
    io: {
        emit: jest.fn(),
    }
}));

beforeEach(() => {
    mockReset(prismaMock);
});