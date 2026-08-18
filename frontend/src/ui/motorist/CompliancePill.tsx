import { Button } from "../primitives/Button";
import { Icon } from "../icons";
import { VerifiedBadge } from "../primitives/StatusPill";

interface CompliancePillProps {
  capUsdPerLitre: number;
  verifiedAt?: string;
}

/** On-order compliance marker; success colouring only. */
export function CompliancePill({ capUsdPerLitre, verifiedAt }: CompliancePillProps) {
  return <VerifiedBadge label={`Compliant · cap $${capUsdPerLitre.toFixed(2)}`} verifiedAt={verifiedAt} />;
}

interface ConfirmHandoverProps {
  onConfirm: () => void;
  disabled?: boolean;
}

/** Final handover confirmation. Primary lime, disabled until code is valid. */
export function ConfirmHandover({ onConfirm, disabled = false }: ConfirmHandoverProps) {
  return (
    <Button fullWidth disabled={disabled} onClick={onConfirm}>
      Confirm handover
    </Button>
  );
}

interface ReportProblemProps {
  onReport?: () => void;
}

/** Dispute entry — ghost button with danger text, never a red fill. */
export function ReportProblem({ onReport }: ReportProblemProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-danger/30 bg-danger/5 px-3 py-2.5">
      <span className="text-xs text-danger">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon name="alert" size={14} />
          Report a problem
        </span>
      </span>
      <button
        type="button"
        onClick={onReport}
        className="rounded-control border border-danger/40 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
      >
        Start dispute
      </button>
    </div>
  );
}
