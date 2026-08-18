import { Card } from "../primitives/Card";
import { EmptyState } from "../primitives/EmptyState";
import { Money } from "../primitives/Button";
import { VerifiedBadge } from "../primitives/StatusPill";
import { Icon } from "../icons";
import type { FleetVehicleData } from "../types";

interface FleetAccountProps {
  month: string;
  company: string;
  verified: boolean;
  vehicles: FleetVehicleData[];
  invoiceTotalUsd: number;
  paymentMethod: string;
}

/** Monthly fleet account with per-vehicle spend. Empty-safe vehicle list. */
export function FleetAccount({
  month,
  company,
  verified,
  vehicles,
  invoiceTotalUsd,
  paymentMethod,
}: FleetAccountProps) {
  return (
    <Card
      title={month}
      action={verified ? <VerifiedBadge label="Verified" /> : undefined}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="car" size={16} className="text-muted" />
        <p className="text-sm font-medium">{company}</p>
      </div>
      {vehicles.length === 0 ? (
        <EmptyState icon="car" headline="No vehicles on this account" />
      ) : (
        <dl className="flex flex-col gap-2">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.plate}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <dt className="text-text">{vehicle.plate}</dt>
              <dd className="font-medium tabular-nums text-muted">
                <Money amountUsd={vehicle.spentUsd} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-3 border-t border-border pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold">Invoice total</span>
          <span className="text-xl font-semibold tabular-nums">
            <Money amountUsd={invoiceTotalUsd} />
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">{paymentMethod}</p>
      </div>
    </Card>
  );
}
