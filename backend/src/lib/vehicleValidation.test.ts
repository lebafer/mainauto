import { describe, expect, test } from "bun:test";
import { VehicleCreateSchema, VehicleUpdateSchema } from "../types";

const baseVehicle = {
  vehicleNumber: "FZ-1",
  brand: "VW",
  model: "Golf",
  mileage: 12_000,
  purchasePrice: 10_000,
  sellingPrice: 12_000,
};

describe("Vehicle purchase date validation", () => {
  test("create accepts an optional purchase date", () => {
    const parsed = VehicleCreateSchema.parse({
      ...baseVehicle,
      purchaseDate: "2026-08-04",
    });

    expect(parsed.purchaseDate).toBe("2026-08-04");
  });

  test("update accepts clearing the purchase date from a form", () => {
    const parsed = VehicleUpdateSchema.parse({ purchaseDate: "" });

    expect(parsed.purchaseDate).toBeUndefined();
  });
});
