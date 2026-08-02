import { describe, expect, test } from "bun:test";
import { buildManualCustomerLookupWhere, ensureCustomerForManualParty, manualPartyToCustomerData } from "./manualCustomer";

describe("manual customer creation", () => {
  test("maps a manual document party to customer data", () => {
    const data = manualPartyToCustomerData("dealer-1", {
      firstName: " Max ",
      lastName: " Mustermann ",
      email: " MAX@EXAMPLE.DE ",
      company: "",
      phone: " 0171 ",
    });

    expect(data).toMatchObject({
      dealerId: "dealer-1",
      firstName: "Max",
      lastName: "Mustermann",
      email: "max@example.de",
      phone: "0171",
      customerType: "privat",
    });
  });

  test("builds duplicate lookup by email or matching name/contact data", () => {
    const data = manualPartyToCustomerData("dealer-1", {
      firstName: "Erika",
      lastName: "Musterfrau",
      email: "erika@example.de",
      phone: "0172",
      address: "Hauptstr. 1",
      zip: "12345",
      city: "Berlin",
    });

    expect(buildManualCustomerLookupWhere(data!)).toEqual({
      dealerId: "dealer-1",
      OR: [
        { email: "erika@example.de" },
        { firstName: "Erika", lastName: "Musterfrau", phone: "0172" },
        { firstName: "Erika", lastName: "Musterfrau", address: "Hauptstr. 1", zip: "12345", city: "Berlin" },
      ],
    });
  });
});


test("creates a customer only when no duplicate exists", async () => {
  const created: unknown[] = [];
  const delegate = {
    async findFirst() {
      return null;
    },
    async create(args: { data: Record<string, unknown> }) {
      created.push(args.data);
      return { id: "customer-1", ...args.data };
    },
  };

  const customer = await ensureCustomerForManualParty(delegate, "dealer-1", {
    firstName: "Max",
    lastName: "Mustermann",
    email: "max@example.de",
  });

  expect(customer).toMatchObject({ id: "customer-1", email: "max@example.de" });
  expect(created).toHaveLength(1);
});

test("reuses an existing matching customer", async () => {
  const existing = { id: "customer-existing", firstName: "Max", lastName: "Mustermann" };
  const delegate = {
    async findFirst() {
      return existing;
    },
    async create() {
      throw new Error("should not create duplicates");
    },
  };

  await expect(ensureCustomerForManualParty(delegate, "dealer-1", {
    firstName: "Max",
    lastName: "Mustermann",
  })).resolves.toBe(existing);
});
