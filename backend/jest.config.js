module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
        'src/services/**/*.ts',
        '!src/services/**/*.d.ts',
    ],
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};