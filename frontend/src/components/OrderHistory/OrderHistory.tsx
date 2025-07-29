import { useEffect, useState } from "react";
import { fetchOrderHistory } from "../../services/api";
import { formatNumber } from "../../utils/format";

interface Order {
    id: string;
    side: string;
    type: string;
    price: number;
    quantity: number;
    status: string;
    createdAt: string;
}

export default function OrderHistory() {
    const [orders, setOrders] = useState<Order[]>([]);

    useEffect(() => {
        fetchOrderHistory("demo-user").then((data) => setOrders(data.orders || []));
    }, []);

    return (
        <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
            <h3>Order History</h3>
            <table width="100%">
                <thead>
                    <tr>
                        <th>Side</th>
                        <th>Type</th>
                        <th>Price</th>
                        <th>Qty</th>
                        <th>Status</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.map((o, idx) => (
                        <tr key={idx}>
                            <td>{o.side}</td>
                            <td>{o.type}</td>
                            <td>{formatNumber(o.price)}</td>
                            <td>{formatNumber(o.quantity)}</td>
                            <td>{o.status}</td>
                            <td>{new Date(o.createdAt).toLocaleTimeString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
