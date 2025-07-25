"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const startServer = async () => {
    try {
        const server = app_1.default.listen(8080, () => {
            console.log(`🚀 Server running`);
        });
        process.on('SIGTERM', () => {
            console.log('SIGTERM received');
            server.close(() => {
                console.log('Process terminated');
            });
        });
        return server;
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app_1.default;
//# sourceMappingURL=server.js.map