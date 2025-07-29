import OrderBook from "./components/OrderBook/OrderBook";
import TradingForm from "./components/TradingForm/TradingForm";
import OrderHistory from "./components/OrderHistory/OrderHistory";

function App() {
    return (
        <div style={{ display: "flex", padding: 24, gap: 32 }}>
            <div style={{ flex: 2 }}>
                <OrderBook />
                <TradingForm />
            </div>
            <div style={{ flex: 1 }}>
                <OrderHistory />
            </div>
        </div>
    );
}

export default App;
