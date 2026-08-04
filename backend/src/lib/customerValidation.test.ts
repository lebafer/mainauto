import { describe, expect, test } from "bun:test";
import { CustomerCreateSchema } from "../types";

describe("CustomerCreateSchema", () => {
  test("accepts the customer form default empty optional date", () => {
    const parsed = CustomerCreateSchema.safeParse({
      customerType: "privat",
      firstName: "Max",
      lastName: "Mustermann",
      email: "",
      idDocumentValidUntil: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.idDocumentValidUntil).toBeUndefined();
    }
  });

  test("accepts business customers with company only", () => {
    const parsed = CustomerCreateSchema.safeParse({
      customerType: "gewerblich",
      company: "Musterfirma GmbH",
      email: "",
      idDocumentValidUntil: "",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.firstName).toBe("");
      expect(parsed.data.lastName).toBe("Musterfirma GmbH");
    }
  });
});
