import { createServer } from "http";
import { prisma } from './config';
import app, { initializeSocket } from './app';

const startServer = async () => {
    try {
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        // Create HTTP server
        const server = createServer(app);

        // Initialize Socket.IO
        const io = initializeSocket(server);

        // Start server
        const PORT = process.env.PORT || 8080;
        server.listen(PORT, () => {
            console.log(` Server running on port ${PORT}`);
            console.log(` WebSocket server ready`);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal: string) => {
            console.log(`${signal} received`);

            server.close(async () => {
                console.log('HTTP server closed');

                // Close database connection
                try {
                    await prisma.$disconnect();
                    console.log('Database connection closed');
                } catch (error) {
                    console.error('Error closing database:', error);
                }

                console.log('Process terminated gracefully');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);

        // Attempt to disconnect from database
        try {
            await prisma.$disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError);
        }

        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Start the server
startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export default app;