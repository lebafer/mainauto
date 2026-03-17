import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { DEFAULT_DEALER_SETTINGS, DEFAULT_PLATFORM_NAME, DEFAULT_SUPPORT_EMAIL } from "../lib/dealers";
import { OnboardingInquiryCreateSchema } from "../types";
import { getResolvedDealer, getResolvedDomain, getTenantStatus } from "../lib/request-context";

const publicRouter = new Hono();

publicRouter.get("/tenant-context", async (c) => {
  const dealer = getResolvedDealer(c);
  const domain = getResolvedDomain(c);
  const tenantStatus = getTenantStatus(c);
  const settings = dealer?.settings as Record<string, string | null | undefined> | null | undefined;

  return c.json({
    data: {
      displayName: settings?.displayName || dealer?.name || DEFAULT_PLATFORM_NAME,
      logoUrl: settings?.logoUrl ?? null,
      faviconUrl: settings?.faviconUrl ?? null,
      primaryColor: settings?.primaryColor ?? DEFAULT_DEALER_SETTINGS.primaryColor,
      accentColor: settings?.accentColor ?? DEFAULT_DEALER_SETTINGS.accentColor,
      loginHeadline: settings?.loginHeadline ?? DEFAULT_DEALER_SETTINGS.loginHeadline,
      supportEmail: settings?.supportEmail ?? DEFAULT_SUPPORT_EMAIL,
      tenantStatus,
      dealer: dealer
        ? {
            id: dealer.id,
            name: dealer.name,
            slug: dealer.slug,
            status: dealer.status,
            setupStatus: dealer.setupStatus,
            isDefault: dealer.isDefault,
            createdAt: dealer.createdAt.toISOString(),
            updatedAt: dealer.updatedAt.toISOString(),
          }
        : null,
      activeDomain: domain
        ? {
            id: domain.id,
            dealerId: domain.dealerId,
            host: domain.host,
            status: domain.status,
            isPrimary: domain.isPrimary,
            verificationToken: domain.verificationToken,
            verifiedAt: domain.verifiedAt?.toISOString() ?? null,
            createdAt: domain.createdAt.toISOString(),
            updatedAt: domain.updatedAt.toISOString(),
          }
        : null,
    },
  });
});

publicRouter.post(
  "/inquiries",
  zValidator("json", OnboardingInquiryCreateSchema),
  async (c) => {
    const data = c.req.valid("json");

    const inquiry = await prisma.onboardingInquiry.create({
      data: {
        businessName: data.businessName.trim(),
        contactName: data.contactName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || null,
        website: data.website?.trim() || null,
        notes: data.notes?.trim() || null,
      },
    });

    return c.json(
      {
        data: {
          id: inquiry.id,
          status: inquiry.status,
        },
      },
      201
    );
  }
);

export { publicRouter };
