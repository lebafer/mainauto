import type { Context } from "hono";
import type { DealerMembershipRole, PlatformRole } from "@prisma/client";
import type { ActiveDealerMembership, FeatureEntitlements } from "./dealers";

export interface RequestContextState {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    username?: string | null;
    platformRole?: PlatformRole | string | null;
  };
  session: {
    id?: string;
    token?: string;
    userId?: string;
    expiresAt?: Date | string;
  };
  membership: ActiveDealerMembership | null;
  entitlements: FeatureEntitlements;
}

function getState(c: Context): RequestContextState {
  return {
    user: c.get("user") as RequestContextState["user"],
    session: c.get("session") as RequestContextState["session"],
    membership: (c.get("membership") as ActiveDealerMembership | null) ?? null,
    entitlements: (c.get("entitlements") as FeatureEntitlements | undefined) ?? {},
  };
}

export function getCurrentUser(c: Context) {
  return getState(c).user;
}

export function getCurrentMembership(c: Context) {
  return getState(c).membership;
}

export function getCurrentDealer(c: Context) {
  const membership = getCurrentMembership(c);
  if (!membership) {
    throw new Error("No active dealer membership available");
  }

  return membership.dealer;
}

export function getCurrentDealerId(c: Context): string {
  return getCurrentDealer(c).id;
}

export function getCurrentDealerRole(c: Context): DealerMembershipRole | string | null {
  return getCurrentMembership(c)?.role ?? null;
}

export function getCurrentEntitlements(c: Context): FeatureEntitlements {
  return getState(c).entitlements;
}

export function requirePlatformSuperAdmin(c: Context): Response | null {
  const { user } = getState(c);

  if (user.platformRole === "platform_super_admin") {
    return null;
  }

  return c.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "Platform admin access required",
      },
    },
    403
  );
}

export function requireDealerRole(c: Context, roles: Array<DealerMembershipRole | string>): Response | null {
  const role = getCurrentDealerRole(c);
  if (role && roles.includes(role)) {
    return null;
  }

  return c.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "Insufficient dealer permissions",
      },
    },
    403
  );
}

export function requireEntitlement(c: Context, entitlement: string): Response | null {
  const entitlements = getCurrentEntitlements(c);
  if (entitlements[entitlement]) {
    return null;
  }

  return c.json(
    {
      error: {
        code: "FEATURE_NOT_ENABLED",
        message: "Feature is not enabled for this dealer",
      },
    },
    403
  );
}
