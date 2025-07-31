#!/usr/bin/env node

/**
 * Trading System Performance Benchmark
 * Tests order processing, matching engine, and API performance
 */

const axios = require('axios');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
    API_BASE_URL: process.env.API_URL || 'http://localhost:3001',
    WS_URL: process.env.WS_URL || 'ws://localhost:3001',
    CONCURRENT_USERS: parseInt(process.env.CONCURRENT_USERS) || 10,
    ORDERS_PER_USER: parseInt(process.env.ORDERS_PER_USER) || 100,
    TEST_DURATION: parseInt(process.env.TEST_DURATION) || 60000, // 60 seconds
    SYMBOLS: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
};

// Global statistics
const stats = {
    orders: {
        total: 0,
        successful: 0,
        failed: 0,
        latencies: [],
    },
    api: {
        requests: 0,
        successful: 0,
        failed: 0,
        latencies: [],
    },
    websocket: {
        connections: 0,
        messages: 0,
        latencies: [],
    },
    matching: {
        trades: 0,
        avgProcessingTime: 0,
    }
};

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Create a mock user for testing
async function createMockUser(userId) {
    try {
        const response = await axios.post(`${CONFIG.API_BASE_URL}/api/auth/register`, {
            email: `test${userId}@benchmark.com`,
            password: 'TestPassword123!',
            username: `testuser${userId}`
        });

        if (response.data.token) {
            return {
                id: userId,
                token: response.data.token,
                email: `test${userId}@benchmark.com`
            };
        }
    } catch (error) {
        // User might already exist, try to login
        try {
            const loginResponse = await axios.post(`${CONFIG.API_BASE_URL}/api/auth/login`, {
                email: `test${userId}@benchmark.com`,
                password: 'TestPassword123!'
            });

            return {
                id: userId,
                token: loginResponse.data.token,
                email: `test${userId}@benchmark.com`
            };
        } catch (loginError) {
            console.error(`Failed to create/login user ${userId}:`, loginError.message);
            return null;
        }
    }
}

// Add initial balance for testing
async function addBalance(user, asset, amount) {
    try {
        await axios.post(`${CONFIG.API_BASE_URL}/api/admin/balances`, {
            userId: user.id,
            asset: asset,
            amount: amount
        }, {
            headers: { Authorization: `Bearer ${user.token}` }
        });
    } catch (error) {
        // Ignore balance errors for benchmark
    }
}

// Create a random order
function generateRandomOrder(user) {
    const symbol = CONFIG.SYMBOLS[Math.floor(Math.random() * CONFIG.SYMBOLS.length)];
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const type = Math.random() > 0.7 ? 'MARKET' : 'LIMIT';

    const basePrice = symbol === 'BTCUSDT' ? 45000 :
        symbol === 'ETHUSDT' ? 3000 : 1.5;

    const price = type === 'LIMIT' ?
        basePrice * (0.95 + Math.random() * 0.1) : // ±5% of base price
        undefined;

    const quantity = (Math.random() * 0.1 + 0.001).toFixed(8);

    return {
        symbol,
        side,
        type,
        quantity,
        price: price ? price.toFixed(2) : undefined
    };
}

// Measure API latency
async function measureApiLatency(endpoint, method = 'GET', data = null, headers = {}) {
    const start = performance.now();

    try {
        let response;
        if (method === 'GET') {
            response = await axios.get(`${CONFIG.API_BASE_URL}${endpoint}`, { headers });
        } else if (method === 'POST') {
            response = await axios.post(`${CONFIG.API_BASE_URL}${endpoint}`, data, { headers });
        }

        const end = performance.now();
        const latency = end - start;

        stats.api.requests++;
        stats.api.successful++;
        stats.api.latencies.push(latency);

        return { success: true, latency, data: response.data };
    } catch (error) {
        const end = performance.now();
        const latency = end - start;

        stats.api.requests++;
        stats.api.failed++;
        stats.api.latencies.push(latency);

        return { success: false, latency, error: error.message };
    }
}

// Order processing benchmark
async function benchmarkOrderProcessing(user) {
    const orders = [];

    for (let i = 0; i < CONFIG.ORDERS_PER_USER; i++) {
        const order = generateRandomOrder(user);
        const start = performance.now();

        try {
            const response = await axios.post(`${CONFIG.API_BASE_URL}/api/orders`, order, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            const end = performance.now();
            const latency = end - start;

            stats.orders.total++;
            stats.orders.successful++;
            stats.orders.latencies.push(latency);

            orders.push({
                ...response.data,
                latency
            });

        } catch (error) {
            const end = performance.now();
            const latency = end - start;

            stats.orders.total++;
            stats.orders.failed++;
            stats.orders.latencies.push(latency);
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    return orders;
}

// WebSocket connection benchmark
async function benchmarkWebSocket(user) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${CONFIG.WS_URL}?token=${user.token}`);
        const startTime = performance.now();
        let messageCount = 0;
        let totalLatency = 0;

        ws.on('open', () => {
            const connectLatency = performance.now() - startTime;
            stats.websocket.connections++;

            // Subscribe to order book updates
            CONFIG.SYMBOLS.forEach(symbol => {
                ws.send(JSON.stringify({
                    action: 'subscribe',
                    channel: `orderbook.${symbol}`
                }));
            });

            // Send ping periodically
            const pingInterval = setInterval(() => {
                const pingStart = performance.now();
                ws.send(JSON.stringify({ action: 'ping', timestamp: pingStart }));
            }, 5000);

            setTimeout(() => {
                clearInterval(pingInterval);
                ws.close();
                resolve({
                    connectLatency,
                    messageCount,
                    avgLatency: messageCount > 0 ? totalLatency / messageCount : 0
                });
            }, CONFIG.TEST_DURATION / 2);
        });

        ws.on('message', (data) => {
            const receiveTime = performance.now();
            messageCount++;
            stats.websocket.messages++;

            try {
                const message = JSON.parse(data);
                if (message.timestamp) {
                    const latency = receiveTime - message.timestamp;
                    totalLatency += latency;
                    stats.websocket.latencies.push(latency);
                }
            } catch (error) {
                // Ignore parsing errors
            }
        });

        ws.on('error', (error) => {
            reject(error);
        });
    });
}

// Market data API benchmark
async function benchmarkMarketDataAPI() {
    const endpoints = [
        '/api/markets/BTCUSDT/orderbook',
        '/api/markets/BTCUSDT/trades',
        '/api/markets/BTCUSDT/ticker',
        '/api/markets/symbols'
    ];

    const results = [];

    for (const endpoint of endpoints) {
        const result = await measureApiLatency(endpoint);
        results.push({
            endpoint,
            ...result
        });
    }

    return results;
}

// Concurrent load test
async function runConcurrentLoadTest() {
    log('blue', `Starting concurrent load test with ${CONFIG.CONCURRENT_USERS} users...`);

    const users = [];
    const promises = [];

    // Create users
    for (let i = 1; i <= CONFIG.CONCURRENT_USERS; i++) {
        const user = await createMockUser(i);
        if (user) {
            users.push(user);
            // Add balance for trading
            await addBalance(user, 'BTC', 10);
            await addBalance(user, 'USDT', 100000);
        }
    }

    log('green', `Created ${users.length} test users`);

    // Start concurrent operations
    users.forEach(user => {
        promises.push(benchmarkOrderProcessing(user));
        promises.push(benchmarkWebSocket(user));
    });

    // Run market data tests
    promises.push(benchmarkMarketDataAPI());

    const startTime = performance.now();
    await Promise.allSettled(promises);
    const totalTime = performance.now() - startTime;

    return { totalTime, userCount: users.length };
}

// Calculate statistics
function calculateStats(latencies) {
    if (latencies.length === 0) return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };

    const sorted = latencies.sort((a, b) => a - b);
    const len = sorted.length;

    return {
        min: sorted[0].toFixed(2),
        max: sorted[len - 1].toFixed(2),
        avg: (sorted.reduce((a, b) => a + b, 0) / len).toFixed(2),
        p95: sorted[Math.floor(len * 0.95)].toFixed(2),
        p99: sorted[Math.floor(len * 0.99)].toFixed(2)
    };
}

// Display results
function displayResults(testResults) {
    console.log('\n' + '='.repeat(60));
    log('cyan', '           TRADING SYSTEM BENCHMARK RESULTS');
    console.log('='.repeat(60));

    // Test configuration
    console.log('\n📊 Test Configuration:');
    console.log(`   Concurrent Users: ${CONFIG.CONCURRENT_USERS}`);
    console.log(`   Orders per User: ${CONFIG.ORDERS_PER_USER}`);
    console.log(`   Test Duration: ${CONFIG.TEST_DURATION}ms`);
    console.log(`   Total Runtime: ${testResults.totalTime.toFixed(2)}ms`);

    // Order processing results
    console.log('\n🚀 Order Processing Performance:');
    const orderStats = calculateStats(stats.orders.latencies);
    console.log(`   Total Orders: ${stats.orders.total}`);
    console.log(`   Successful: ${stats.orders.successful} (${((stats.orders.successful / stats.orders.total) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${stats.orders.failed} (${((stats.orders.failed / stats.orders.total) * 100).toFixed(1)}%)`);
    console.log(`   Latency (ms): Min=${orderStats.min}, Avg=${orderStats.avg}, Max=${orderStats.max}`);
    console.log(`   P95: ${orderStats.p95}ms, P99: ${orderStats.p99}ms`);

    // Performance targets
    const avgLatency = parseFloat(orderStats.avg);
    if (avgLatency < 10) {
        log('green', '   ✅ EXCELLENT: Average latency < 10ms');
    } else if (avgLatency < 50) {
        log('yellow', '   ⚠️  GOOD: Average latency < 50ms');
    } else {
        log('red', '   ❌ NEEDS IMPROVEMENT: Average latency > 50ms');
    }

    // API performance
    console.log('\n🌐 API Performance:');
    const apiStats = calculateStats(stats.api.latencies);
    console.log(`   Total Requests: ${stats.api.requests}`);
    console.log(`   Success Rate: ${((stats.api.successful / stats.api.requests) * 100).toFixed(1)}%`);
    console.log(`   Latency (ms): Min=${apiStats.min}, Avg=${apiStats.avg}, Max=${apiStats.max}`);
    console.log(`   P95: ${apiStats.p95}ms, P99: ${apiStats.p99}ms`);

    // WebSocket performance
    console.log('\n🔌 WebSocket Performance:');
    const wsStats = calculateStats(stats.websocket.latencies);
    console.log(`   Connections: ${stats.websocket.connections}`);
    console.log(`   Messages: ${stats.websocket.messages}`);
    console.log(`   Latency (ms): Min=${wsStats.min}, Avg=${wsStats.avg}, Max=${wsStats.max}`);

    // Throughput calculations
    console.log('\n📈 Throughput Metrics:');
    const ordersPerSecond = (stats.orders.successful / (testResults.totalTime / 1000)).toFixed(2);
    const requestsPerSecond = (stats.api.successful / (testResults.totalTime / 1000)).toFixed(2);

    console.log(`   Orders/sec: ${ordersPerSecond}`);
    console.log(`   API Requests/sec: ${requestsPerSecond}`);

    // Performance evaluation
    console.log('\n🎯 Performance Evaluation:');
    if (parseFloat(ordersPerSecond) >= 1000) {
        log('green', '   ✅ ORDER THROUGHPUT: Excellent (≥1000 orders/sec)');
    } else if (parseFloat(ordersPerSecond) >= 500) {
        log('yellow', '   ⚠️  ORDER THROUGHPUT: Good (≥500 orders/sec)');
    } else {
        log('red', '   ❌ ORDER THROUGHPUT: Needs improvement (<500 orders/sec)');
    }

    // System resource recommendations
    console.log('\n💡 Recommendations:');
    if (avgLatency > 50) {
        console.log('   • Consider database query optimization');
        console.log('   • Implement connection pooling');
        console.log('   • Add Redis caching for order book data');
    }

    if (stats.orders.failed > stats.orders.successful * 0.05) {
        console.log('   • High failure rate detected - check error logs');
        console.log('   • Implement better error handling and retry logic');
    }

    if (parseFloat(ordersPerSecond) < 500) {
        console.log('   • Consider horizontal scaling of matching engine');
        console.log('   • Implement order batching for better throughput');
    }

    console.log('\n' + '='.repeat(60));
}

// Health check before running tests
async function healthCheck() {
    log('blue', 'Performing system health check...');

    try {
        const healthResponse = await axios.get(`${CONFIG.API_BASE_URL}/health`);
        if (healthResponse.data.status === 'ok') {
            log('green', '✅ Backend API is healthy');
        } else {
            throw new Error('API health check failed');
        }

        // Check database connectivity
        const dbCheck = await measureApiLatency('/health/db');
        if (dbCheck.success) {
            log('green', '✅ Database connection is healthy');
        } else {
            log('red', '❌ Database connection failed');
            return false;
        }

        // Check Redis connectivity
        const redisCheck = await measureApiLatency('/health/redis');
        if (redisCheck.success) {
            log('green', '✅ Redis connection is healthy');
        } else {
            log('red', '❌ Redis connection failed');
            return false;
        }

        return true;

    } catch (error) {
        log('red', `❌ Health check failed: ${error.message}`);
        return false;
    }
}

// Cleanup test data
async function cleanup() {
    log('blue', 'Cleaning up test data...');

    try {
        // Remove test users (if cleanup endpoint exists)
        for (let i = 1; i <= CONFIG.CONCURRENT_USERS; i++) {
            try {
                await axios.delete(`${CONFIG.API_BASE_URL}/api/admin/users/test${i}@benchmark.com`);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        log('green', '✅ Cleanup completed');
    } catch (error) {
        log('yellow', '⚠️  Cleanup partially failed - some test data may remain');
    }
}

// Main benchmark execution
async function main() {
    console.log('\n🚀 Trading System Performance Benchmark');
    console.log('==========================================\n');

    // Health check
    const isHealthy = await healthCheck();
    if (!isHealthy) {
        log('red', 'System health check failed. Aborting benchmark.');
        process.exit(1);
    }

    try {
        // Run concurrent load test
        const testResults = await runConcurrentLoadTest();

        // Display results
        displayResults(testResults);

        // Cleanup
        await cleanup();

        // Exit with appropriate code
        const successRate = (stats.orders.successful / stats.orders.total) * 100;
        const avgLatency = stats.orders.latencies.reduce((a, b) => a + b, 0) / stats.orders.latencies.length;

        if (successRate >= 95 && avgLatency <= 50) {
            log('green', '\n🎉 Benchmark completed successfully - System performance is excellent!');
            process.exit(0);
        } else if (successRate >= 90 && avgLatency <= 100) {
            log('yellow', '\n⚠️  Benchmark completed - System performance needs minor improvements');
            process.exit(0);
        } else {
            log('red', '\n❌ Benchmark completed - System performance needs significant improvements');
            process.exit(1);
        }

    } catch (error) {
        log('red', `Benchmark failed: ${error.message}`);
        await cleanup();
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    log('yellow', '\nBenchmark interrupted. Cleaning up...');
    await cleanup();
    process.exit(1);
});

process.on('SIGTERM', async () => {
    log('yellow', '\nBenchmark terminated. Cleaning up...');
    await cleanup();
    process.exit(1);
});

// Run benchmark if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Benchmark error:', error);
        process.exit(1);
    });
}

module.exports = {
    benchmarkOrderProcessing,
    benchmarkWebSocket,
    benchmarkMarketDataAPI,
    calculateStats,
    main
};