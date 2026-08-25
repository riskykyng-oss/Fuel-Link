import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Icon, Wordmark } from "../components/brand";
import { PhotoPicker } from "../components/photo";
import { Field, Segmented, TopBar } from "../components/ui";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
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
  const { user, refresh, signOut } = useSession();
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
  const navigate = useNavigate();

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
      {!isSupplier && <TopBar title="Profile" onBack={() => navigate(-1)} />}

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
          <SupplierProfileEditor profile={profile} onSaved={() => void refresh()} />
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

        <div className="tile">
          <p className="eyebrow">Change password</p>
          <PasswordChanger />
        </div>

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

function SupplierProfileEditor({
  profile,
  onSaved,
}: {
  profile: { company_name: string; zera_licence_number: string; vehicle_registration: string; tanker_capacity_litres: number; is_verified: boolean; verification_status: string };
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [company, setCompany] = useState(profile.company_name);
  const [licence, setLicence] = useState(profile.zera_licence_number);
  const [plate, setPlate] = useState(profile.vehicle_registration);
  const [capacity, setCapacity] = useState(String(profile.tanker_capacity_litres));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.updateSupplierProfile({
        company_name: company.trim(),
        zera_licence_number: licence.trim(),
        vehicle_registration: plate.trim(),
        tanker_capacity_litres: Number(capacity) || 200,
      });
      notify("Profile updated.");
      setEditing(false);
      onSaved();
    } catch {
      notify("Could not update profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tile">
      <div className="between">
        <p className="eyebrow">Your operation</p>
        {!editing && (
          <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>
            <Icon name="tag" size={13} /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <>
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
          {!profile.is_verified && (
            <button
              type="button"
              className="btn btn--sm btn--primary"
              style={{ marginTop: 8 }}
              onClick={() => {
                api.requestVerification()
                  .then(() => { onSaved(); notify("Verification request submitted."); })
                  .catch(() => notify("Could not submit verification request.", "error"));
              }}
            >
              <Icon name="shield" size={13} /> Request verification
            </button>
          )}
        </>
      ) : (
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          <Field label="Trading name" value={company} onChange={(e) => setCompany(e.target.value)} />
          <div className="grid-2">
            <Field label="ZERA licence no." value={licence} onChange={(e) => setLicence(e.target.value)} />
            <Field label="Tanker plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
          </div>
          <Field label="Tanker capacity (L)" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} min={20} max={5000} />
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setEditing(false); setCompany(profile.company_name); setLicence(profile.zera_licence_number); setPlate(profile.vehicle_registration); setCapacity(String(profile.tanker_capacity_litres)); }}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={() => void save()}>
              {saving ? <span className="spinner" /> : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordChanger() {
  const { notify } = useToast();
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (newPw.length < 6) { notify("Password must be at least 6 characters.", "error"); return; }
    if (newPw !== confirmPw) { notify("Passwords don't match.", "error"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      notify("Password changed.");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not change password.";
      notify(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <Field label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />
      <Field label="Confirm password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Type again" autoComplete="new-password" />
      <button type="button" className="btn btn--primary btn--block" disabled={busy || !newPw} onClick={() => void change()}>
        {busy ? <span className="spinner" /> : "Change password"}
      </button>
    </div>
  );
}
