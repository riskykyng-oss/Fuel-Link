import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { Icon, Wordmark } from "../components/brand";
import { PhotoPicker } from "../components/photo";
import { Segmented, TopBar } from "../components/ui";
import { api } from "../lib/api";
import { useSession, useTheme, useToast } from "../state";

type Prefs = {
  notifyDispatch: boolean;
  notifyPrices: boolean;
  shareLocation: boolean;
  metric: boolean;
};

const PREFS_KEY = "fuellink.prefs";
const DEFAULTS: Prefs = {
  notifyDispatch: true,
  notifyPrices: false,
  shareLocation: true,
  metric: true,
};

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="tile between"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
    >
      <div>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        {hint && <p className="small muted">{hint}</p>}
      </div>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

export function SettingsScreen() {
  const { user, signOut } = useSession();
  const { choice, setChoice } = useTheme();
  const { notify } = useToast();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [mode, setMode] = useState<string>("checking");

  useEffect(() => {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      try {
        setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
      } catch {
        /* keep defaults */
      }
    }
    api
      .health()
      .then((h) => setMode(h.payments_mode))
      .catch(() => setMode("offline"));
  }, []);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  const isSupplier = user?.role === "supplier";
  const profile = user?.supplier_profile;
  const vehicle = user?.vehicles?.[0];

  return (
    <div className={isSupplier ? "screen" : "screen"}>
      {isSupplier && (
        <div
          className="dash__head"
          style={{ maxWidth: 760, width: "100%", margin: "24px auto 0", padding: "0 20px" }}
        >
          <div>
            <h1>Settings</h1>
            <p className="muted">Your account, garage and app preferences.</p>
          </div>
          <NavLink to="/" className="btn btn--sm">
            <Icon name="back" size={15} />
            Dashboard
          </NavLink>
        </div>
      )}
      {!isSupplier && <TopBar title="Profile" />}

      <div
        className="pad stack"
        style={isSupplier ? { maxWidth: 760, width: "100%", margin: "0 auto" } : undefined}
      >
        <div className="tile row" style={{ gap: 14 }}>
          <span
            className={`avatar avatar--ring-green`}
            style={{ width: 52, height: 52, fontSize: 21 }}
          >
            {user?.full_name?.charAt(0).toUpperCase() ?? "?"}
          </span>
          <div className="grow">
            <strong>{user?.full_name}</strong>
            <p className="small muted data">{user?.phone_number}</p>
            <p className="eyebrow" style={{ marginTop: 3 }}>
              {isSupplier ? "Supplier account" : "Customer account"}
            </p>
          </div>
          {profile?.is_verified && (
            <span className="badge badge--ok">
              <Icon name="check" size={11} />
              Verified
            </span>
          )}
        </div>

        <div className="tile">
          <div className="between" style={{ marginBottom: 4 }}>
            <p className="eyebrow">Vehicles</p>
            <NavLink to="/vehicles" className="btn btn--sm">
              <Icon name="gear" size={14} />
              Manage
            </NavLink>
          </div>
          {vehicle ? (
            <>
              <p style={{ marginTop: 4 }}>
                {vehicle.make} {vehicle.model} ·{" "}
                <span className="data">{vehicle.plate_number}</span>
              </p>
              <p className="small muted">
                {vehicle.fuel_type} · {vehicle.tank_capacity_litres} L tank
              </p>
            </>
          ) : (
            <p className="small muted">
              No vehicle yet. Add one so providers know what to look for at your pin.
            </p>
          )}
        </div>

        {profile && (
          <div className="tile">
            <p className="eyebrow">Your operation</p>
            <p style={{ marginTop: 4 }}>{profile.company_name}</p>
            <p className="small muted data">
              {profile.zera_licence_number} · {profile.vehicle_registration} ·{" "}
              {profile.tanker_capacity_litres} L
            </p>
            <p className="small" style={{ marginTop: 6 }}>
              {profile.is_verified ? (
                <span className="badge badge--ok">
                  <Icon name="shield" size={11} />
                  Licence verified
                </span>
              ) : (
                <span className="badge badge--warn">Licence under review</span>
              )}
            </p>
          </div>
        )}

        {profile && (
          <div className="tile">
            <p className="eyebrow">Garage logo</p>
            <p className="small muted" style={{ marginBottom: 8 }}>
              Shown to motorists when your garage is matched to a job.
            </p>
            <PhotoPicker
              kind="garage"
              onUploaded={(url) => notify(url ? "Garage logo saved." : "No logo uploaded.")}
              label="Upload garage logo"
            />
          </div>
        )}

        {profile && (
          <div className="tile">
            <p className="eyebrow">Services offered</p>
            <p style={{ marginTop: 4 }} className="small">
              {(profile.services_offered ?? "fuel")
                .split(",")
                .map((s) => s.replace("_", " "))
                .map((label) => (
                  <span key={label} className="chip chip--static chip--ok" style={{ margin: "0 6px 6px 0" }}>
                    {label}
                  </span>
                ))}
            </p>
          </div>
        )}

        <div className="field">
          <span>Appearance</span>
          <Segmented
            value={choice}
            onChange={setChoice}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ]}
          />
        </div>

        <p className="eyebrow" style={{ marginTop: 6 }}>
          Notifications
        </p>
        <Toggle
          label="Dispatch updates"
          hint="Status changes and arrival alerts."
          checked={prefs.notifyDispatch}
          onChange={(v) => update("notifyDispatch", v)}
        />
        <Toggle
          label="Price changes"
          hint="When the national pump price is revised."
          checked={prefs.notifyPrices}
          onChange={(v) => update("notifyPrices", v)}
        />

        <p className="eyebrow" style={{ marginTop: 6 }}>
          Privacy
        </p>
        <Toggle
          label="Share live location"
          hint="Needed to dispatch to where you actually are."
          checked={prefs.shareLocation}
          onChange={(v) => update("shareLocation", v)}
        />
        <Toggle
          label="Metric units"
          hint="Kilometres and litres."
          checked={prefs.metric}
          onChange={(v) => update("metric", v)}
        />

        <div className="tile row" style={{ alignItems: "flex-start", gap: 10 }}>
          <span
            className={`dot ${mode === "live" ? "dot--live" : "dot--warn"}`}
            style={{ marginTop: 6 }}
          />
          <p className="small">
            Payments are in <strong>{mode}</strong> mode.
            {mode === "mock" &&
              " No money moves. Add Paynow merchant credentials to the backend .env to go live."}
          </p>
        </div>

        <a className="btn btn--block" href="tel:+263242700000">
          <Icon name="phone" size={17} />
          Emergency roadside line
        </a>

        <button
          type="button"
          className="btn btn--danger btn--block"
          onClick={() => {
            signOut();
            notify("Signed out.");
          }}
        >
          Sign out
        </button>

        <div style={{ display: "grid", placeItems: "center", padding: "18px 0", gap: 8 }}>
          <Wordmark size={20} />
          <p className="eyebrow">Version 1.0.0 · Harare</p>
        </div>
      </div>
    </div>
  );
}
