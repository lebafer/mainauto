import type { Prisma } from "@prisma/client";

export interface ManualCustomerParty {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function manualPartyToCustomerData(
  dealerId: string,
  party: ManualCustomerParty
): Prisma.CustomerUncheckedCreateInput | null {
  const firstName = clean(party.firstName);
  const lastName = clean(party.lastName);
  if (!firstName || !lastName) return null;

  const company = clean(party.company);
  const taxId = clean(party.taxId);

  return {
    dealerId,
    firstName,
    lastName,
    company,
    address: clean(party.address),
    city: clean(party.city),
    zip: clean(party.zip),
    country: clean(party.country),
    phone: clean(party.phone),
    email: clean(party.email)?.toLowerCase() ?? null,
    taxId,
    customerType: company || taxId ? "gewerblich" : "privat",
  };
}

export function buildManualCustomerLookupWhere(
  data: Prisma.CustomerUncheckedCreateInput
): Prisma.CustomerWhereInput {
  const nameMatch: Prisma.CustomerWhereInput = {
    firstName: data.firstName,
    lastName: data.lastName,
  };
  const or: Prisma.CustomerWhereInput[] = [];

  if (data.email) {
    or.push({ email: data.email });
  }
  if (data.phone) {
    or.push({ ...nameMatch, phone: data.phone });
  }
  if (data.address || data.zip || data.city) {
    or.push({ ...nameMatch, address: data.address, zip: data.zip, city: data.city });
  }
  if (data.company) {
    or.push({ ...nameMatch, company: data.company });
  }
  if (or.length === 0) {
    or.push(nameMatch);
  }

  return { dealerId: data.dealerId, OR: or };
}

type CustomerDelegate = {
  findFirst(args: { where: Prisma.CustomerWhereInput }): Promise<unknown | null>;
  create(args: { data: Prisma.CustomerUncheckedCreateInput }): Promise<unknown>;
};

export async function ensureCustomerForManualParty<TCustomer>(
  customerDelegate: CustomerDelegate,
  dealerId: string,
  party: ManualCustomerParty
): Promise<TCustomer | null> {
  const data = manualPartyToCustomerData(dealerId, party);
  if (!data) return null;

  const existing = await customerDelegate.findFirst({ where: buildManualCustomerLookupWhere(data) });
  if (existing) return existing as TCustomer;

  return (await customerDelegate.create({ data })) as TCustomer;
}
