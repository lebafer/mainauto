import { describe, expect, test } from "bun:test";
import { getMissingInvoiceMasterData } from "./invoiceValidation";

describe("getMissingInvoiceMasterData", () => {
  test("requires seller tax data for regular taxation and reports concrete fields", () => {
    expect(
      getMissingInvoiceMasterData({
        dealer: {
          legalName: "Autohaus GmbH",
          addressLine1: "Hauptstraße 1",
          zip: "10115",
          city: "Berlin",
          country: "DE",
          taxId: null,
        },
        customer: { address: null, zip: "20095", city: "Hamburg", country: "DE" },
        marginTaxed: false,
        taxRate: 19,
      })
    ).toEqual(["dealer.taxId", "customer.address"]);
  });

  test("requires seller tax identification for margin taxation too", () => {
    expect(
      getMissingInvoiceMasterData({
        dealer: {
          displayName: "Autohaus",
          addressLine1: "Hauptstraße 1",
          zip: "10115",
          city: "Berlin",
          country: "DE",
        },
        customer: {
          address: "Nebenstraße 2",
          zip: "20095",
          city: "Hamburg",
          country: "DE",
        },
        marginTaxed: true,
        taxRate: 19,
      })
    ).toEqual(["dealer.taxId"]);
  });
});
