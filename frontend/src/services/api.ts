const API_BASE = "http://localhost:8080/api";

export async function fetchOrderBook() {
    const res = await fetch(`${API_BASE}/market/orderbook`);
    return res.json();
}

export async function placeOrder(data: {
    side: "buy" | "sell";
    type: "market" | "limit";
    price?: number;
    quantity: number;
    userId: string;
}) {
    const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function fetchOrderHistory(userId: string) {
    const res = await fetch(`${API_BASE}/orders/history?userId=${userId}`);
    return res.json();
}
