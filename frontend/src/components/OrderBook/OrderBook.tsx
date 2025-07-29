import { useState, useEffect } from "react";
import { fetchOrderBook } from "../../services/api";
import { formatNumber } from "../../utils/format";

type OrderLevel = { price: number; quantity: number };

export default function OrderBook() {
    const [bids, setBids] = useState<OrderLevel[]>([]);
    const [asks, setAsks] = useState<OrderLevel[]>([]);

    useEffect(() => {
        fetchOrderBook().then(data => {
            setBids(data.bids || []);
            setAsks(data.asks || []);
        });
        // for example polling
        const interval = setInterval(() => {
            fetchOrderBook().then(data => {
                setBids(data.bids || []);
                setAsks(data.asks || []);
            });
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 16 }}>
            <h3>Order Book</h3>
            <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <b>Bids</b>
                    <ul>
                        {bids.map((b, idx) => (
                            <li key={idx}>{formatNumber(b.price)} | {formatNumber(b.quantity)}</li>
                        ))}
                    </ul>
                </div>
                <div style={{ flex: 1 }}>
                    <b>Asks</b>
                    <ul>
                        {asks.map((a, idx) => (
                            <li key={idx}>{formatNumber(a.price)} | {formatNumber(a.quantity)}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
