import { describe, expect, test } from "bun:test";
import {
  buildSaleAccountingSnapshot,
  resolveLegacySaleAccounting,
} from "./saleAccounting";

describe("buildSaleAccountingSnapshot", () => {
  test("freezes regular-taxed gross, tax and every cost component in cents", () => {
    expect(
      buildSaleAccountingSnapshot(23_800, 19, {
        marginTaxed: false,
        purchasePrice: 10_000,
        exportEnabled: true,
        transportCostDomestic: 100,
        transportCostAbroad: 200,
        customsDuties: 300,
        registrationFees: 50,
        repairCostsAbroad: 75,
        costs: [{ amount: 12.34 }, { amount: 87.66 }],
      })
    ).toEqual({
      accountingStatus: "verified",
      priceModeSnapshot: "gross",
      marginTaxedSnapshot: false,
      grossCents: 2_380_000,
      netCents: 2_000_000,
      taxCents: 380_000,
      marginTaxCents: 0,
      purchasePriceCents: 1_000_000,
      manualCostsCents: 10_000,
      exportCostsCents: 72_500,
      totalCostCents: 1_082_500,
    });
  });


  test("accepts a regular-tax net input and freezes the resulting gross sale", () => {
    const snapshot = buildSaleAccountingSnapshot(20_000, 19, {
      marginTaxed: false,
      purchasePrice: 10_000,
      costs: [],
    }, "net");

    expect(snapshot.priceModeSnapshot).toBe("net");
    expect(snapshot.grossCents).toBe(2_380_000);
    expect(snapshot.netCents).toBe(2_000_000);
    expect(snapshot.taxCents).toBe(380_000);
  });

  test("internally removes tax from a positive margin without disclosing it", () => {
    const snapshot = buildSaleAccountingSnapshot(15_000, 19, {
      marginTaxed: true,
      purchasePrice: 10_000,
      exportEnabled: false,
      transportCostDomestic: 100,
      transportCostAbroad: 900,
      costs: [],
    });
    expect(snapshot.grossCents).toBe(1_500_000);
    expect(snapshot.marginTaxCents).toBe(79_832);
    expect(snapshot.netCents).toBe(1_420_168);
    expect(snapshot.taxCents).toBe(0);
    expect(snapshot.priceModeSnapshot).toBe("gross");
    expect(snapshot.exportCostsCents).toBe(10_000);
  });

  test("does not calculate margin tax for zero or negative margins", () => {
    for (const grossAmount of [10_000, 9_000]) {
      const snapshot = buildSaleAccountingSnapshot(grossAmount, 19, {
        marginTaxed: true,
        purchasePrice: 10_000,
        costs: [],
      });
      expect(snapshot.marginTaxCents).toBe(0);
      expect(snapshot.netCents).toBe(snapshot.grossCents);
    }
  });

  test("requires caller-selected historic tax semantics instead of current vehicle state", () => {
    const regular = resolveLegacySaleAccounting({
      storedPrice: 10_000,
      taxRate: 19,
      historicTaxMode: "regular",
      historicPriceMode: "net",
      purchasePriceCents: 500_000,
      manualCostsCents: 0,
      exportCostsCents: 0,
    });
    expect(regular.grossCents).toBe(1_190_000);
    expect(regular.marginTaxedSnapshot).toBe(false);

    const margin = resolveLegacySaleAccounting({
      storedPrice: 10_000,
      taxRate: 19,
      historicTaxMode: "margin",
      purchasePriceCents: 500_000,
      manualCostsCents: 0,
      exportCostsCents: 0,
    });
    expect(margin.grossCents).toBe(1_000_000);
    expect(margin.marginTaxedSnapshot).toBe(true);
    expect(margin.marginTaxCents).toBeGreaterThan(0);
  });
});
