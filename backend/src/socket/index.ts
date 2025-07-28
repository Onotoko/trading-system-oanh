import { Server } from "socket.io";
import { config } from "@/config"
export let io: Server;

export const initializeSocket = (server: any) => {
    io = new Server(server, {
        cors: {
            origin: config.frontend.url || "http://localhost:3000",
            methods: ["GET", "POST"]
        }
    });
    return io;
};  