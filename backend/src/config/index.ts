require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { getEnv } from '../utils/env';

const prisma = new PrismaClient();

const redis = new Redis(getEnv('REDIS_URL'), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

export { prisma, redis };

const config = {
    port: parseInt(getEnv('PORT', '8080'), 10),
    nodeEnv: getEnv('NODE_ENV'),
    jwt: {
        secret: getEnv('JWT_SECRET'),
        refreshSecret: getEnv('JWT_REFRESH_SECRET'),
        expiresIn: getEnv('JWT_EXPIRES_IN', '15m'),
        refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    },
    db: {
        url: getEnv('DATABASE_URL'),

    },
    redis: {
        url: getEnv('REDIS_URL'),

    },
    rateLimit: {
        windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS'), 10),
        max: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS'), 10),
    },
    trading: {
        maxOrderSize: parseFloat(getEnv("MAX_ORDER_SIZE", "1000000")),
        minOrderSize: parseFloat(getEnv("MIN_ORDER_SIZE", "0.00000001")),
        makerFee: parseFloat(getEnv("MAKER_FEE", "0.001")),
        takerFee: parseFloat(getEnv("TAKER_FEE", "0.0015")),
    },
    security: {
        bcryptRounds: parseInt(getEnv('BCRYPT_ROUNDS'), 10),
        sessionSecret: getEnv('SESSION_SECRET'),
    },
    logging: {
        level: getEnv('LOG_LEVEL'),
        file: getEnv('LOG_FILE')
    },
};

module.exports = { config, prisma, redis };
