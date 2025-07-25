import { Request, Response, NextFunction } from "express";

export function mockAuth(req: Request, res: Response, next: NextFunction) {
    req.user = {
        id: BigInt(1),
        email: "test@example.com"
    };
    next();
}
