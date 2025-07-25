import request from "supertest";
import express from "express";
import orderRoutes from "../../src/routes/order.routes";

// Mock Service
jest.mock("@/services/order-management.service", () => ({
    OrderManagementService: {
        createOrder: jest.fn().mockResolvedValue({ id: 1, symbol: "BTC/USDT" }),
        cancelOrder: jest.fn().mockResolvedValue({ id: 1, status: "CANCELLED" }),
        getOrderHistory: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    }
}));

// Mock auth middleware
const mockAuth = (req: any, _res: any, next: any) => {
    req.user = { id: BigInt(1) };
    next();
};

// App setup
const app = express();
app.use(express.json());
app.use(mockAuth);
app.use("/api", orderRoutes);

describe("OrderController", () => {
    it("should create an order", async () => {
        const res = await request(app).post("/api/orders").send({
            symbol: "BTC/USDT",
            side: "BUY",
            type: "LIMIT",
            quantity: 1,
            price: 30000
        });

        expect(res.status).toBe(201);
        expect(res.body.symbol).toBe("BTC/USDT");
    });

    it("should cancel an order", async () => {
        const res = await request(app)
            .delete("/api/orders/123")
            .send();

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("CANCELLED");
    });

    it("should return order history", async () => {
        const res = await request(app).get("/api/orders/history");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("should return 401 if no user", async () => {
        const appWithoutAuth = express();
        appWithoutAuth.use(express.json());
        appWithoutAuth.use("/api", orderRoutes);

        const res = await request(appWithoutAuth).get("/api/orders/history");
        expect(res.status).toBe(401);
    });
});
