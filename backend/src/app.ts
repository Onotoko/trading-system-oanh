import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { config } from "./config";
import { mockAuth } from "./middleware/auth";
import orderRoutes from "./routes/order.routes";
import marketRoutes from "./routes/market.routes";
import { MatchingEngineService } from "./services/matching-engine.service";

const app = express();

// Middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", "ws:", "wss:"],
        },
    },
}));

app.use(cors({
    origin: config.frontend.url || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs || 15 * 60 * 1000,
    max: config.rateLimit.max || 100,
    message: {
        error: "Too many requests from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Auth middleware
app.use(mockAuth);

// Routes
app.use("/api/orders", orderRoutes);
app.use("/api/market", marketRoutes);

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv || "development"
    });
});


// Initialize Socket.IO function (to be called from server.ts)
export const initializeSocket = (server: any) => {
    const io = new Server(server, {
        cors: {
            origin: config.frontend.url || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    // WebSocket connection handling
    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Subscribe to symbol updates
        socket.on("subscribe", async (data: { symbol: string }) => {
            try {
                if (!data.symbol) {
                    socket.emit("error", { message: "Symbol is required" });
                    return;
                }

                socket.join(`orderbook:${data.symbol}`);
                socket.join(`trade:${data.symbol}`);

                // Send initial order book data
                const orderBook = await MatchingEngineService.getOrderBook(data.symbol);
                socket.emit(`orderbook:${data.symbol}`, orderBook);

                console.log(`Client ${socket.id} subscribed to ${data.symbol}`);
            } catch (error) {
                console.error("Error handling subscribe:", error);
                socket.emit("error", { message: "Failed to subscribe to symbol" });
            }
        });

        // Unsubscribe from symbol updates
        socket.on("unsubscribe", (data: { symbol: string }) => {
            if (!data.symbol) {
                socket.emit("error", { message: "Symbol is required" });
                return;
            }

            socket.leave(`orderbook:${data.symbol}`);
            socket.leave(`trade:${data.symbol}`);

            console.log(`Client ${socket.id} unsubscribed from ${data.symbol}`);
        });

        // Handle ping/pong for connection health
        socket.on("ping", () => {
            socket.emit("pong");
        });

        socket.on("disconnect", (reason) => {
            console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        });

        socket.on("error", (error) => {
            console.error(`Socket error for client ${socket.id}:`, error);
        });
    });

    return io;
};

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Error:", err);

    // Don't leak error details in production
    const errorMessage = config.nodeEnv === "production"
        ? "Internal server error"
        : err.message;

    const statusCode = err.statusCode || err.status || 500;

    res.status(statusCode).json({
        error: errorMessage,
        ...(config.nodeEnv !== "production" && { stack: err.stack })
    });
});

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({
        error: "Route not found",
        path: req.originalUrl,
        method: req.method
    });
});

export default app;