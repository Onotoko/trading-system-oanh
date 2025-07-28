import axios from "axios";

const WEBHOOK_URL = process.env.ORDER_BOOK_WEBHOOK_URL || "http://localhost:4000/webhook/order-book";

export class WebhookService {
    /**
     * Push real-time order book update after trade or matching
     */
    static async publishOrderBookUpdate(symbol: string) {
        try {
            await axios.post(WEBHOOK_URL, { symbol });
            // Optionally: include top 5 price levels
        } catch (err: any) {
            console.error("Webhook failed:", err.message);
        }
    }

    /**
     * Push trade event
     */
    static async publishTrade(trade: {
        symbol: string;
        price: number;
        quantity: number;
        buyerUserId: bigint;
        sellerUserId: bigint;
    }) {
        try {
            await axios.post(`${WEBHOOK_URL}/trade`, trade);
        } catch (err: any) {
            console.error("Trade webhook failed:", err.message);
        }
    }
}
