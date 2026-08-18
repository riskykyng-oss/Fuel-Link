type IconName =
  | "home"
  | "grid"
  | "bolt"
  | "users"
  | "box"
  | "tag"
  | "car"
  | "alert"
  | "gear"
  | "receipt"
  | "wallet"
  | "user"
  | "phone"
  | "shield"
  | "check"
  | "clock"
  | "route"
  | "chart"
  | "share"
  | "pin"
  | "pencil"
  | "bell"
  | "sun"
  | "siren"
  | "arrow-up"
  | "arrow-down"
  | "calendar"
  | "chevron-right"
  | "star"
  | "nozzle"
  | "tow"
  | "battery"
  | "tyre"
  | "key"
  | "wrench";

const PATHS: Record<IconName, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  bolt: "M13 2 4 14h6l-1 8 9-12h-6z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m9-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6m6 5a3 3 0 1 0-2-5.2",
  box: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7m-9 4v10",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9m4-4h.01",
  car: "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2m0 0v2h14v-2M7.5 15.5h.01M16.5 15.5h.01",
  alert: "M12 3 1.8 20h20.4L12 3zm0 6v5m0 3h.01",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6m8 3a8 8 0 0 0-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 0 0-3-1.8L14 2h-4l-.5 2.5a8 8 0 0 0-3 1.8l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3.6l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 3 1.8L10 22h4l.5-2.5a8 8 0 0 0 3-1.8l2.3 1 2-3.4-2-1.5c.13-.58.2-1.19.2-1.8",
  receipt: "M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zm3 6h6M9 13h6",
  wallet: "M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm14 3h4v4h-4a2 2 0 0 1 0-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-8 8a8 8 0 0 1 16 0",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1",
  shield: "M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z",
  check: "M4 12.5l5.5 5.5L20 7",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18m0 4.5V12l3.5 2",
  route: "M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4m12-12a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 18V8a4 4 0 0 1 4-4h4m0 0l-3 3m3-3l-3-3",
  chart: "M3 21h18M5 21V13m4 8V9m4 12V5m4 16v-9",
  share: "M12 3v13m0 0l-4-4m4 4l4-4M4 21h16",
  pin: "M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11m0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  pencil: "M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 6.5l3 3",
  bell: "M12 3a6 6 0 0 0-6 6c0 6-2 8-2 8h16s-2-2-2-8a6 6 0 0 0-6-6m-2 16a2 2 0 0 0 4 0",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m-9 4h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7l-.7.7m.7 12.1l-.7-.7M5.6 18.4l.7-.7",
  siren: "M7 18v-6a5 5 0 0 1 10 0v6M4 18h16M12 7V4M12 4h.01",
  "arrow-up": "M12 20V4m0 0l-6 6m6-6l6 6",
  "arrow-down": "M12 4v16m0 0l6-6m-6 6l-6-6",
  calendar: "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zm0 5h16M8 3v4m8-4v4",
  "chevron-right": "M9 5l7 7-7 7",
  star: "M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z",
  nozzle: "M4 20h9V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1zM13 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-2-3",
  tow: "M3 17h5m8 0h5M3 17V9h7l3 4h6M6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0m9.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M13 13V6h4",
  battery: "M4 8h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm18 2v4M7 10v4m3-2H4",
  tyre: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18m0 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M12 3v5.5M21 12h-5.5M12 21v-5.5M3 12h5.5",
  key: "M14.5 4a5.5 5.5 0 1 1-4.4 8.8L4 19v3h3l1-1v-2h2v-2h2l1.1-1.1A5.5 5.5 0 0 1 14.5 4m1.5 3.5v.01",
  wrench: "M14.7 6.3a4.5 4.5 0 0 0 5.8 5.8l-8 8a2.8 2.8 0 0 1-4-4z",
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
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
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type { IconName };
