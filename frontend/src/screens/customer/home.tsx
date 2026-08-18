import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Loader } from "../../components/brand";
import { MapView, type MapMarker } from "../../components/map";
import { PhotoPicker } from "../../components/photo";
import {
  Field,
  PumpReadout,
  QuoteLedger,
  Segmented,
  Sheet,
  TopBar,
} from "../../components/ui";
import { VerifyCodeCard } from "../../components/verify";
import {
  api,
  ApiError,
  type Order,
  type PaymentMethod,
  type Quote,
  type ServiceType,
  type SymptomType,
  type Vehicle,
} from "../../lib/api";
import {
  clearOfflineRequest,
  listOfflineRequests,
  offlineSmsHref,
  queueOfflineRequest,
  type OfflineRequest,
} from "../../lib/offline";
import { EMERGENCY_LINE, serviceIcon, serviceLabel } from "../../lib/services";
import { followUpQuestion, resolveService, SYMPTOMS } from "../../lib/triage";
import { useSession, useToast } from "../../state";
import { ActiveOrder } from "./active-order";
import { BiddingScreen } from "./bidding";
import { useMyLocation } from "./shared";
const DIRECT_SERVICES: ServiceType[] = [
  "fuel",
  "towing",
  "jump_start",
  "tyre_change",
  "lockout",
  "mechanic",
];
const LITRE_PRESETS = [5, 10, 15, 20];
type Step = "triage" | "details" | "quote" | "pay" | "done";
function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="steps">
      {" "}
      <div className="steps__bar" aria-hidden="true">
        {" "}
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < current ? "is-on" : ""} />
        ))}{" "}
      </div>{" "}
      <span className="steps__label">
        {" "}
        STEP {current} / {total}{" "}
      </span>{" "}
    </div>
  );
}
function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
}
export function CustomerHome() {
  const { user, refresh } = useSession();
  const { notify } = useToast();
  const { position, precise, locate } = useMyLocation();
  const [pin, setPin] = useState<[number, number]>(position);
  const [manual, setManual] = useState(false);
  const [recenter, setRecenter] = useState("init");
  const [locatedAt, setLocatedAt] = useState<number | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Order | null>(null);
  const [step, setStep] = useState<Step>("triage");
  const [symptom, setSymptom] = useState<SymptomType | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [direct, setDirect] = useState<ServiceType | null>(null);
  const [showDirect, setShowDirect] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [fuelType, setFuelType] = useState("petrol");
  const [litres, setLitres] = useState(10);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [method, setMethod] = useState("ecocash");
  const [payerPhone, setPayerPhone] = useState(user?.phone_number ?? "");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<Order | null>(null);
  const requestKey = useRef<string | null>(null);
  useEffect(() => {
    setPin(position);
    setRecenter(`${position[0]},${position[1]}`);
    if (precise) setLocatedAt(Date.now());
  }, [position, precise]);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!navigator.onLine) {
      setStreet(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${pin[0]}&lon=${pin[1]}`,
        {
          headers: { Accept: "application/json", "Accept-Language": "en" },
          signal: ctrl.signal,
        },
      )
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("geocode")),
        )
        .then((data) => {
          if (!data?.display_name) {
            setStreet(null);
            return;
          }
          const parts = String(data.display_name)
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          setStreet(parts.slice(0, 2).join(", "));
        })
        .catch(() => setStreet(null));
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pin]);
  useEffect(() => {
    Promise.all([api.activeOrder(), api.vehicles()])
      .then(([order, list]) => {
        setActive(order);
        setVehicles(list);
        const def = list.find((v) => v.is_default) ?? list[0];
        setVehicleId(def ? def.id : null);
      })
      .catch(() => notify("Cannot reach the FuelLink server.", "error"))
      .finally(() => setLoading(false));
  }, [notify]);
  useEffect(() => {
    api
      .paymentMethods()
      .then(setMethods)
      .catch(() => setMethods([]));
  }, []);
  const service: ServiceType =
    direct ?? (symptom ? resolveService(symptom, answer) : "mechanic");
  const question = followUpQuestion(symptom);
  const markers = useMemo<MapMarker[]>(
    () => [
      {
        id: "pickup",
        lat: pin[0],
        lng: pin[1],
        kind: "pickup",
        glyph: "◎",
        label: "You",
      },
    ],
    [pin],
  );
  const chosenVehicle = vehicles.find((v) => v.id === vehicleId);
  async function requestQuote() {
    if (!vehicles.length) {
      notify("Add a vehicle before requesting help.", "error");
      return;
    }
    setQuoting(true);
    setQuote(null);
    try {
      const q = await api.quote({
        pickup_lat: pin[0],
        pickup_lng: pin[1],
        service_type: service,
        symptom,
        symptom_answer: question ? answer : null,
        fuel_type: service === "fuel" ? fuelType : null,
        quantity_litres: service === "fuel" ? litres : 0,
      });
      setQuote(q);
      setStep("quote");
    } catch (error) {
      notify(
        error instanceof ApiError
          ? error.message
          : "Could not price the request.",
        "error",
      );
      setStep("details");
    } finally {
      setQuoting(false);
    }
  }
  async function confirmRequest() {
    if (!quote || !quote.coverage) return;
    if (!requestKey.current) {
      requestKey.current =
        globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}`;
    }
    if (!navigator.onLine) {
      const offline: OfflineRequest = {
        key: requestKey.current,
        queuedAt: Date.now(),
        pin,
        symptom,
        service,
        address,
        note: notes,
        litres: service === "fuel" ? litres : 0,
        fuelType,
      };
      queueOfflineRequest(offline);
      notify("Offline — saved locally. Send it by SMS below.", "info");
      setStep("done");
      return;
    }
    setPlacing(true);
    try {
      const order = await api.createOrder({
        pickup_lat: pin[0],
        pickup_lng: pin[1],
        service_type: service,
        symptom,
        symptom_answer: question ? answer : null,
        fuel_type: service === "fuel" ? fuelType : null,
        quantity_litres: service === "fuel" ? litres : 0,
        vehicle_id: vehicleId,
        pickup_address: address || "Dropped pin",
        notes: notes || null,
        photo_url: photoUrl,
        client_request_id: requestKey.current,
        payment_method: method,
        payer_phone: payerPhone || null,
      });
      if (requestKey.current) clearOfflineRequest(requestKey.current);
      requestKey.current = null;
      setPlaced(order);
      setStep("done");
      notify(
        `Request ${order.reference} submitted. Funds held until handover.`,
      );
    } catch (error) {
      notify(
        error instanceof ApiError
          ? error.message
          : "Could not submit the request.",
        "error",
      );
    } finally {
      setPlacing(false);
    }
  }
  function trackPlaced() {
    if (placed) setActive(placed);
  }
  if (loading) return <Loader label="Finding nearby providers" />;
  if (active)
    return <ActiveOrder order={active} onCleared={() => setActive(null)} onBack={() => setActive(null)} />;
  if (!user) return null;
  if (!user.phone_verified) {
    return (
      <VerifyCodeCard
        phone={user.phone_number}
        purpose="signup"
        title="Verify before your first request"
        onVerified={() => void refresh()}
        onAlreadyVerified={() => void refresh()}
        onCancel={() => undefined}
      />
    );
  }
  if (!vehicles.length && step !== "done") {
    return (
      <VehicleGate
        onDone={() => void reloadVehicles()}
        onCancel={() => setStep("triage")}
      />
    );
  }
  async function reloadVehicles() {
    const list = await api.vehicles();
    setVehicles(list);
    const def = list.find((v) => v.is_default) ?? list[0];
    setVehicleId(def ? def.id : null);
  }
  if (step === "done") {
    return (
      <DoneScreen
        placed={placed}
        offline={placed === null ? queuedOffline() : null}
        onTrack={trackPlaced}
        onCancel={() => setStep("triage")}
      />
    );
  }
  if (step === "quote" || step === "pay") {
    return (
      <div className="screen" style={{ position: "relative" }}>
        {" "}
        <div style={{ position: "absolute", inset: 0 }}>
          {" "}
          <MapView
            center={pin}
            markers={markers}
            recenterKey={recenter}
            interactive={false}
          />{" "}
        </div>{" "}
        <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
          {" "}
          <Sheet>
            {" "}
            <div className="stack">
              {" "}
              {quote && !quote.coverage ? (
                <NoCoverage quote={quote} onBack={() => setStep("details")} />
              ) : step === "pay" ? (
                <PayStep
                  quote={quote}
                  methods={methods}
                  method={method}
                  setMethod={setMethod}
                  payerPhone={payerPhone}
                  setPayerPhone={setPayerPhone}
                  placing={placing}
                  onSubmit={confirmRequest}
                  onBack={() => setStep("quote")}
                />
              ) : (
                quote && (
                  <QuoteStep
                    quote={quote}
                    service={service}
                    pin={pin}
                    onConfirm={() => setStep("pay")}
                    onBack={() => setStep("details")}
                  />
                )
              )}{" "}
            </div>{" "}
          </Sheet>{" "}
        </div>{" "}
      </div>
    );
  }
  if (step === "details") {
    return (
      <div className="screen" style={{ position: "relative" }}>
        {" "}
        <div style={{ position: "absolute", inset: 0 }}>
          {" "}
          <MapView
            center={pin}
            markers={markers}
            onCenterChange={(lat, lng) => {
              setPin([lat, lng]);
              setManual(true);
            }}
            recenterKey={recenter}
          />{" "}
        </div>{" "}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 400,
            padding: 12,
          }}
        >
          {" "}
          <div className="tile between" style={{ background: "var(--bg)" }}>
            {" "}
            <div>
              {" "}
              <p className="eyebrow">Drop your pin</p>{" "}
              <p className="data muted">
                {" "}
                {pin[0].toFixed(4)}, {pin[1].toFixed(4)}{" "}
              </p>{" "}
            </div>{" "}
            <button type="button" className="btn btn--sm" onClick={locate}>
              {" "}
              <Icon name="target" size={15} />{" "}
              {precise ? "Recentre" : "Use GPS"}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
        <div style={{ position: "relative", marginTop: "auto", zIndex: 400 }}>
          {" "}
          <Sheet>
            {" "}
            <div className="stack">
              {" "}
              <div className="between">
                {" "}
                <div>
                  {" "}
                  <Steps current={2} total={3} /> <h1>Where are you?</h1>{" "}
                </div>{" "}
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setStep("triage")}
                >
                  {" "}
                  <Icon name="back" size={15} /> Change{" "}
                </button>{" "}
              </div>{" "}
              {question && (
                <div className="tile stack" style={{ gap: 8 }}>
                  {" "}
                  <p className="eyebrow">{question}</p>{" "}
                  <div className="grid-2">
                    {" "}
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={
                        answer ===
                        (question.includes("lights")
                          ? "lights_yes"
                          : "spare_yes")
                      }
                      onClick={() =>
                        setAnswer(
                          question.includes("lights")
                            ? "lights_yes"
                            : "spare_yes",
                        )
                      }
                    >
                      {" "}
                      Yes{" "}
                    </button>{" "}
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={
                        answer ===
                        (question.includes("lights") ? "lights_no" : "spare_no")
                      }
                      onClick={() =>
                        setAnswer(
                          question.includes("lights")
                            ? "lights_no"
                            : "spare_no",
                        )
                      }
                    >
                      {" "}
                      No{" "}
                    </button>{" "}
                  </div>{" "}
                  {answer === null && (
                    <button
                      type="button"
                      className="small muted"
                      style={{
                        background: "none",
                        border: 0,
                        padding: 0,
                        alignSelf: "flex-start",
                      }}
                      onClick={() => setAnswer("skip")}
                    >
                      {" "}
                      Skip — I'm not sure, just help{" "}
                    </button>
                  )}{" "}
                </div>
              )}{" "}
              {vehicles.length > 0 && (
                <>
                  {" "}
                  <p className="eyebrow">Your vehicle</p>{" "}
                  <div className="scroller">
                    {" "}
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="chip"
                        aria-pressed={vehicleId === v.id}
                        onClick={() => setVehicleId(v.id)}
                      >
                        {" "}
                        {v.make} {v.model} · {v.plate_number}{" "}
                      </button>
                    ))}{" "}
                  </div>{" "}
                </>
              )}{" "}
              {service === "fuel" && (
                <>
                  {" "}
                  <Segmented
                    value={fuelType}
                    onChange={setFuelType}
                    options={[
                      { value: "petrol", label: "Petrol" },
                      { value: "diesel", label: "Diesel" },
                    ]}
                  />{" "}
                  <div className="field">
                    {" "}
                    <span>How much do you need?</span>{" "}
                    <div className="scroller">
                      {" "}
                      {LITRE_PRESETS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className="chip"
                          aria-pressed={litres === amount}
                          onClick={() => setLitres(amount)}
                        >
                          {" "}
                          {amount} L{" "}
                        </button>
                      ))}{" "}
                    </div>{" "}
                    <p className="small muted">
                      Deliveries are capped at 20 L per request.
                    </p>{" "}
                  </div>{" "}
                </>
              )}{" "}
              <Field
                label="Address or landmark (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`Near ${chosenVehicle ? chosenVehicle.make : "your car"}… or 'corner 4th & Nelson Mandela'`}
              />{" "}
              <Field
                label="Note for the provider (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`${chosenVehicle ? `${chosenVehicle.make} ${chosenVehicle.model}, hazards on` : "Silver car, hazards on"}`}
              />{" "}
              <PhotoPicker
                kind="breakdown"
                onUploaded={setPhotoUrl}
                label="Attach a photo of the issue"
              />{" "}
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={quoting || (question !== null && answer === null)}
                onClick={requestQuote}
              >
                {" "}
                {quoting ? (
                  <span className="spinner" />
                ) : (
                  "Find providers & price"
                )}{" "}
              </button>{" "}
              <a className="panic-link" href={`tel:${EMERGENCY_LINE}`}>
                {" "}
                <Icon name="triangle" size={14} /> I feel unsafe — call the
                emergency line{" "}
              </a>{" "}
            </div>{" "}
          </Sheet>{" "}
        </div>{" "}
      </div>
    );
  }
  return (
    <div className="screen">
      {" "}
      <div
        className="pad stack"
        style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}
      >
        {" "}
        <div className="pin-row between">
          {" "}
          <div>
            {" "}
            <p className="pin-row__line">
              {" "}
              {street ?? (manual ? "Dropped pin" : "Current location")}{" "}
            </p>{" "}
            <p className="data muted">
              {" "}
              {pin[0].toFixed(4)}, {pin[1].toFixed(4)}{" "}
              {precise && locatedAt ? ` · ${timeAgo(locatedAt, now)}` : ""}{" "}
            </p>{" "}
          </div>{" "}
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              setManual(false);
              locate();
            }}
          >
            {" "}
            <Icon name="target" size={15} />{" "}
            {precise ? "Recentre" : "Use GPS"}{" "}
          </button>{" "}
        </div>{" "}
        <div>
          {" "}
          <Steps current={1} total={3} /> <h1>What's wrong?</h1>{" "}
          <p className="muted" style={{ marginTop: 4 }}>
            {" "}
            Tell us what happened and we'll send the right provider.{" "}
          </p>{" "}
        </div>{" "}
        <div className="service-grid">
          {" "}
          {SYMPTOMS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={[
                "service-card",
                s.hero ? "service-card--hero" : "",
                s.wide ? "service-card--wide" : "",
                s.id === "something_else" ? "service-card--quiet" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={symptom === s.id}
              onClick={() => {
                setSymptom(s.id);
                setDirect(null);
                setAnswer(null);
              }}
            >
              {" "}
              <span
                className={
                  s.tint
                    ? `service-card__icon service-card__icon--${s.tint}`
                    : "service-card__icon"
                }
              >
                {" "}
                <Icon name={s.icon} size={s.hero ? 26 : 22} />{" "}
              </span>{" "}
              <strong>{s.label}</strong> {!s.wide && <small>{s.blurb}</small>}{" "}
              {s.hero || s.wide ? (
                <span className="service-card__chev">
                  {" "}
                  <Icon name="arrow" size={17} />{" "}
                </span>
              ) : null}{" "}
              {symptom === s.id && (
                <span className="service-card__tick">
                  {" "}
                  <Icon name="check" size={13} />{" "}
                </span>
              )}{" "}
            </button>
          ))}{" "}
        </div>{" "}
        <div className="disclosure">
          {" "}
          <button
            type="button"
            className="disclosure__row"
            aria-expanded={showDirect}
            onClick={() => setShowDirect((v) => !v)}
          >
            {" "}
            <span>I already know what I need.</span>{" "}
            <Icon name="arrow" size={16} />{" "}
          </button>{" "}
          {showDirect && (
            <div className="services-strip">
              {" "}
              {DIRECT_SERVICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={direct === s}
                  onClick={() => {
                    setDirect(s);
                    setSymptom(null);
                    setAnswer(null);
                  }}
                >
                  {" "}
                  <Icon name={serviceIcon(s)} size={20} />{" "}
                  {serviceLabel(s)}{" "}
                </button>
              ))}{" "}
            </div>
          )}{" "}
        </div>{" "}
        {(symptom || direct) && (
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => setStep("details")}
          >
            {" "}
            Continue{" "}
          </button>
        )}{" "}
        <a className="panic-link" href={`tel:${EMERGENCY_LINE}`}>
          {" "}
          <Icon name="triangle" size={14} /> I feel unsafe — call the emergency
          line{" "}
        </a>{" "}
      </div>{" "}
    </div>
  );
}
/* ── gates & steps ─────────────────────────────────────────────────────── */ function VehicleGate({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="screen">
      {" "}
      <TopBar title="Add your vehicle" onBack={onCancel} />{" "}
      <div className="pad stack">
        {" "}
        <div>
          {" "}
          <p className="eyebrow">Before your first request</p>{" "}
          <h1>Add a vehicle</h1>{" "}
          <p className="muted" style={{ marginTop: 6 }}>
            {" "}
            Providers look for your car at the pin. This takes a few
            seconds.{" "}
          </p>{" "}
        </div>{" "}
        <VehicleGateForm onDone={onDone} />{" "}
      </div>{" "}
    </div>
  );
}
function VehicleGateForm({ onDone }: { onDone: () => void }) {
  const { notify } = useToast();
  const [draft, setDraft] = useState({
    make: "",
    model: "",
    plate_number: "",
    fuel_type: "petrol",
    tank_capacity_litres: "50",
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (
      !draft.make.trim() ||
      !draft.model.trim() ||
      draft.plate_number.trim().length < 3
    ) {
      notify("Add a make, model and a valid plate number.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.createVehicle({
        make: draft.make.trim(),
        model: draft.model.trim(),
        plate_number: draft.plate_number.trim(),
        fuel_type: draft.fuel_type,
        tank_capacity_litres: Number(draft.tank_capacity_litres) || 50,
        is_default: true,
      });
      onDone();
    } catch (error) {
      notify(
        error instanceof ApiError
          ? error.message
          : "Could not save the vehicle.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      {" "}
      <div className="grid-2">
        {" "}
        <Field
          label="Make"
          value={draft.make}
          onChange={(e) => setDraft({ ...draft, make: e.target.value })}
          placeholder="Toyota"
        />{" "}
        <Field
          label="Model"
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          placeholder="Wish"
        />{" "}
      </div>{" "}
      <div className="grid-2">
        {" "}
        <Field
          label="Number plate"
          value={draft.plate_number}
          onChange={(e) =>
            setDraft({ ...draft, plate_number: e.target.value.toUpperCase() })
          }
          placeholder="AEK 4412"
        />{" "}
        <Field
          label="Tank size (L)"
          type="number"
          value={draft.tank_capacity_litres}
          onChange={(e) =>
            setDraft({ ...draft, tank_capacity_litres: e.target.value })
          }
          min={10}
          max={200}
        />{" "}
      </div>{" "}
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy}
        onClick={save}
      >
        {" "}
        {busy ? <span className="spinner" /> : "Save vehicle"}{" "}
      </button>{" "}
    </div>
  );
}
function QuoteStep({
  quote,
  service,
  pin,
  onConfirm,
  onBack,
}: {
  quote: Quote;
  service: ServiceType;
  pin: [number, number];
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="stack">
      {" "}
      <div className="between">
        {" "}
        <div>
          {" "}
          <Steps current={3} total={3} />{" "}
          <h2 style={{ marginTop: 4 }}>Providers near you</h2>{" "}
        </div>{" "}
        <button type="button" className="btn btn--sm" onClick={onBack}>
          {" "}
          <Icon name="back" size={15} /> Edit{" "}
        </button>{" "}
      </div>{" "}
      <div className="stack" style={{ gap: 8 }}>
        {" "}
        {quote.providers.map((p, index) => (
          <div
            key={`${p.name}-${index}`}
            className="tile row"
            style={{ gap: 10 }}
          >
            {" "}
            <span
              className="avatar avatar--ring-green"
              style={{ width: 40, height: 40 }}
            >
              {" "}
              {p.name.charAt(0).toUpperCase()}{" "}
            </span>{" "}
            <div className="grow">
              {" "}
              <div className="between">
                {" "}
                <strong style={{ fontSize: 14 }}>{p.name}</strong>{" "}
                <span className="data small">{p.eta_minutes} min</span>{" "}
              </div>{" "}
              <p className="small muted">
                {" "}
                {p.distance_km.toFixed(1)} km away{" "}
                {p.is_verified && (
                  <span className="badge badge--ok" style={{ marginLeft: 6 }}>
                    {" "}
                    <Icon name="shield" size={10} /> Verified{" "}
                  </span>
                )}{" "}
                {p.rating != null && p.rating > 0 && (
                  <span className="muted"> · ★ {p.rating.toFixed(1)}</span>
                )}{" "}
              </p>{" "}
            </div>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      <PumpReadout amount={quote.total_amount} caption="Total to pay" />{" "}
      <QuoteLedger quote={quote} />{" "}
      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={onConfirm}
      >
        {" "}
        Confirm & pay{" "}
      </button>{" "}
      <a
        className="small muted"
        href={`sms:${EMERGENCY_LINE}?body=${encodeURIComponent(`FuelLink request. ${serviceLabel(service)}. Pin: ${pin[0].toFixed(4)}, ${pin[1].toFixed(4)}`)}`}
        style={{ textAlign: "center" }}
      >
        {" "}
        No data? Send by SMS instead{" "}
      </a>{" "}
      <a className="panic-link" href={`tel:${EMERGENCY_LINE}`}>
        {" "}
        <Icon name="triangle" size={14} /> I feel unsafe — call the emergency
        line{" "}
      </a>{" "}
    </div>
  );
}
function NoCoverage({ quote, onBack }: { quote: Quote; onBack: () => void }) {
  return (
    <div className="stack">
      {" "}
      <div>
        {" "}
        <p className="eyebrow">Outside coverage</p>{" "}
        <h2 style={{ marginTop: 4 }}>No provider near that pin</h2>{" "}
        <p className="muted small" style={{ marginTop: 6 }}>
          {" "}
          {quote.nearest_stations.length
            ? "Move your pin closer to one of these stations, or call the emergency line."
            : "Try again shortly — providers rotate around the city."}{" "}
        </p>{" "}
      </div>{" "}
      {quote.nearest_stations.map((s) => (
        <div key={s.id} className="tile between">
          {" "}
          <div>
            {" "}
            <strong style={{ fontSize: 14 }}>{s.name}</strong>{" "}
            <p className="small muted">{s.address}</p>{" "}
          </div>{" "}
          <span className="data small">{s.distance_km.toFixed(1)} km</span>{" "}
        </div>
      ))}{" "}
      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={onBack}
      >
        {" "}
        Move my pin{" "}
      </button>{" "}
      <a className="unsafe-btn" href={`tel:${EMERGENCY_LINE}`}>
        {" "}
        <Icon name="siren" size={18} /> Call the emergency line{" "}
      </a>{" "}
    </div>
  );
}
function PayStep({
  quote,
  methods,
  method,
  setMethod,
  payerPhone,
  setPayerPhone,
  placing,
  onSubmit,
  onBack,
}: {
  quote: Quote | null;
  methods: PaymentMethod[];
  method: string;
  setMethod: (m: string) => void;
  payerPhone: string;
  setPayerPhone: (p: string) => void;
  placing: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  if (!quote) return null;
  const selected = methods.find((m) => m.id === method);
  return (
    <div className="stack">
      {" "}
      <div className="between">
        {" "}
        <div>
          {" "}
          <p className="eyebrow">Confirm & pay</p>{" "}
          <h2 style={{ marginTop: 4 }}>Funds are held, not sent</h2>{" "}
        </div>{" "}
        <button type="button" className="btn btn--sm" onClick={onBack}>
          {" "}
          <Icon name="back" size={15} /> Back{" "}
        </button>{" "}
      </div>{" "}
      <PumpReadout
        amount={quote.total_amount}
        caption="Held against your request"
      />{" "}
      <p className="eyebrow">Pay with</p>{" "}
      <div className="stack" style={{ gap: 8 }}>
        {" "}
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            className="station"
            aria-pressed={method === m.id}
            onClick={() => setMethod(m.id)}
            style={{ alignItems: "center" }}
          >
            {" "}
            <span
              className="row"
              style={{
                width: 46,
                height: 46,
                justifyContent: "center",
                borderRadius: 12,
                background: "var(--surface-2)",
                flex: "none",
              }}
            >
              {" "}
              <Icon name="phone" size={20} />
            </span>{" "}
            <div className="grow">
              {" "}
              <div className="between">
                {" "}
                <strong style={{ fontSize: 14 }}>{m.name}</strong>{" "}
                {!m.live && <span className="eyebrow">test mode</span>}{" "}
              </div>{" "}
              <p className="small muted">{m.note}</p>{" "}
            </div>{" "}
          </button>
        ))}{" "}
      </div>{" "}
      {selected?.requires_phone && (
        <Field
          label="Number to charge"
          value={payerPhone}
          onChange={(e) => setPayerPhone(e.target.value)}
          inputMode="tel"
          hint={
            selected.prefixes.length
              ? `Accepts ${selected.prefixes.join(", ")} numbers.`
              : undefined
          }
        />
      )}{" "}
      <div className="tile row" style={{ gap: 10 }}>
        {" "}
        <span style={{ color: "var(--acid)" }}>
          {" "}
          <Icon name="shield" size={16} />{" "}
        </span>{" "}
        <p className="small muted">
          {" "}
          The amount is held against your request. The provider is only paid
          after the verified handover at your pin.{" "}
        </p>{" "}
      </div>{" "}
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={placing}
        onClick={onSubmit}
      >
        {" "}
        {placing ? (
          <span className="spinner" />
        ) : (
          `Hold $${quote.total_amount.toFixed(2)} & request`
        )}{" "}
      </button>{" "}
      <a className="panic-link" href={`tel:${EMERGENCY_LINE}`}>
        {" "}
        <Icon name="triangle" size={14} /> I feel unsafe — call the emergency
        line{" "}
      </a>{" "}
    </div>
  );
}
function DoneScreen({
  placed,
  offline,
  onTrack,
  onCancel,
}: {
  placed: Order | null;
  offline: OfflineRequest | null;
  onTrack: () => void;
  onCancel: () => void;
}) {
  const queued = listOfflineRequests();
  return (
    <div className="screen">
      {" "}
      <div
        className="pad stack"
        style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}
      >
        {" "}
        <div className="tile row" style={{ gap: 14 }}>
          {" "}
          <span className="service-card__icon">
            {" "}
            <Icon name="check" size={20} />{" "}
          </span>{" "}
          <div>
            {" "}
            {placed ? (
              <>
                {" "}
                <p className="eyebrow">Request submitted</p>{" "}
                <h1>Order {placed.reference}</h1>{" "}
                <p className="small muted" style={{ marginTop: 4 }}>
                  {" "}
                  Order id {placed.id} · ${placed.total_amount.toFixed(2)} held
                  · {serviceLabel(placed.service_type)}{" "}
                </p>{" "}
              </>
            ) : (
              <>
                {" "}
                <p className="eyebrow">Saved offline</p>{" "}
                <h1>Ready to send by SMS</h1>{" "}
                <p className="small muted" style={{ marginTop: 4 }}>
                  {" "}
                  We couldn't reach the server. Your request is queued
                  locally.{" "}
                </p>{" "}
              </>
            )}{" "}
          </div>{" "}
        </div>{" "}
        {placed ? (
          <>
            {" "}
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={onTrack}
            >
              {" "}
              Track provider live{" "}
            </button>{" "}
            <p className="small muted" style={{ textAlign: "center" }}>
              {" "}
              Providers are matched by distance. You can cancel free until one
              accepts.{" "}
            </p>{" "}
          </>
        ) : (
          <>
            {" "}
            {offline && (
              <a
                className="btn btn--primary btn--block"
                href={offlineSmsHref(offline)}
              >
                {" "}
                <Icon name="share" size={16} /> Send request by SMS{" "}
              </a>
            )}{" "}
            {queued.length > 0 && (
              <p className="small muted" style={{ textAlign: "center" }}>
                {" "}
                {queued.length} request{queued.length > 1 ? "s" : ""} waiting.
                Go online and submit again to send.{" "}
              </p>
            )}{" "}
            <button type="button" className="btn" onClick={onCancel}>
              {" "}
              Back to request{" "}
            </button>{" "}
          </>
        )}{" "}
        <a className="unsafe-btn" href={`tel:${EMERGENCY_LINE}`}>
          {" "}
          <Icon name="siren" size={18} /> I feel unsafe{" "}
        </a>{" "}
      </div>{" "}
    </div>
  );
}
function queuedOffline(): OfflineRequest | null {
  const list = listOfflineRequests();
  return list.length ? list[list.length - 1] : null;
}
