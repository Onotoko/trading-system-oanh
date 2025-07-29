import { useEffect, useRef } from "react";

export function useWebSocket(url: string, onMessage: (data: unknown) => void) {
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        wsRef.current = new WebSocket(url);
        wsRef.current.onmessage = (e) => {
            const data = JSON.parse(e.data);
            onMessage(data);
        };
        return () => {
            wsRef.current?.close();
        };
        // eslint-disable-next-line
    }, [url]);
}
