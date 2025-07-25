import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const UserModel = {
    findById(id: bigint) {
        return prisma.user.findUnique({ where: { id } });
    },

    findByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });
    }
};
