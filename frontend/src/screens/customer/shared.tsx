import { useCallback, useEffect, useState } from "react";

import { HARARE } from "../../lib/services";

export const LITRE_PRESETS = [5, 10, 15, 20];
export const GRID_IDS = ["fuel", "towing", "mechanic", "tyre_change"];
export const STRIP_IDS = ["jump_start", "lockout"];

/** Resolves the device GPS once; falls back to the Harare pin. */
export function useMyLocation() {
  const [position, setPosition] = useState<[number, number]>(HARARE);
  const [precise, setPrecise] = useState(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setPrecise(true);
      },
      () => setPrecise(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(locate, [locate]);
  return { position, precise, locate };
}

const TRACK_STEPS = [
  { key: "accepted", label: "Accepted" },
  { key: "in_transit", label: "On the way" },
  { key: "arrived", label: "Arriving" },
  { key: "delivered", label: "Completed" },
];

/** Compact 4-step progress rail for an active delivery. */
export function TrackProgress({ status }: { status: string }) {
  const index =
    status === "pending" || status === "offered"
      ? -1
      : status === "accepted"
        ? 0
        : status === "in_transit"
          ? 1
          : status === "arrived"
            ? 2
            : 3;
  return (
    <div className="progress">
      {TRACK_STEPS.map((step, i) => (
        <div key={step.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
          <div
            className={`progress__step ${i < index ? "progress__step--done" : i === index ? "progress__step--active" : ""}`}
          >
            <span className="progress__dot">{i < index ? "✓" : i + 1}</span>
            <span className="progress__label">{step.label}</span>
          </div>
          {i < TRACK_STEPS.length - 1 && (
            <div className={`progress__bar ${i < index ? "progress__bar--done" : ""}`} />
          )}
        </div>
      ))}
    </div>
  );
}
