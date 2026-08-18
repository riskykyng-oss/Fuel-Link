import { useCallback, useEffect, useState } from "react";

import { Loader } from "../../components/brand";
import { TopBar } from "../../components/ui";
import { api, type FuelPrices, type Station } from "../../lib/api";
import { useMyLocation } from "./shared";

export function PricesScreen() {
  const { position } = useMyLocation();
  const [prices, setPrices] = useState<FuelPrices | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      setBusy(true);
      try {
        const [p, s] = await Promise.all([
          api.fuelPrices(refresh),
          api.stationsNearby(position[0], position[1]),
        ]);
        setPrices(p);
        setStations(s);
      } finally {
        setBusy(false);
      }
    },
    [position],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="screen">
      <TopBar
        title="Fuel prices"
        action={
          <button type="button" className="btn btn--sm" onClick={() => load(true)} disabled={busy}>
            {busy ? <span className="spinner" /> : "Refresh"}
          </button>
        }
      />
      <div className="pad stack">
        {prices ? (
          <>
            <div className="grid-2">
              <div className="tile">
                <p className="eyebrow">Petrol</p>
                <p className="data acid" style={{ fontSize: 26, fontWeight: 600 }}>
                  ${prices.petrol_price.toFixed(2)}
                </p>
                <p className="small muted">per litre · ZERA cap</p>
              </div>
              <div className="tile">
                <p className="eyebrow">Diesel</p>
                <p className="data acid" style={{ fontSize: 26, fontWeight: 600 }}>
                  ${prices.diesel_price.toFixed(2)}
                </p>
                <p className="small muted">per litre · ZERA cap</p>
              </div>
            </div>

            <div className="tile row" style={{ alignItems: "flex-start", gap: 10 }}>
              <span className={`dot ${prices.is_live ? "dot--live" : "dot--warn"}`} style={{ marginTop: 6 }} />
              <div>
                <p className="small">
                  {prices.is_live
                    ? `Live from ${prices.source}, ${prices.effective_period}.`
                    : "Live lookup unavailable right now — showing the last cached figure."}
                </p>
                {prices.source_url && (
                  <a
                    className="small acid"
                    href={prices.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check the source
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <Loader label="Fetching prices" />
        )}

        <p className="eyebrow">Stations near you</p>
        {stations.map((s) => (
          <div key={s.id} className="station" style={{ cursor: "default" }}>
            <img src={s.photo_url ?? ""} alt="" />
            <div className="grow">
              <div className="between">
                <strong style={{ fontSize: 14 }}>{s.name}</strong>
                <span className="data small acid">{s.distance_km.toFixed(1)} km</span>
              </div>
              <p className="small muted">{s.address}</p>
              <p className="small data" style={{ marginTop: 3 }}>
                {s.has_petrol ? `P $${s.petrol_price.toFixed(2)}` : "No petrol"} ·{" "}
                {s.has_diesel ? `D $${s.diesel_price.toFixed(2)}` : "No diesel"}
                {s.is_24h && <span className="acid"> · 24h</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
