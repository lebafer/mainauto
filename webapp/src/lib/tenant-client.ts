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
