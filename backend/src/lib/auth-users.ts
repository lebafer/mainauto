import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../prisma";
import type { PlatformRole } from "@prisma/client";

interface CreateCredentialUserInput {
  name: string;
  email: string;
  username?: string | null;
  password: string;
  platformRole?: PlatformRole;
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
        platformRole: input.platformRole ?? "user",
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

export async function upsertCredentialUser(input: CreateCredentialUserInput) {
  const passwordHash = await hashPassword(input.password);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedUsername = input.username?.trim() || null;
  const normalizedName = input.name.trim();

  return prisma.$transaction(async (tx) => {
    const matchConditions: Array<{ email?: string; username?: string | null }> = [{ email: normalizedEmail }];
    if (normalizedUsername) {
      matchConditions.push({ username: normalizedUsername });
    }

    const existingUser = await tx.user.findFirst({
      where: {
        OR: matchConditions,
      },
    });

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: normalizedName,
            email: normalizedEmail,
            username: normalizedUsername,
            platformRole: input.platformRole ?? existingUser.platformRole,
          },
        })
      : await tx.user.create({
          data: {
            id: randomUUID(),
            name: normalizedName,
            email: normalizedEmail,
            username: normalizedUsername,
            emailVerified: false,
            platformRole: input.platformRole ?? "user",
          },
        });

    const credentialAccount = await tx.account.findFirst({
      where: {
        userId: user.id,
        providerId: "credential",
      },
    });

    if (credentialAccount) {
      await tx.account.update({
        where: { id: credentialAccount.id },
        data: {
          accountId: user.id,
          password: passwordHash,
        },
      });
    } else {
      await tx.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });
    }

    return user;
  });
}
