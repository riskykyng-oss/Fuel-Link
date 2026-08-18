import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Icon, Loader, Mark, Wordmark } from "../components/brand";
import { Field, TopBar } from "../components/ui";
import { AuthBackdrop } from "../components/backdrop";
import { VerifyCodeCard } from "../components/verify";
import { api, ApiError, type AuthResponse, type Coverage, type Role } from "../lib/api";
import { useSession, useToast } from "../state";
import { useMyLocation } from "./customer/shared";

/** Segmented control with a sliding lime thumb — the "morph" of sign-in/sign-up. */
function SlideSeg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      className="seg seg--slide"
      role="tablist"
      style={{ "--i": index, "--n": options.length } as React.CSSProperties}
    >
      <span className="seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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

/* ── OPEN: a stranded motorist checks coverage before creating an account ── */

export function WelcomeScreen() {
  const { notify } = useToast();
  const { position, precise, locate } = useMyLocation();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    if (!precise && !position) {
      locate();
    }
    setChecking(true);
    setCoverage(null);
    try {
      setCoverage(await api.coverage(position[0], position[1]));
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Cannot reach the FuelLink server.", "error");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="app app--landing">
      <div className="auth auth--landing">
        <AuthBackdrop />

        <div className="auth__content">
          <div className="landing__top">
            <Wordmark size={26} />
            <span className="auth__ticker">
              <span className="pulse" aria-hidden="true" />
              Harare · 24/7
            </span>
          </div>

          <div className="landing__cols">
            <div className="landing__col">
              <div className="landing__hero stagger">
                <h1>
                  Where are you
                  <br />
                  <span className="acid">stuck?</span>
                </h1>
                <p className="muted">
                  Fuel, a tow, a jump start or a mechanic — a verified roadside provider comes to your
                  pin, tracked live to the handover.
                </p>
              </div>

              <ul className="landing__features">
                <li>
                  <span className="tick">
                    <Icon name="check" size={11} />
                  </span>
                  Up to 20 litres delivered straight to your car
                </li>
                <li>
                  <span className="tick">
                    <Icon name="check" size={11} />
                  </span>
                  ZERA-verified fuel at the official cap
                </li>
                <li>
                  <span className="tick">
                    <Icon name="check" size={11} />
                  </span>
                  Tracked live from dispatch to handover
                </li>
              </ul>
            </div>

            <div className="landing__col">
              <div className="tile cover-card">
                <span className="service-card__icon">
                  <Icon name="map" size={18} />
                </span>
                <div className="grow">
                  <strong style={{ fontSize: 14 }}>Am I covered?</strong>
                  <p className="small muted" style={{ marginTop: 3 }}>
                    Nearest stations and response time from your location.
                  </p>
                  <button
                    type="button"
                    className="btn btn--sm"
                    style={{ marginTop: 10 }}
                    onClick={check}
                    disabled={checking}
                  >
                    {checking ? (
                      <span className="spinner" />
                    ) : (
                      <>
                        <Icon name="target" size={15} />
                        {precise ? "Recheck coverage" : "Check my location"}
                      </>
                    )}
                  </button>
                  {coverage?.covered && (
                    <p className="small" style={{ marginTop: 10 }}>
                      <span className="badge badge--ok">
                        <Icon name="check" size={11} />
                        Covered
                      </span>{" "}
                      {coverage.est_response_min != null && (
                        <span className="muted"> ~{coverage.est_response_min} min response.</span>
                      )}
                    </p>
                  )}
                  {coverage && !coverage.covered && (
                    <div style={{ marginTop: 10 }}>
                      <span className="badge badge--warn">Outside coverage right now</span>
                      <p className="small muted" style={{ marginTop: 6 }}>
                        Nearest stations:
                      </p>
                      <ul className="small muted" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {coverage.stations.map((s) => (
                          <li key={s.id}>
                            {s.name} · {s.distance_km.toFixed(1)} km
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="stack" style={{ gap: 12, marginTop: 4 }}>
                <Link to="/auth?mode=signup" className="btn btn--primary btn--block">
                  Create account to request help
                </Link>
                <Link to="/auth?mode=signin" className="btn btn--block">
                  Sign in
                </Link>
                <Link to="/auth?mode=signup&role=supplier" className="btn btn--ghost btn--block">
                  I provide roadside help
                </Link>
              </div>

              <div className="tile auth__demo">
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
                {import.meta.env.DEV && (
                  <div className="row" style={{ gap: 8, marginTop: 10 }}>
                    <Link to="/motorist" className="chip">
                      Preview · Motorist
                    </Link>
                    <Link to="/design" className="chip">
                      Preview · Provider
                    </Link>
                    <Link to="/garage" className="chip">
                      Preview · Garage
                    </Link>
                    <Link to="/driver" className="chip">
                      Preview · Driver
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ACCOUNT: sign in / sign up / verify / reset ───────────────────────── */

const SUPPLIER_SERVICES = [
  { id: "fuel", label: "Fuel" },
  { id: "towing", label: "Towing" },
  { id: "jump_start", label: "Jump start" },
  { id: "tyre_change", label: "Tyre change" },
  { id: "lockout", label: "Lockout" },
  { id: "mechanic", label: "Mechanic" },
];

type Stage = "credentials" | "verify" | "reset";

export function AuthScreen() {
  const { signIn, refresh } = useSession();
  const { notify } = useToast();
  const [params] = useSearchParams();

  const [role, setRole] = useState<Role>(() =>
    params.get("role") === "supplier" ? "supplier" : "customer",
  );
  const [mode, setMode] = useState<"signin" | "signup">(() =>
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const [stage, setStage] = useState<Stage>("credentials");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AuthResponse | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    phone_number: "",
    password: "",
    full_name: "",
    email: "",
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
      const res =
        mode === "signin"
          ? await api.login(form.phone_number, form.password, role)
          : role === "customer"
            ? await api.registerCustomer({
                full_name: form.full_name,
                phone_number: form.phone_number,
                password: form.password,
                email: form.email || null,
              })
            : await api.registerSupplier({
                full_name: form.full_name,
                phone_number: form.phone_number,
                password: form.password,
                email: form.email || null,
                company_name: form.company_name,
                zera_licence_number: form.zera_licence_number,
                vehicle_registration: form.vehicle_registration,
                tanker_capacity_litres: Number(form.tanker_capacity_litres) || 200,
                services_offered: services.length ? services : ["fuel"],
              });
      if (res.user.role === "customer" && !res.user.phone_verified) {
        setPending(res);
        setStage("verify");
        return;
      }
      signIn(res);
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Network unreachable.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "verify" && pending) {
    return (
      <VerifyCodeCard
        phone={pending.user.phone_number}
        purpose="signup"
        title="Confirm it's you"
        onVerified={() => {
          signIn(pending);
          // The register/login payload predates verification, so re-fetch the
          // user to pick up phone_verified=true before entering the app.
          void refresh().catch(() => undefined);
        }}
        onCancel={() => setStage("credentials")}
      />
    );
  }

  if (stage === "reset") {
    return (
      <ResetPasswordScreen onBack={() => setStage("credentials")} onDone={(res) => signIn(res)} />
    );
  }

  const isCustomer = role === "customer";

  return (
    <div className="app">
      <div className="auth">
        <AuthBackdrop />

        <div className="auth__content">
          <TopBar title={isCustomer ? "Motorist account" : "Supplier account"} onBack={() => setStage("credentials")} />

          <div key={`hero-${role}-${mode}`} className="morph" style={{ display: "grid", gap: 16 }}>
            <div className="landing__top">
              <Wordmark size={24} />
              <span className="auth__ticker">
                <span className="pulse" aria-hidden="true" />
                Verified providers only
              </span>
            </div>
            <div className="landing__hero">
              <h1>
                {isCustomer ? (
                  mode === "signin" ? (
                    <>
                      Welcome
                      <br />
                      <span className="acid">back.</span>
                    </>
                  ) : (
                    <>
                      Get help on
                      <br />
                      <span className="acid">the road.</span>
                    </>
                  )
                ) : (
                  <>
                    Run your garage
                    <br />
                    <span className="acid">on demand.</span>
                  </>
                )}
              </h1>
              <p className="muted">
                {isCustomer
                  ? "Fuel, towing, a mechanic or a jump start — a verified provider comes to your pin."
                  : "Fuel delivery, towing, mechanics and tyre work land in one dashboard."}
              </p>
            </div>
            <SlideSeg
              value={role}
              onChange={(next) => setRole(next)}
              options={[
                { value: "customer", label: "I need help" },
                { value: "supplier", label: "I provide help" },
              ]}
            />
          </div>

          <div className="morph-card">
            <SlideSeg
              value={mode}
              onChange={setMode}
              options={[
                { value: "signin", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ]}
            />

            <form key={`form-${mode}-${role}`} className="stack morph" onSubmit={submit} style={{ marginTop: 16 }}>

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

              {!isCustomer && (
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
                </>
              )}

              {isCustomer && (
                <p className="small muted">
                  You can add your vehicle in the next step. It's only needed before your first
                  request.
                </p>
              )}
            </>
          )}

          {mode === "signin" && (
            <button
              type="button"
              className="small muted"
              style={{ alignSelf: "flex-end", background: "none", border: 0, padding: 0 }}
              onClick={() => setStage("reset")}
            >
              Forgot password?
            </button>
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
        </div>

        <Link to="/" className="small muted" style={{ textAlign: "center" }}>
          Back to coverage check
        </Link>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordScreen({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: (res: AuthResponse) => void;
}) {
  const { notify } = useToast();
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (password.length < 6 || !resetToken) return;
    setBusy(true);
    try {
      onDone(await api.passwordReset(resetToken, password));
      notify("Password updated. You're signed in.");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "Could not reset the password.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <div className="screen screen--standalone">
        <AuthBackdrop />
        <TopBar title="Reset your password" onBack={onBack} />
        <div className="pad stack">
          <div>
            <p className="eyebrow">Step · number</p>
            <h1>Which number is on your account?</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              We'll text a code to that number to prove it's you.
            </p>
          </div>
          <Field
            label="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="077 123 4567"
            inputMode="tel"
          />
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={phone.trim().length < 9}
            onClick={() => setStep("code")}
          >
            Send code
          </button>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <VerifyCodeCard
        phone={phone}
        purpose="reset"
        title="Reset your password"
        onVerified={(res) => {
          setResetToken(res.reset_token ?? null);
          setStep("password");
        }}
        onCancel={onBack}
      />
    );
  }

  return (
    <div className="screen screen--standalone">
      <AuthBackdrop />
      <TopBar title="New password" onBack={onBack} />
      <div className="pad stack">
        <div>
          <p className="eyebrow">Step · password</p>
          <h1>Choose a new password</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Your number was verified. Pick a fresh password for your account.
          </p>
        </div>

        <Field
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          minLength={6}
          autoComplete="new-password"
        />

        <button type="button" className="btn btn--primary btn--block" disabled={busy || password.length < 6} onClick={finish}>
          {busy ? <span className="spinner" /> : "Set new password"}
        </button>
      </div>
    </div>
  );
}
