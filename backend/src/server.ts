import app from './app';

const startServer = async () => {
    try {

        // Start server after DB connection is successful
        const server = app.listen(8080, () => {
            console.log(`🚀 Server running`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received');
            server.close(() => {
                console.log('Process terminated');
            });
        });

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

export default app; 