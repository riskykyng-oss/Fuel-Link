import { Card } from "../primitives/Card";
import { Money } from "../primitives/Button";
import { VerifiedBadge } from "../primitives/StatusPill";
import { Icon } from "../icons";

interface ComplianceCardProps {
  capUsdPerLitre: number;
  ownUsdPerLitre: number;
  verifiedAt?: string;
}

/** Price-cap compliance. Breach = danger state, blocks saving a higher price. */
export function ComplianceCard({ capUsdPerLitre, ownUsdPerLitre, verifiedAt }: ComplianceCardProps) {
  const breach = ownUsdPerLitre > capUsdPerLitre;
  return (
    <Card
      title="Price compliance"
      action={
        breach ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
            <Icon name="alert" size={14} />
            Above cap
          </span>
        ) : (
          <VerifiedBadge label="Compliant" verifiedAt={verifiedAt} />
        )
      }
    >
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted">Cap per litre</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            <Money amountUsd={capUsdPerLitre} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Your price</dt>
          <dd
            className={
              breach
                ? "mt-1 text-lg font-semibold tabular-nums text-danger"
                : "mt-1 text-lg font-semibold tabular-nums"
            }
          >
            <Money amountUsd={ownUsdPerLitre} />
          </dd>
        </div>
      </dl>
      {breach && (
        <p className="mt-3 rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          Your price is above the cap. Price changes are locked until it is corrected.
        </p>
      )}
    </Card>
  );
}
