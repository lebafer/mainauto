import type { Context } from "hono";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { getClientIp } from "./security";

type AuditClient = Pick<PrismaClient, "auditLog">;

export async function writeAuditLog(
  c: Context,
  event: {
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
  client: AuditClient = prisma
) {
  const user = c.get("user") as { id?: string } | null | undefined;
  const membership = c.get("membership") as { dealerId?: string } | null | undefined;
  await client.auditLog.create({
    data: {
      dealerId: membership?.dealerId ?? null,
      actorId: user?.id ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata: event.metadata,
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent")?.slice(0, 500) ?? null,
    },
  });
}
