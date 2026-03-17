import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../prisma";

interface CreateCredentialUserInput {
  name: string;
  email: string;
  username?: string | null;
  password: string;
}

export async function createCredentialUser(input: CreateCredentialUserInput) {
  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedUsername = input.username?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        name: input.name.trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        emailVerified: false,
      },
    });

    await tx.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
    });

    return user;
  });
}
