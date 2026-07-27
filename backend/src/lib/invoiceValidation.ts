export function getMissingInvoiceMasterData(input: {
  dealer: {
    legalName?: string | null;
    displayName?: string | null;
    addressLine1?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    taxId?: string | null;
  } | null;
  customer: {
    address?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
  };
  marginTaxed: boolean;
  taxRate: number;
}): string[] {
  const { dealer, customer } = input;
  return [
    ...(!dealer?.legalName && !dealer?.displayName ? ["dealer.legalName"] : []),
    ...(!dealer?.addressLine1 ? ["dealer.addressLine1"] : []),
    ...(!dealer?.zip ? ["dealer.zip"] : []),
    ...(!dealer?.city ? ["dealer.city"] : []),
    ...(!dealer?.country ? ["dealer.country"] : []),
    ...(!dealer?.taxId ? ["dealer.taxId"] : []),
    ...(!customer.address ? ["customer.address"] : []),
    ...(!customer.zip ? ["customer.zip"] : []),
    ...(!customer.city ? ["customer.city"] : []),
    ...(!customer.country ? ["customer.country"] : []),
  ];
}
