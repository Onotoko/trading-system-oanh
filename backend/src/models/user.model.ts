import { prisma } from "@/config";
import { User } from "@prisma/client";
import { CreateUserInput, UpdateFeeTierInput, UpdateKycStatusInput } from "@/types/user";

export const UserModel = {
    findById: (id: bigint): Promise<User | null> => {
        return prisma.user.findUnique({ where: { id } });
    },

    findByEmail: (email: string): Promise<User | null> => {
        return prisma.user.findUnique({ where: { email } });
    },

    findByUsername: (username: string): Promise<User | null> => {
        return prisma.user.findUnique({ where: { username } });
    },

    create: (data: CreateUserInput): Promise<User> => {
        return prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                passwordHash: data.passwordHash,
            },
        });
    },

    updateKycStatus: ({ userId, status }: UpdateKycStatusInput): Promise<User> => {
        return prisma.user.update({ where: { id: userId }, data: { kycStatus: status } });
    },

    updateFeeTier: ({ userId, tier }: UpdateFeeTierInput): Promise<User> => {
        return prisma.user.update({ where: { id: userId }, data: { feeTier: tier } });
    },
};