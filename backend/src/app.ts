import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import { config } from "@/config";
import { mockAuth } from "@/middleware/auth";
import orderRoutes from "@/routes/order.routes";
import marketRoutes from "@/routes/market.routes";
import { MatchingEngineService } from "@/services/matching-engine.service";
import { initializeSocket } from "@/socket";

const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);


// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: "Too many requests from this IP"
});
app.use(limiter);

// Auth middleware
app.use(mockAuth);

// Routes
app.use("/api", orderRoutes);
app.use("/api", marketRoutes);

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// WebSocket connection handling
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Subscribe to symbol updates
    socket.on("subscribe", (data: { symbol: string }) => {
        socket.join(`orderbook:${data.symbol}`);
        socket.join(`trade:${data.symbol}`);

        // Send initial order book data
        MatchingEngineService.getOrderBook(data.symbol)
            .then(orderBook => {
                socket.emit(`orderbook:${data.symbol}`, orderBook);
            })
            .catch(err => {
                console.error("Error sending initial order book:", err);
            });
    });

    // Unsubscribe from symbol updates
    socket.on("unsubscribe", (data: { symbol: string }) => {
        socket.leave(`orderbook:${data.symbol}`);
        socket.leave(`trade:${data.symbol}`);
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Error:", err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message
    });
});

// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({ error: "Route not found" });
});

const PORT = config.port || 8080;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 WebSocket server ready`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
});

export default app;