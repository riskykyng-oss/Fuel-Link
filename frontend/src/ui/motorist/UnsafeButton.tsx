import { Icon } from "../icons";

interface UnsafeButtonProps {
  onPanic: () => void;
}

/** Full-width panic control. Danger fill only ever used for this + dispute entry. */
export function UnsafeButton({ onPanic }: UnsafeButtonProps) {
  return (
    <button
      type="button"
      onClick={onPanic}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-control bg-danger px-4 text-sm font-bold text-base transition-colors hover:bg-danger/90"
    >
      <Icon name="siren" size={20} />
      Something feels unsafe
    </button>
  );
}

interface OfflineHintProps {
  message?: string;
}

/** Banner for offline or stale-GPS states: fall back to SMS. */
export function OfflineHint({ message = "No data? Send by SMS" }: OfflineHintProps) {
  return (
    <div className="flex items-center gap-2 rounded-control border border-warn/40 bg-warn/10 px-3 py-2.5 text-xs font-medium text-warn">
      <Icon name="alert" size={15} />
      {message}
    </div>
  );
}
