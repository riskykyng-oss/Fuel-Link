import { Icon } from "../icons";

interface ShareTripButtonProps {
  onShare: () => void;
}

/** Secondary share action — ghost style, never primary. */
export function ShareTripButton({ onShare }: ShareTripButtonProps) {
  return (
    <button
      type="button"
      onClick={onShare}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border px-4 text-sm font-medium text-text hover:bg-surface"
    >
      <Icon name="share" size={16} />
      Share trip with family
    </button>
  );
}
