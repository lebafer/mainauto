const AUTOSCOUT24_BASE_URL = "https://listing-creation.api.autoscout24.com";
const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  data: T;
};

type AutoscoutCustomerResponse = {
  customers: Array<{
    id: string;
    sellId?: string | null;
    canSetMiaRequestedTier?: boolean;
  }>;
};

type AutoscoutReference = {
  id: string;
  name: string;
  referenceType: string;
  vehicleType?: string[];
};

type AutoscoutReferenceResponse = {
  references: AutoscoutReference[];
};

type AutoscoutMake = {
  id: number;
  name: string;
  models: Array<{
    id: number;
    name: string;
    vehicleType: string;
  }>;
  vehicleTypes: string[];
};

type AutoscoutMakeResponse = {
  makes: AutoscoutMake[];
};

type AutoscoutImageReference = {
  id: string;
};

type AutoscoutListingResponse = {
  id: string;
  publication?: {
    status?: string;
    channels?: Array<{
      id: string;
      url?: string;
    }>;
  };
};

const cache = new Map<string, CacheEntry<unknown>>();

export class AutoscoutApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `AutoScout24 request failed (${status})`);
    this.name = "AutoscoutApiError";
    this.status = status;
    this.body = body;
  }
}

function getBasicAuthHeaders(username: string, password: string): Record<string, string> {
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
  };
}

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.data as T;
}

function setCached<T>(key: string, data: T) {
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });
}

async function autoscoutFetch<T>(
  path: string,
  options: RequestInit,
  credentials?: { username: string; password: string }
): Promise<T> {
  const response = await fetch(`${AUTOSCOUT24_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(credentials ? getBasicAuthHeaders(credentials.username, credentials.password) : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AutoscoutApiError(response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function autoscoutVerifyCredentials(input: {
  username: string;
  password: string;
}) {
  const payload = await autoscoutFetch<AutoscoutCustomerResponse>(
    "/customers",
    {
      method: "GET",
    },
    input
  );

  return payload.customers ?? [];
}

export async function autoscoutGetMakes() {
  const cacheKey = "autoscout:makes:de";
  const cached = getCached<AutoscoutMake[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await autoscoutFetch<AutoscoutMakeResponse>(
    "/makes?culture=de-DE&marketplace=de",
    { method: "GET" }
  );

  const makes = payload.makes ?? [];
  setCached(cacheKey, makes);
  return makes;
}

export async function autoscoutGetReferences(referenceType: string) {
  const cacheKey = `autoscout:references:${referenceType}:de`;
  const cached = getCached<AutoscoutReference[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await autoscoutFetch<AutoscoutReferenceResponse>(
    `/references?referenceType=${encodeURIComponent(referenceType)}&culture=de-DE&marketplace=de`,
    { method: "GET" }
  );

  const references = payload.references ?? [];
  setCached(cacheKey, references);
  return references;
}

export async function autoscoutUploadImage(
  credentials: { username: string; password: string; customerId: string },
  file: { bytes: ArrayBuffer; contentType: string }
) {
  return autoscoutFetch<AutoscoutImageReference>(
    `/customers/${credentials.customerId}/images`,
    {
      method: "POST",
      body: file.bytes,
      headers: {
        "Content-Type": file.contentType,
      },
    },
    credentials
  );
}

export async function autoscoutCreateListing(
  credentials: { username: string; password: string; customerId: string },
  payload: Record<string, unknown>
) {
  return autoscoutFetch<AutoscoutListingResponse>(
    `/customers/${credentials.customerId}/listings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    credentials
  );
}

export async function autoscoutUpdateListing(
  credentials: { username: string; password: string; customerId: string; listingId: string },
  payload: Record<string, unknown>
) {
  return autoscoutFetch<AutoscoutListingResponse>(
    `/customers/${credentials.customerId}/listings/${credentials.listingId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    credentials
  );
}

export async function autoscoutPatchListing(
  credentials: { username: string; password: string; customerId: string; listingId: string },
  payload: Record<string, unknown>
) {
  return autoscoutFetch<AutoscoutListingResponse>(
    `/customers/${credentials.customerId}/listings/${credentials.listingId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    credentials
  );
}

export async function autoscoutDeleteListing(credentials: {
  username: string;
  password: string;
  customerId: string;
  listingId: string;
}) {
  return autoscoutFetch<void>(
    `/customers/${credentials.customerId}/listings/${credentials.listingId}`,
    {
      method: "DELETE",
    },
    credentials
  );
}
