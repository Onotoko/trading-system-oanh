import React, { useState } from "react";
import { placeOrder } from "../../services/api";

export default function TradingForm() {
    const [type, setType] = useState<"buy" | "sell">("buy");
    const [orderType, setOrderType] = useState<"market" | "limit">("market");
    const [price, setPrice] = useState("");
    const [quantity, setQuantity] = useState("");
    const [result, setResult] = useState("");

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResult("Placing order...");
        try {
            const res = await placeOrder({
                side: type,
                type: orderType,
                price: orderType === "limit" ? Number(price) : undefined,
                quantity: Number(quantity),
                userId: "demo-user" // hoặc thay bằng user thật nếu có login
            });
            setResult(res.message || "Order placed!");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setResult("Error: " + err.message);
            } else {
                setResult("Unknown error");
            }
        }

    };

    return (
        <form
            onSubmit={submit}
            style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}
        >
            <h3>Place Order</h3>
            <div>
                <select value={type} onChange={e => setType(e.target.value as "buy" | "sell")}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                </select>
                <select value={orderType} onChange={e => setOrderType(e.target.value as "market" | "limit")}>
                    <option value="market">Market</option>
                    <option value="limit">Limit</option>
                </select>
            </div>
            {orderType === "limit" && (
                <div>
                    <input
                        type="number"
                        placeholder="Price"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        required
                        min={0}
                        step={0.01}
                    />
                </div>
            )}
            <div>
                <input
                    type="number"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    required
                    min={0}
                    step={0.0001}
                />
            </div>
            <button type="submit" style={{ marginTop: 8 }}>Submit</button>
            <div>{result}</div>
        </form>
    );
}
