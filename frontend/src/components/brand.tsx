import { useEffect, useId, useState } from "react";

/**
 * The mark is a fuel tank in profile with a nozzle spout, and the letter F
 * carved out of it as negative space. Because the F is a void, anything drawn
 * behind it shows through — which is what makes the loader work: the same
 * artwork fills with fuel from the bottom, and the F fills with it.
 */

type MarkProps = {
  size?: number;
  /** 0 = empty tank, 1 = full. Drives the fuel level behind the cut-out F. */
  fill?: number;
  className?: string;
  title?: string;
};

export function Mark({ size = 40, fill = 1, className, title = "FuelLink" }: MarkProps) {
  const id = useId().replace(/:/g, "");
  const level = 56 - Math.max(0, Math.min(1, fill)) * 44;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <mask id={`tank-${id}`}>
          {/* white = visible */}
          <rect x="6" y="12" width="40" height="44" rx="11" fill="#fff" />
          {/* the F, cut out */}
          <path
            d="M17.5 22.5h17.5v6.6H24.6v5.2h9.1v6.5h-9.1v9.2h-7.1z"
            fill="#000"
          />
        </mask>
        <clipPath id={`clip-${id}`}>
          <rect x="6" y="12" width="40" height="44" rx="11" />
        </clipPath>
      </defs>

      {/* nozzle spout + hose */}
      <path
        d="M46 24h5.5a4.5 4.5 0 0 1 4.5 4.5V42a3.6 3.6 0 0 1-7.2 0V32.5H46z"
        fill="currentColor"
      />
      <rect x="43" y="18" width="4" height="9" rx="2" fill="currentColor" />

      {/* fuel level, behind the mask */}
      <g clipPath={`url(#clip-${id})`}>
        <rect x="6" y="12" width="40" height="44" fill="currentColor" opacity="0.22" />
        <rect
          x="6"
          y={level}
          width="40"
          height="56"
          fill="currentColor"
          style={{ transition: "y 0.45s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </g>

      {/* tank body with the F carved out, drawn over the fuel */}
      <rect
        x="6"
        y="12"
        width="40"
        height="44"
        rx="11"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
      />
      <path
        d="M17.5 22.5h17.5v6.6H24.6v5.2h9.1v6.5h-9.1v9.2h-7.1z"
        fill="var(--gunmetal)"
        mask={`url(#tank-${id})`}
      />
      <path
        d="M17.5 22.5h17.5v6.6H24.6v5.2h9.1v6.5h-9.1v9.2h-7.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The loader is the mark refuelling on a loop. Same artwork, nothing new. */
export function Loader({ size = 52, label }: { size?: number; label?: string }) {
  const [fill, setFill] = useState(0.1);

  useEffect(() => {
    const steps = [0.1, 0.4, 0.7, 1];
    let i = 0;
    const timer = window.setInterval(() => {
      i = (i + 1) % steps.length;
      setFill(steps[i]);
    }, 380);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="stack" style={{ alignItems: "center", gap: 12 }} role="status">
      <Mark size={size} fill={fill} className="acid" title="Loading" />
      {label && <p className="eyebrow">{label}</p>}
    </div>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <div className="row" style={{ gap: 9 }}>
      <Mark size={size} className="acid" />
      <span
        style={{
          fontFamily: "var(--display)",
          fontWeight: 800,
          fontSize: size * 0.72,
          letterSpacing: "-0.04em",
        }}
      >
        Fuel<span className="acid">Link</span>
      </span>
    </div>
  );
}

/* ── Interface icons ─────────────────────────────────────────────────── */

type IconName =
  | "nozzle"
  | "tow"
  | "battery"
  | "tyre"
  | "key"
  | "wrench"
  | "map"
  | "clock"
  | "gear"
  | "wallet"
  | "back"
  | "target"
  | "phone"
  | "check";

const PATHS: Record<IconName, string> = {
  nozzle: "M4 20h9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1zM13 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2-3",
  tow: "M3 17h5m8 0h5M3 17V9h7l3 4h6M6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0m9.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M13 13V6h4",
  battery: "M4 8h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm18 2v4M7 10v4m3-2H4",
  tyre: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18m0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7M12 3v5.5M21 12h-5.5M12 21v-5.5M3 12h5.5",
  key: "M14.5 4a5.5 5.5 0 1 1-4.4 8.8L4 19v3h3l1-1v-2h2v-2h2l1.1-1.1A5.5 5.5 0 0 1 14.5 4m1.5 3.5v.01",
  wrench: "M14.7 6.3a4.5 4.5 0 0 0 5.8 5.8l-8 8a2.8 2.8 0 0 1-4-4z",
  map: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11m0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18m0 4.5V12l3.5 2",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m8 3a8 8 0 0 0-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 0 0-3-1.8L14 2h-4l-.5 2.5a8 8 0 0 0-3 1.8l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3.6l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 3 1.8L10 22h4l.5-2.5a8 8 0 0 0 3-1.8l2.3 1 2-3.4-2-1.5c.13-.58.2-1.19.2-1.8",
  wallet: "M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm14 3h4v4h-4a2 2 0 0 1 0-4",
  back: "M15 5l-7 7 7 7",
  target: "M12 3v3m0 12v3M3 12h3m12 0h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1",
  check: "M4 12.5l5.5 5.5L20 7",
};

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
