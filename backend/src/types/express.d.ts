declare namespace Express {
    export interface Request {
        user?: {
            id: bigint;
            email?: string;
        };
    }
}
