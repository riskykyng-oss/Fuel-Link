import { useState } from "react";

import { Loader, Mark, Wordmark } from "../components/brand";
import { Field, SelectField, Segmented } from "../components/ui";
import { api, ApiError, type Role } from "../lib/api";
import { useSession, useToast } from "../state";

export function Splash() {
  return (
    <div className="splash">
      <div className="splash__inner">
        <Loader size={72} />
        <p className="splash__word">
          Fuel<em>Link</em>
        </p>
        <p className="eyebrow">Roadside dispatch · Harare</p>
      </div>
    </div>
  );
}

export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="app" style={{ display: "grid", placeItems: "center" }}>
      <Loader label={label} />
    </div>
  );
}

type Mode = "signin" | "signup";

const FUEL_OPTIONS = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
];

const SUPPLIER_SERVICES = [
  { id: "fuel", label: "Fuel" },
  { id: "towing", label: "Towing" },
  { id: "jump_start", label: "Jump start" },
  { id: "tyre_change", label: "Tyre change" },
  { id: "lockout", label: "Lockout" },
  { id: "mechanic", label: "Mechanic" },
];

export function AuthScreen() {
  const { signIn } = useSession();
  const { notify } = useToast();

  const [role, setRole] = useState<Role>("customer");
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    phone_number: "",
    password: "",
    full_name: "",
    email: "",
    vehicle_make: "",
    vehicle_model: "",
    plate_number: "",
    fuel_type: "petrol",
    tank_capacity_litres: "50",
    company_name: "",
    zera_licence_number: "",
    vehicle_registration: "",
    tanker_capacity_litres: "200",
  });
  const [services, setServices] = useState<string[]>(["fuel"]);

  const set = (key: string) => (event: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const toggleService = (id: string) =>
    setServices((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        signIn(await api.login(form.phone_number, form.password, role));
        return;
      }
      const shared = {
        full_name: form.full_name,
        phone_number: form.phone_number,
        password: form.password,
        email: form.email || null,
      };
      const res =
        role === "customer"
          ? await api.registerCustomer({
              ...shared,
              vehicle_make: form.vehicle_make,
              vehicle_model: form.vehicle_model,
              plate_number: form.plate_number,
              fuel_type: form.fuel_type,
              tank_capacity_litres: Number(form.tank_capacity_litres) || 50,
            })
          : await api.registerSupplier({
              ...shared,
              company_name: form.company_name,
              zera_licence_number: form.zera_licence_number,
              vehicle_registration: form.vehicle_registration,
              tanker_capacity_litres: Number(form.tanker_capacity_litres) || 200,
              services_offered: services.length ? services : ["fuel"],
            });
      signIn(res);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Network unreachable.", "error");
    } finally {
      setBusy(false);
    }
  }

  const isCustomer = role === "customer";

  return (
    <div className="app">
      <div className="auth">
        <div className="auth__wash" aria-hidden="true" />

        <div className="stack stagger" style={{ gap: 18 }}>
          <Wordmark size={30} />
          <div>
            <h1>
              {isCustomer ? (
                <>
                  Out of fuel?
                  <br />
                  <span className="acid">We come to you.</span>
                </>
              ) : (
                <>
                  Run your tanker
                  <br />
                  <span className="acid">on demand.</span>
                </>
              )}
            </h1>
            <p className="muted" style={{ marginTop: 10 }}>
              {isCustomer
                ? "Drop a pin, pick your litres, pay on your phone. A verified supplier is dispatched to where you stopped."
                : "Take jobs near you, quote by distance, and get paid the moment the delivery clears."}
            </p>
          </div>

          <Segmented
            value={role}
            onChange={(next) => setRole(next)}
            options={[
              { value: "customer", label: "I need fuel" },
              { value: "supplier", label: "I supply fuel" },
            ]}
          />
        </div>

        <form className="stack" onSubmit={submit} style={{ marginTop: 4 }}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />

          {mode === "signup" && (
            <Field
              label={isCustomer ? "Full name" : "Contact person"}
              value={form.full_name}
              onChange={set("full_name")}
              placeholder="Tanaka Moyo"
              required
              autoComplete="name"
            />
          )}

          <Field
            label="Mobile number"
            value={form.phone_number}
            onChange={set("phone_number")}
            placeholder="077 123 4567"
            inputMode="tel"
            required
            autoComplete="tel"
          />

          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {mode === "signup" && (
            <>
              <Field
                label="Email (optional)"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.co.zw"
                autoComplete="email"
              />

              {isCustomer ? (
                <>
                  <p className="eyebrow" style={{ marginTop: 4 }}>
                    Your vehicle
                  </p>
                  <div className="grid-2">
                    <Field
                      label="Make"
                      value={form.vehicle_make}
                      onChange={set("vehicle_make")}
                      placeholder="Toyota"
                      required
                    />
                    <Field
                      label="Model"
                      value={form.vehicle_model}
                      onChange={set("vehicle_model")}
                      placeholder="Wish"
                      required
                    />
                  </div>
                  <div className="grid-2">
                    <Field
                      label="Number plate"
                      value={form.plate_number}
                      onChange={set("plate_number")}
                      placeholder="AEK 4412"
                      required
                    />
                    <Field
                      label="Tank size (L)"
                      type="number"
                      value={form.tank_capacity_litres}
                      onChange={set("tank_capacity_litres")}
                      min={10}
                      max={200}
                    />
                  </div>
                  <SelectField
                    label="Fuel it takes"
                    value={form.fuel_type}
                    onChange={set("fuel_type")}
                    options={FUEL_OPTIONS}
                  />
                </>
              ) : (
                <>
                  <p className="eyebrow" style={{ marginTop: 4 }}>
                    Your operation
                  </p>
                  <Field
                    label="Trading name"
                    value={form.company_name}
                    onChange={set("company_name")}
                    placeholder="Zuva Rapid Dispatch"
                    required
                  />
                  <div className="grid-2">
                    <Field
                      label="ZERA licence no."
                      value={form.zera_licence_number}
                      onChange={set("zera_licence_number")}
                      placeholder="ZERA-PPD-0429"
                      required
                    />
                    <Field
                      label="Tanker plate"
                      value={form.vehicle_registration}
                      onChange={set("vehicle_registration")}
                      placeholder="ADP 8821"
                      required
                    />
                  </div>
                  <Field
                    label="Tanker capacity (L)"
                    type="number"
                    value={form.tanker_capacity_litres}
                    onChange={set("tanker_capacity_litres")}
                    min={20}
                    max={5000}
                  />
                  <div className="field">
                    <span>Services you cover</span>
                    <div className="scroller">
                      {SUPPLIER_SERVICES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="chip"
                          aria-pressed={services.includes(s.id)}
                          onClick={() => toggleService(s.id)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="small muted">
                    New supplier accounts stay unverified until an operator checks the licence.
                    You can still take jobs while that is pending.
                  </p>
                </>
              )}
            </>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? (
              <span className="spinner" />
            ) : mode === "signin" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <div className="tile" style={{ marginTop: "auto" }}>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <Mark size={20} className="acid" />
            <p className="eyebrow">Demo accounts</p>
          </div>
          <p className="small muted">
            Customer <span className="data acid">0771234567</span> · Supplier{" "}
            <span className="data acid">0712345678</span>
            <br />
            Password for both: <span className="data acid">password123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
