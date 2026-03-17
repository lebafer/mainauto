import type { PublicTenantContext } from "@/lib/auth-client";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "";

export async function fetchTenantContext(): Promise<PublicTenantContext | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/tenant-context`, {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return (payload?.data ?? null) as PublicTenantContext | null;
  } catch {
    return null;
  }
}

export async function submitOnboardingInquiry(input: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  notes?: string;
}) {
  const response = await fetch(`${API_BASE_URL}/api/public/inquiries`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error?.message || "Anfrage konnte nicht gesendet werden.");
  }

  const payload = await response.json();
  return payload?.data ?? null;
}
