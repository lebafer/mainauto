import type {
  MarketplaceConnection,
  MarketplaceCustomer,
  MarketplaceSyncSchedule,
  VehicleMarketplaceTarget,
} from "../../../backend/src/types";
import type { Vehicle } from "./vehicles";

export type MarketplaceConnectionInfo = MarketplaceConnection;
export type MarketplaceCustomerInfo = MarketplaceCustomer;
export type MarketplaceScheduleInfo = MarketplaceSyncSchedule;
export type MarketplaceVehicleTargetInfo = VehicleMarketplaceTarget;

export type MarketplaceOverviewResponse = {
  connections: MarketplaceConnectionInfo[];
  schedules: MarketplaceScheduleInfo[];
};

export type MarketplaceVehicleRow = Vehicle & {
  readiness: {
    ready: boolean;
    issues: string[];
  };
  target: MarketplaceVehicleTargetInfo | null;
};

export function getAutoscoutTarget(vehicle: Pick<Vehicle, "marketplaceTargets">) {
  return vehicle.marketplaceTargets?.find((target) => target.platform === "autoscout24") ?? null;
}

export function getMarketplaceStatusLabel(status?: string | null) {
  switch (status) {
    case "active":
      return "Live";
    case "inactive":
      return "Inaktiv";
    case "deleted":
      return "Gelöscht";
    default:
      return "Nicht verbunden";
  }
}
